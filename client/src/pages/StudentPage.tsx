import { useState, useCallback, useEffect, lazy, Suspense } from "react";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import RibbonBar from "@/components/RibbonBar";
import AppHeader from "@/components/AppHeader";
import RouteSelector from "@/components/RouteSelector";
import BottomNavigation from "@/components/BottomNavigation";
import NotificationCard from "@/components/NotificationCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, Bell, Moon, Sun, Volume2, MessageSquare,
  Calendar, Clock, Loader2, Wifi, WifiOff,
} from "lucide-react";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useNotifications } from "@/hooks/useNotifications";
import type { NotificationPayload } from "@/hooks/useWebSocket";
import { useAuth } from "@/context/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import backgroundImage from "@assets/jcet logo pic_1764501988672.jpg";

// Lazy-load the heavy Mapbox component
const BusMap = lazy(() => import("@/components/BusMap"));

type NavItem = "map" | "routes" | "alerts" | "schedule" | "settings";

interface StudentPageProps {
  userName: string;
  onLogout: () => void;
}

interface Schedule {
  id: number;
  routeId: number;
  label: string;
  departureTime: string;
  daysOfWeek: string;
  isActive: boolean;
}

interface RouteStop {
  id: number;
  name: string;
  scheduledTime: string;
  time1015am?: string | null;
  sequence: number;
  isMainStop?: boolean | null;
}

// ── Push notification helpers ─────────────────────────────────────────────────

