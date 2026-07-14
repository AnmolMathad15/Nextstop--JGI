import { useState, useCallback } from "react";
import {
  Bus, Users, Route, UserCircle, Plus, Trash2,
  Search, MapPin, AlertTriangle, CheckCircle, Clock,
  Bell, ShieldAlert, WifiOff, Gauge, RefreshCw,
  BarChart2, TrendingUp, Zap, ChevronDown, ChevronRight,
  ToggleLeft, ToggleRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useWebSocket, type FleetAlertPayload } from "@/hooks/useWebSocket";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, PieChart, Pie, Legend,
} from "recharts";

// ── Types ─────────────────────────────────────────────────────────────────────

interface BusData     { id: string; number: string; capacity: number; isActive: boolean; }
interface RouteData   { id: number; name: string; displayOrder: number; isActive: boolean; color?: string | null; speedLimit?: number | null; }
interface RouteStop   { id: number; routeId: number; name: string; lat: number; lng: number; scheduledTime: string; sequence: number; isMainStop?: boolean | null; }
interface DriverData  { id: string; userId: string; licenseNumber: string | null; assignedBusId: string | null; user: { id: string; username: string; name: string | null; phone: string | null } | null; }
interface StudentData { id: string; userId: string; usn: string; preferredRouteId: number | null; preferredStop: string | null; user: { id: string; username: string; name: string | null } | null; }
interface AlertData   { id: string; alertType: string; severity: string; tripId?: string; busId?: string; driverId?: string; lat?: number; lng?: number; details?: string; status: string; adminNotes?: string; timestamp: string; }
interface AnalyticsSummary {
  delayedStops: { stopName: string; routeId: number; avgDelayMin: number; count: number }[];
  tripDuration: { avgMinutes: number; totalTrips: number };
  driverPunctuality: { driverId: string; overspeedCount: number; performanceScore: number; totalDistance: number }[];
  avgSpeed: { avgSpeedKmh: number };
  notifStats: { totalSent: number; byType: { type: string; count: number }[] };
}

interface AdminDashboardProps { onViewLiveMap?: () => void; }

// ── Constants ─────────────────────────────────────────────────────────────────

const ALERT_ICONS: Record<string, React.ReactNode> = {
  OUT_OF_AREA:    <ShieldAlert className="h-4 w-4" />,
  RASH_DRIVING:   <Gauge className="h-4 w-4" />,
  OVERSPEED:      <Gauge className="h-4 w-4" />,
  GPS_OFFLINE:    <WifiOff className="h-4 w-4" />,
  DRIVER_OFFLINE: <WifiOff className="h-4 w-4" />,
  STOP_REACHED:   <CheckCircle className="h-4 w-4" />,
};

const SEVERITY_STYLES: Record<string, string> = {
  high:   "bg-red-100 text-red-700 border-red-200",
  medium: "bg-yellow-100 text-yellow-700 border-yellow-200",
  low:    "bg-green-100 text-green-700 border-green-200",
};

const PIE_COLORS = ["#3b82f6","#f97316","#22c55e","#ef4444","#8b5cf6","#06b6d4","#f59e0b","#ec4899"];

function formatAlertType(type: string) {
  return type.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}
