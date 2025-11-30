import { useState } from "react";
import RibbonBar from "@/components/RibbonBar";
import AppHeader from "@/components/AppHeader";
import RouteSelector from "@/components/RouteSelector";
import BusMap from "@/components/BusMap";
import BottomNavigation from "@/components/BottomNavigation";
import NotificationCard from "@/components/NotificationCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Bell, Moon, Sun, Volume2, MessageSquare } from "lucide-react";
import backgroundImage from "@assets/jcet logo pic_1764501988672.jpg";

type NavItem = "map" | "routes" | "alerts" | "settings";

interface StudentPageProps {
  userName: string;
  onLogout: () => void;
}

const mockNotifications = [
  { type: "route" as const, title: "Route Update", message: "A new stop has been added to keshwapur route.", time: "10:30 AM" },
  { type: "location" as const, title: "Bus Approaching", message: "Your bus is 5 minutes away from Shakti Colony.", time: "7:25 AM" },
  { type: "general" as const, title: "Holiday Notice", message: "No bus service on December 25 due to Christmas holiday.", time: "Yesterday" },
];

export default function StudentPage({ userName, onLogout }: StudentPageProps) {
  const [activeNav, setActiveNav] = useState<NavItem>("routes");
  const [selectedRoute, setSelectedRoute] = useState<number | null>(null);
  const [selectedStop, setSelectedStop] = useState<string | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);

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

  const renderContent = () => {
    switch (activeNav) {
      case "map":
        if (selectedRoute && selectedStop) {
          return (
            <div className="relative" style={{ flex: 1, height: "calc(100vh - 200px)" }}>
              <Button
                size="icon"
                variant="ghost"
                onClick={handleBackToRoutes}
                className="absolute top-4 left-4 z-[1001] bg-white/90 shadow-md"
                data-testid="button-back-to-routes"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <BusMap routeId={selectedRoute} selectedStop={selectedStop} role="student" />
            </div>
          );
        }
        return (
          <div className="flex-1 flex items-center justify-center p-4">
            <Card className="max-w-sm text-center p-6">
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  Please select a route and stop first to view the live map.
                </p>
                <Button onClick={() => setActiveNav("routes")} data-testid="button-select-route">
                  Select Route
                </Button>
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
            <div className="space-y-3">
              {mockNotifications.map((notification, index) => (
                <NotificationCard
                  key={index}
                  type={notification.type}
                  title={notification.title}
                  message={notification.message}
                  time={notification.time}
                  onClick={() => console.log("Notification clicked:", notification.title)}
                />
              ))}
            </div>
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
                    <Switch
                      id="dark-mode"
                      checked={isDarkMode}
                      onCheckedChange={toggleDarkMode}
                      data-testid="switch-dark-mode"
                    />
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
                      <Bell className="h-4 w-4" />
                      <Label htmlFor="push-notifications">Push Notifications</Label>
                    </div>
                    <Switch id="push-notifications" defaultChecked data-testid="switch-push" />
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
    <div
      className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900"
      style={activeNav !== "map" || !selectedRoute ? {
        backgroundImage: `url(${backgroundImage})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
      } : undefined}
    >
      {activeNav !== "map" || !selectedRoute ? (
        <div className="absolute inset-0 bg-white/85 dark:bg-gray-900/85" />
      ) : null}
      
      <div className="relative z-10 flex flex-col min-h-screen">
        <RibbonBar />
        <AppHeader 
          userName={userName} 
          userRole="student" 
          onLogout={onLogout}
        />
        
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