async function getVapidPublicKey(): Promise<string | null> {
  try {
    const res = await apiRequest("GET", "/api/push/vapid-key");
    const json = await res.json();
    return json.publicKey ?? null;
  } catch { return null; }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function StudentPage({ userName, onLogout }: StudentPageProps) {
  const [activeNav,    setActiveNav]    = useState<NavItem>("routes");
  const [selectedRoute, setSelectedRoute] = useState<number | null>(null);
  const [selectedStop,  setSelectedStop]  = useState<string | null>(null);
  const [isDarkMode,   setIsDarkMode]   = useState(false);
  const [pushEnabled,  setPushEnabled]  = useState(false);
  const [pushLoading,  setPushLoading]  = useState(false);
  const [liveNotifs,   setLiveNotifs]   = useState<NotificationPayload[]>([]);

  const { authData } = useAuth();
  const { showNotification } = useNotifications();

  // ── WebSocket ──────────────────────────────────────────────────────────────
  const handleNotification = useCallback((n: NotificationPayload) => {
    showNotification(n);
    setLiveNotifs(prev => [n, ...prev.slice(0, 29)]);
  }, [showNotification]);

  useWebSocket({
    role: "student",
    userId: authData?.user?.id,
    routeId: selectedRoute ?? undefined,
    onNotification: handleNotification,
  });

  // ── Schedules ──────────────────────────────────────────────────────────────
  const { data: schedules = [] } = useQuery<Schedule[]>({
    queryKey: ["/api/schedules"],
    staleTime: 300_000,
    enabled: activeNav === "schedule",
  });

  // ── Stops for selected route (for schedule display) ────────────────────────
  const { data: routeDetail } = useQuery<{ stops: RouteStop[] }>({
    queryKey: [`/api/routes/${selectedRoute}`],
    enabled: !!selectedRoute && activeNav === "schedule",
  });

  // ── Check push subscription status on mount ────────────────────────────────
  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    navigator.serviceWorker.getRegistration("/sw.js").then(reg => {
      reg?.pushManager.getSubscription().then(sub => setPushEnabled(!!sub));
    });
  }, []);

  // ── Register service worker once ──────────────────────────────────────────
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(console.error);
    }
  }, []);

  // ── Push toggle ────────────────────────────────────────────────────────────
  const handlePushToggle = async (enabled: boolean) => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      alert("Push notifications are not supported in this browser.");
      return;
    }
    setPushLoading(true);
    try {
      if (enabled) {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") { setPushLoading(false); return; }

        const publicKey = await getVapidPublicKey();
        if (!publicKey) { setPushLoading(false); return; }

        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        });

        await apiRequest("POST", "/api/push/subscribe", {
          userId: authData?.user?.id ?? "anonymous",
          subscription: sub.toJSON(),
        });
        setPushEnabled(true);
      } else {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          await apiRequest("DELETE", "/api/push/subscribe", { endpoint: sub.endpoint });
          await sub.unsubscribe();
        }
        setPushEnabled(false);
      }
    } catch (err) {
      console.error("Push toggle failed:", err);
    }
    setPushLoading(false);
  };

  // ── Navigation ─────────────────────────────────────────────────────────────
  const handleRouteSelect = (routeId: number, stopName: string) => {
    setSelectedRoute(routeId);
    setSelectedStop(stopName);
    setActiveNav("map");
  };

  const handleBackToRoutes = () => {
    setSelectedRoute(null);
    setSelectedStop(null);
    setActiveNav("routes");
  };

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
    document.documentElement.classList.toggle("dark", !isDarkMode);
  };

  // ── Next scheduled departure helper ───────────────────────────────────────
  const getNextDeparture = (routeSchedules: Schedule[]): string | null => {
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const upcoming = routeSchedules
      .filter(s => s.isActive)
      .map(s => {
        const [h, m] = s.departureTime.split(":").map(Number);
        return { ...s, totalMin: h * 60 + m };
      })
      .filter(s => s.totalMin > nowMin)
      .sort((a, b) => a.totalMin - b.totalMin);
    return upcoming[0]?.departureTime ?? null;
  };

  // ── Content renderer ───────────────────────────────────────────────────────
  const renderContent = () => {
    switch (activeNav) {
      case "map":
        if (selectedRoute && selectedStop) {
          return (
            <div className="relative" style={{ flex: 1, height: "calc(100vh - 200px)" }}>
              <Button
                size="icon" variant="ghost" onClick={handleBackToRoutes}
                className="absolute top-4 left-4 z-[1001] bg-white/90 shadow-md"
                data-testid="button-back-to-routes"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <Suspense fallback={
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              }>
                <BusMap routeId={selectedRoute} selectedStop={selectedStop} role="student" />
              </Suspense>
            </div>
          );
        }
        return (
          <div className="flex-1 flex items-center justify-center p-4">
            <Card className="max-w-sm text-center p-6">
              <CardContent>
                <p className="text-muted-foreground mb-4">Please select a route and stop first to view the live map.</p>
                <Button onClick={() => setActiveNav("routes")} data-testid="button-select-route">Select Route</Button>
              </CardContent>
            </Card>
          </div>
        );

      case "routes":
        return (
          <div className="flex-1 overflow-auto pb-20">
            <RouteSelector onSelectRoute={handleRouteSelect} />
          </div>
        );

      case "alerts":
        return (
          <div className="flex-1 overflow-auto p-4 pb-20">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Notifications</h2>
              <Bell className="h-5 w-5 text-muted-foreground" />
            </div>
            {liveNotifs.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Bell className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No notifications yet. Select a route to start tracking.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {liveNotifs.map((n, i) => (
                  <NotificationCard
                    key={i}
                    type={n.type === "BUS_ARRIVING" || n.type === "TRIP_COMPLETED" ? "location" : n.type === "ROUTE_CHANGED" ? "route" : "general"}
                    title={n.type.replace(/_/g, " ")}
                    message={[n.stopName, n.routeName, n.etaMinutes ? `ETA ${Math.round(n.etaMinutes)} min` : ""].filter(Boolean).join(" · ")}
                    time={new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    onClick={() => {}}
                  />
                ))}
              </div>
            )}
          </div>
        );

      case "schedule":
        return (
          <div className="flex-1 overflow-auto p-4 pb-20">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Timetable</h2>
              <Calendar className="h-5 w-5 text-muted-foreground" />
            </div>

            {schedules.length === 0 ? (
              <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : (
              <div className="space-y-6">
                {/* Group schedules by route */}
                {Array.from(new Set(schedules.map(s => s.routeId))).map(routeId => {
                  const routeSchedules = schedules.filter(s => s.routeId === routeId);
                  const nextDep = getNextDeparture(routeSchedules);
                  return (
                    <Card key={routeId}>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base">Route {routeId}</CardTitle>
                          {nextDep && (
                            <Badge variant="outline" className="gap-1 text-xs">
                              <Clock className="h-3 w-3" />
                              Next: {nextDep}
                            </Badge>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {routeSchedules.map(s => (
                            <div key={s.id} className="flex items-center justify-between py-2 border-b last:border-0">
                              <div>
                                <p className="font-medium text-sm">{s.label}</p>
                                <p className="text-xs text-muted-foreground">{s.daysOfWeek}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-lg font-bold tabular-nums">{s.departureTime}</span>
                                <Badge variant={s.isActive ? "default" : "secondary"} className="text-xs">
                                  {s.isActive ? "Active" : "Off"}
                                </Badge>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Stop-by-stop times for selected or first route */}
                        {selectedRoute === routeId && routeDetail?.stops && (
                          <div className="mt-4 border-t pt-3">
                            <p className="text-xs font-medium text-muted-foreground mb-2">STOP TIMES</p>
                            <div className="space-y-1">
                              {routeDetail.stops.map((stop, i) => (
                                <div key={stop.id} className="flex items-center justify-between text-sm py-1">
                                  <div className="flex items-center gap-2">
                                    <div className={`w-2 h-2 rounded-full ${stop.isMainStop ? "bg-primary" : "bg-gray-300"}`} />
                                    <span className={stop.isMainStop ? "font-medium" : ""}>{stop.name}</span>
                                  </div>
                                  <div className="flex gap-3 text-muted-foreground text-xs tabular-nums">
                                    <span>{stop.scheduledTime}</span>
                                    {stop.time1015am && <span className="opacity-60">{stop.time1015am}</span>}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        );

      case "settings":
        return (
          <div className="flex-1 overflow-auto p-4 pb-20">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Settings</h2>
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Appearance</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {isDarkMode ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
                      <Label htmlFor="dark-mode">Dark Mode</Label>
                    </div>
                    <Switch id="dark-mode" checked={isDarkMode} onCheckedChange={toggleDarkMode} data-testid="switch-dark-mode" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Notifications</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {pushEnabled ? <Wifi className="h-4 w-4 text-green-500" /> : <WifiOff className="h-4 w-4" />}
                      <div>
                        <Label htmlFor="push-notifications">Push Notifications</Label>
                        <p className="text-xs text-muted-foreground">
                          {pushEnabled ? "Alerts delivered even when app is closed" : "Enable to get bus alerts in background"}
                        </p>
                      </div>
                    </div>
                    {pushLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Switch
                        id="push-notifications"
                        checked={pushEnabled}
                        onCheckedChange={handlePushToggle}
                        data-testid="switch-push"
                      />
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Volume2 className="h-4 w-4" />
                      <Label htmlFor="sound">Sound</Label>
                    </div>
                    <Switch id="sound" defaultChecked data-testid="switch-sound" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Support</CardTitle>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" className="w-full gap-2" data-testid="button-contact-support">
                    <MessageSquare className="h-4 w-4" />
                    Contact Transport Office
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <ToastContainer
        position="top-right"
        autoClose={6000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
        style={{ zIndex: 9999 }}
      />
      <div className="relative z-10 flex flex-col min-h-screen">
        <RibbonBar />
        <AppHeader userName={userName} userRole="student" onLogout={onLogout} />
        {renderContent()}
        <BottomNavigation
          activeItem={activeNav}
          onNavigate={(item) => setActiveNav(item as NavItem)}
          variant="student"
        />
      </div>
    </div>
  );
}