function timeAgo(ts: string) {
  const ms = Date.now() - new Date(ts).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AdminDashboard({ onViewLiveMap }: AdminDashboardProps) {
  const [activeTab,       setActiveTab]       = useState("overview");
  const [searchQuery,     setSearchQuery]     = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [dialogType,      setDialogType]      = useState<"bus" | "driver" | "student">("bus");
  const [liveAlerts,      setLiveAlerts]      = useState<FleetAlertPayload[]>([]);
  const [expandedRoute,   setExpandedRoute]   = useState<number | null>(null);
  const [isAddStopOpen,   setIsAddStopOpen]   = useState(false);
  const [addStopRouteId,  setAddStopRouteId]  = useState<number | null>(null);
  const [newStop,         setNewStop]         = useState({ name: "", lat: "", lng: "", scheduledTime: "", sequence: "" });

  const qc = useQueryClient();

  const { data: buses    = [] } = useQuery<BusData[]>    ({ queryKey: ["/api/buses"]   });
  const { data: routes   = [] } = useQuery<RouteData[]>  ({ queryKey: ["/api/routes"]  });
  const { data: drivers  = [] } = useQuery<DriverData[]> ({ queryKey: ["/api/drivers"] });
  const { data: students = [] } = useQuery<StudentData[]>({ queryKey: ["/api/students"]});
  const { data: activeTrips = [] } = useQuery<any[]>     ({ queryKey: ["/api/trips/active"] });
  const { data: dbAlerts = [], refetch: refetchAlerts } = useQuery<AlertData[]>({
    queryKey: ["/api/alerts"],
    refetchInterval: 30_000,
  });
  const { data: analytics } = useQuery<AnalyticsSummary>({
    queryKey: ["/api/analytics/summary"],
    refetchInterval: 60_000,
    enabled: activeTab === "analytics",
  });
  const { data: expandedStops = [] } = useQuery<RouteStop[]>({
    queryKey: [`/api/routes/${expandedRoute}`],
    enabled: expandedRoute !== null,
    select: (d: any) => d.stops ?? [],
  });

  const handleFleetAlert = useCallback((alert: FleetAlertPayload) => {
    setLiveAlerts(prev => [alert, ...prev.slice(0, 49)]);
    qc.invalidateQueries({ queryKey: ["/api/alerts"] });
  }, [qc]);

  useWebSocket({ role: "admin", onFleetAlert: handleFleetAlert });

  // ── Mutations ──────────────────────────────────────────────────────────────

  const acknowledgeAlert = useMutation({
    mutationFn: ({ id, status, notes }: { id: string; status: string; notes?: string }) =>
      apiRequest("PATCH", `/api/alerts/${id}`, { status, adminNotes: notes }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/alerts"] }),
  });

  const addBus = useMutation({
    mutationFn: (data: { number: string; capacity: number }) =>
      apiRequest("POST", "/api/buses", { ...data, isActive: true }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/buses"] }); setIsAddDialogOpen(false); },
  });

  const deleteBus = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/buses/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/buses"] }),
  });

  const toggleRoute = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      apiRequest("PATCH", `/api/routes/${id}`, { isActive: !isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/routes"] }),
  });

  const deleteStop = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/route-stops/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`/api/routes/${expandedRoute}`] });
      qc.invalidateQueries({ queryKey: ["/api/routes"] });
    },
  });

  const addStop = useMutation({
    mutationFn: (stop: any) => apiRequest("POST", "/api/route-stops", stop),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`/api/routes/${addStopRouteId}`] });
      setIsAddStopOpen(false);
      setNewStop({ name: "", lat: "", lng: "", scheduledTime: "", sequence: "" });
    },
  });

  // ── Derived state ──────────────────────────────────────────────────────────

  const allAlerts = (() => {
    const map = new Map<string, AlertData | FleetAlertPayload>();
    dbAlerts.forEach(a => map.set(a.id, a));
    liveAlerts.forEach(a => map.set(a.id, { ...a, status: "active", timestamp: new Date(a.timestamp).toISOString() }));
    return Array.from(map.values()).sort((a, b) =>
      new Date((b as any).timestamp).getTime() - new Date((a as any).timestamp).getTime()
    ) as AlertData[];
  })();

  const activeAlerts   = allAlerts.filter(a => a.status === "active");
  const resolvedAlerts = allAlerts.filter(a => a.status !== "active");

  const stats = [
    { label: "Total Buses",         value: buses.length,    icon: Bus,        color: "bg-primary" },
    { label: "Active Drivers",      value: drivers.length,  icon: UserCircle, color: "bg-blue-500" },
    { label: "Total Routes",        value: routes.length,   icon: Route,      color: "bg-green-500" },
    { label: "Registered Students", value: students.length, icon: Users,      color: "bg-yellow-500" },
  ];

  const openAddDialog = (type: "bus" | "driver" | "student") => {
    setDialogType(type);
    setIsAddDialogOpen(true);
  };

  // ── Bus form state (simple inline) ────────────────────────────────────────
  const [newBusNumber,   setNewBusNumber]   = useState("");
  const [newBusCapacity, setNewBusCapacity] = useState("40");

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 max-w-6xl mx-auto space-y-6 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white" data-testid="text-admin-title">
            Admin Dashboard
          </h2>
          <p className="text-sm text-muted-foreground">Manage buses, routes, drivers and students</p>
        </div>
        <div className="flex items-center gap-2">
          {activeAlerts.length > 0 && (
            <Badge variant="destructive" className="gap-1 animate-pulse">
              <Bell className="h-3 w-3" />
              {activeAlerts.length} Alert{activeAlerts.length !== 1 ? "s" : ""}
            </Badge>
          )}
          <Button className="gap-2 bg-primary" onClick={onViewLiveMap} data-testid="button-view-live-map">
            <MapPin className="h-4 w-4" />
            Live Map ({activeTrips.length} active)
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map(stat => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label} className="hover-elevate">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-full ${stat.color}`}>
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold" data-testid={`stat-${stat.label.toLowerCase().replace(/\s/g, "-")}`}>{stat.value}</p>
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex w-full overflow-x-auto gap-1 h-auto flex-wrap">
          <TabsTrigger value="overview"   data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="buses"      data-testid="tab-buses">Buses</TabsTrigger>
          <TabsTrigger value="drivers"    data-testid="tab-drivers">Drivers</TabsTrigger>
          <TabsTrigger value="students"   data-testid="tab-students">Students</TabsTrigger>
          <TabsTrigger value="routes"     data-testid="tab-routes">Routes</TabsTrigger>
          <TabsTrigger value="analytics"  data-testid="tab-analytics">Analytics</TabsTrigger>
          <TabsTrigger value="alerts"     data-testid="tab-alerts" className="relative">
            Alerts
            {activeAlerts.length > 0 && (
              <span className="absolute -top-1 -right-1 h-4 w-4 flex items-center justify-center text-[10px] font-bold text-white bg-red-500 rounded-full">
                {activeAlerts.length > 9 ? "9+" : activeAlerts.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ── Overview ─────────────────────────────────────────────────────── */}
        <TabsContent value="overview" className="space-y-4 mt-4">
          <Card>
            <CardHeader><CardTitle>Routes Overview</CardTitle></CardHeader>
            <CardContent>
              <div className="grid gap-3">
                {routes.map(route => (
                  <div key={route.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div className="flex items-center gap-3">
                      {route.color && (
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: route.color }} />
                      )}
                      <div>
                        <p className="font-medium">{route.name}</p>
                        <p className="text-sm text-muted-foreground">Order: {route.displayOrder}</p>
                      </div>
                    </div>
                    <Badge variant={route.isActive ? "default" : "secondary"}>
                      {route.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Buses ────────────────────────────────────────────────────────── */}
        <TabsContent value="buses" className="space-y-4 mt-4">
          <div className="flex items-center justify-between gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search buses…"
                className="pl-9"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
            <Button className="gap-2" onClick={() => openAddDialog("bus")} data-testid="button-add-bus">
              <Plus className="h-4 w-4" /> Add Bus
            </Button>
          </div>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bus Number</TableHead>
                  <TableHead>Capacity</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {buses
                  .filter(b => b.number.toLowerCase().includes(searchQuery.toLowerCase()))
                  .map(bus => (
                    <TableRow key={bus.id}>
                      <TableCell className="font-medium">{bus.number}</TableCell>
                      <TableCell>{bus.capacity}</TableCell>
                      <TableCell>
                        <Badge variant={bus.isActive ? "default" : "secondary"}>
                          {bus.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost" size="icon"
                          onClick={() => deleteBus.mutate(bus.id)}
                          data-testid={`button-delete-bus-${bus.id}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* ── Drivers ──────────────────────────────────────────────────────── */}
        <TabsContent value="drivers" className="space-y-4 mt-4">
          <div className="flex items-center justify-between gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search drivers…" className="pl-9" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            </div>
          </div>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>License</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {drivers
                  .filter(d => (d.user?.name ?? d.user?.username ?? "").toLowerCase().includes(searchQuery.toLowerCase()))
                  .map(driver => (
                    <TableRow key={driver.id}>
                      <TableCell className="font-medium">{driver.user?.name ?? driver.user?.username ?? "—"}</TableCell>
                      <TableCell>{driver.user?.phone ?? "—"}</TableCell>
                      <TableCell>{driver.licenseNumber ?? "—"}</TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* ── Students ─────────────────────────────────────────────────────── */}
        <TabsContent value="students" className="space-y-4 mt-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search students…" className="pl-9" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
          </div>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>USN</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Preferred Stop</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students
                  .filter(s => (s.usn + (s.user?.name ?? "")).toLowerCase().includes(searchQuery.toLowerCase()))
                  .map(s => (
                    <TableRow key={s.id}>
                      <TableCell className="font-mono text-sm">{s.usn}</TableCell>
                      <TableCell>{s.user?.name ?? "—"}</TableCell>
                      <TableCell>{s.preferredStop ?? "—"}</TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* ── Routes management ────────────────────────────────────────────── */}
        <TabsContent value="routes" className="space-y-4 mt-4">
          <p className="text-sm text-muted-foreground">
            Toggle routes active/inactive and manage stops. Changes take effect immediately for drivers and students.
          </p>
          {routes.map(route => (
            <Card key={route.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    {route.color && <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: route.color }} />}
                    <CardTitle className="text-base">{route.name}</CardTitle>
                    <Badge variant={route.isActive ? "default" : "secondary"} className="text-xs">
                      {route.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline" size="sm"
                      onClick={() => toggleRoute.mutate({ id: route.id, isActive: route.isActive ?? true })}
                      className="gap-1 text-xs"
                    >
                      {route.isActive ? <ToggleRight className="h-4 w-4 text-green-500" /> : <ToggleLeft className="h-4 w-4" />}
                      {route.isActive ? "Deactivate" : "Activate"}
                    </Button>
                    <Button
                      variant="ghost" size="sm"
                      onClick={() => setExpandedRoute(expandedRoute === route.id ? null : route.id)}
                      className="gap-1 text-xs"
                    >
                      {expandedRoute === route.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      Stops
                    </Button>
                  </div>
                </div>
              </CardHeader>
              {expandedRoute === route.id && (
                <CardContent>
                  <div className="space-y-1 mb-3">
                    {expandedStops.map((stop, i) => (
                      <div key={stop.id} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted text-sm">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground w-5">{i + 1}.</span>
                          <span>{stop.name}</span>
                          {stop.isMainStop && <Badge variant="outline" className="text-[10px] h-4">Major</Badge>}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-muted-foreground">{stop.scheduledTime}</span>
                          <Button
                            variant="ghost" size="icon" className="h-6 w-6"
                            onClick={() => deleteStop.mutate(stop.id)}
                          >
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    {expandedStops.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">No stops found.</p>
                    )}
                  </div>
                  <Button
                    size="sm" variant="outline" className="gap-1 text-xs w-full"
                    onClick={() => { setAddStopRouteId(route.id); setIsAddStopOpen(true); }}
                  >
                    <Plus className="h-3 w-3" /> Add Stop
                  </Button>
                </CardContent>
              )}
            </Card>
          ))}
        </TabsContent>

        {/* ── Analytics ────────────────────────────────────────────────────── */}
        <TabsContent value="analytics" className="space-y-4 mt-4">
          {/* KPI cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-5">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg"><Clock className="h-5 w-5 text-blue-600" /></div>
                  <div>
                    <p className="text-2xl font-bold">{Math.round(analytics?.tripDuration?.avgMinutes ?? 0)}<span className="text-sm font-normal text-muted-foreground ml-1">min</span></p>
                    <p className="text-xs text-muted-foreground">Avg Trip Duration</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 rounded-lg"><Gauge className="h-5 w-5 text-green-600" /></div>
                  <div>
                    <p className="text-2xl font-bold">{(analytics?.avgSpeed?.avgSpeedKmh ?? 0).toFixed(1)}<span className="text-sm font-normal text-muted-foreground ml-1">km/h</span></p>
                    <p className="text-xs text-muted-foreground">Fleet Avg Speed</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 rounded-lg"><Bell className="h-5 w-5 text-purple-600" /></div>
                  <div>
                    <p className="text-2xl font-bold">{analytics?.notifStats?.totalSent ?? 0}</p>
                    <p className="text-xs text-muted-foreground">Notifications Sent</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Notification breakdown */}
          {(analytics?.notifStats?.byType?.length ?? 0) > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><BarChart2 className="h-4 w-4" />Notification Types</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={analytics!.notifStats.byType} margin={{ top: 0, right: 0, left: -20, bottom: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="type" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" interval={0} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="count" radius={[4,4,0,0]}>
                      {analytics!.notifStats.byType.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Driver performance */}
          {(analytics?.driverPunctuality?.length ?? 0) > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><TrendingUp className="h-4 w-4" />Driver Performance Scores</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={analytics!.driverPunctuality.slice(0, 10)} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="driverId" tick={{ fontSize: 10 }} tickFormatter={v => v.slice(0,6) + "…"} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: any, name: string) => [v, name === "performanceScore" ? "Score" : name]} />
                    <Bar dataKey="performanceScore" fill="#3b82f6" radius={[4,4,0,0]} name="Score" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Most delayed stops */}
          {(analytics?.delayedStops?.length ?? 0) > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="h-4 w-4" />Most Delayed Stops</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {analytics!.delayedStops.slice(0, 5).map((s, i) => (
                    <div key={i} className="flex items-center justify-between py-1.5 px-2 rounded bg-muted text-sm">
                      <span className="font-medium">{s.stopName}</span>
                      <Badge variant="outline" className="text-xs">
                        +{s.avgDelayMin.toFixed(1)} min avg
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {!analytics && (
            <div className="text-center py-12 text-muted-foreground">
              <BarChart2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>Analytics data will appear after buses complete trips.</p>
            </div>
          )}
        </TabsContent>

        {/* ── Alerts ───────────────────────────────────────────────────────── */}
        <TabsContent value="alerts" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold">Fleet Alert Center</h3>
              <p className="text-sm text-muted-foreground">{activeAlerts.length} active · {resolvedAlerts.length} resolved</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => refetchAlerts()} className="gap-1">
              <RefreshCw className="h-3 w-3" /> Refresh
            </Button>
          </div>
          <div className="space-y-3">
            {allAlerts.map(alert => (
              <Card key={alert.id} className={`border ${SEVERITY_STYLES[alert.severity] ?? ""}`}>
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">{ALERT_ICONS[alert.alertType] ?? <AlertTriangle className="h-4 w-4" />}</div>
                      <div>
                        <p className="font-medium text-sm">{formatAlertType(alert.alertType)}</p>
                        <p className="text-xs text-muted-foreground">{timeAgo(alert.timestamp)}</p>
                        {alert.details && (
                          <p className="text-xs mt-1 opacity-70 line-clamp-1">{alert.details}</p>
                        )}
                      </div>
                    </div>
                    {alert.status === "active" && (
                      <Button
                        size="sm" variant="outline" className="shrink-0 text-xs h-7"
                        onClick={() => acknowledgeAlert.mutate({ id: alert.id, status: "acknowledged" })}
                      >
                        Acknowledge
                      </Button>
                    )}
                    {alert.status === "acknowledged" && (
                      <Button
                        size="sm" variant="default" className="shrink-0 text-xs h-7"
                        onClick={() => acknowledgeAlert.mutate({ id: alert.id, status: "resolved" })}
                      >
                        Resolve
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
            {allAlerts.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <CheckCircle className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>No alerts — fleet is operating normally.</p>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* ── Add Bus dialog ─────────────────────────────────────────────────── */}
      <Dialog open={isAddDialogOpen && dialogType === "bus"} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Bus</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Bus Number / Plate</Label>
              <Input placeholder="KA-25-F-1234" value={newBusNumber} onChange={e => setNewBusNumber(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Capacity</Label>
              <Input type="number" placeholder="40" value={newBusCapacity} onChange={e => setNewBusCapacity(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => addBus.mutate({ number: newBusNumber, capacity: parseInt(newBusCapacity) || 40 })}
              disabled={!newBusNumber.trim() || addBus.isPending}
            >
              {addBus.isPending ? "Saving…" : "Add Bus"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Add Stop dialog ────────────────────────────────────────────────── */}
      <Dialog open={isAddStopOpen} onOpenChange={setIsAddStopOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Stop</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label>Stop Name</Label>
              <Input placeholder="e.g. Old Bus Stand" value={newStop.name} onChange={e => setNewStop(s => ({ ...s, name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Latitude</Label>
                <Input placeholder="15.3512" value={newStop.lat} onChange={e => setNewStop(s => ({ ...s, lat: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Longitude</Label>
                <Input placeholder="75.1421" value={newStop.lng} onChange={e => setNewStop(s => ({ ...s, lng: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Scheduled Time</Label>
                <Input placeholder="07:30" value={newStop.scheduledTime} onChange={e => setNewStop(s => ({ ...s, scheduledTime: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Sequence #</Label>
                <Input type="number" placeholder="1" value={newStop.sequence} onChange={e => setNewStop(s => ({ ...s, sequence: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddStopOpen(false)}>Cancel</Button>
            <Button
              onClick={() => {
                if (!addStopRouteId || !newStop.name || !newStop.lat || !newStop.lng) return;
                addStop.mutate({
                  routeId: addStopRouteId,
                  name: newStop.name,
                  lat: parseFloat(newStop.lat),
                  lng: parseFloat(newStop.lng),
                  scheduledTime: newStop.scheduledTime || "00:00",
                  sequence: parseInt(newStop.sequence) || 99,
                  isMainStop: false,
                  radius: 0.1,
                });
              }}
              disabled={addStop.isPending}
            >
              {addStop.isPending ? "Saving…" : "Add Stop"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
