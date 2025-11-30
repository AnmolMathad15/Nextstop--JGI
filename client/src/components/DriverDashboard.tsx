import { useState, useEffect, useCallback } from "react";
import { Play, Square, MapPin, Navigation, Wifi, WifiOff, Clock, Users, Route } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { useWebSocket } from "@/hooks/useWebSocket";

interface DriverDashboardProps {
  driverName: string;
  driverId: string;
  assignedBusId?: string;
}

interface Bus {
  id: string;
  number: string;
  capacity: number;
  isActive: boolean;
}

interface RouteData {
  id: number;
  name: string;
  displayOrder: number;
  isActive: boolean;
}

export default function DriverDashboard({ driverName, driverId, assignedBusId }: DriverDashboardProps) {
  const [selectedBus, setSelectedBus] = useState<string>(assignedBusId || "");
  const [selectedRoute, setSelectedRoute] = useState<string>("");
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [tripStartTime, setTripStartTime] = useState<Date | null>(null);
  const [locationSentCount, setLocationSentCount] = useState(0);
  const [tripDuration, setTripDuration] = useState("0:00");

  const { data: buses = [] } = useQuery<Bus[]>({
    queryKey: ["/api/buses"],
  });

  const { data: routes = [] } = useQuery<RouteData[]>({
    queryKey: ["/api/routes"],
  });

  const { isConnected, tripId, startTrip, endTrip, sendLocation } = useWebSocket({
    role: "driver",
    userId: driverId,
  });

  const isTripActive = !!tripId;

  useEffect(() => {
    let watchId: number;
    
    if (isTripActive && selectedRoute && selectedBus) {
      watchId = navigator.geolocation.watchPosition(
        (position) => {
          const { latitude, longitude, speed, heading, accuracy } = position.coords;
          setCurrentLocation({ lat: latitude, lng: longitude });
          setLocationSentCount((prev) => prev + 1);
          
          sendLocation(
            parseInt(selectedRoute),
            selectedBus,
            latitude,
            longitude,
            speed ?? undefined,
            heading ?? undefined,
            accuracy ?? undefined
          );
        },
        (error) => {
          console.error("Geolocation error:", error);
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
    }

    return () => {
      if (watchId) navigator.geolocation.clearWatch(watchId);
    };
  }, [isTripActive, selectedRoute, selectedBus, sendLocation]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (tripStartTime) {
      interval = setInterval(() => {
        const diff = Date.now() - tripStartTime.getTime();
        const minutes = Math.floor(diff / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);
        setTripDuration(`${minutes}:${seconds.toString().padStart(2, "0")}`);
      }, 1000);
    }

    return () => clearInterval(interval);
  }, [tripStartTime]);

  const handleStartTrip = useCallback(() => {
    if (!selectedBus || !selectedRoute) {
      alert("Please select a bus and route first");
      return;
    }
    startTrip(driverId, selectedBus, parseInt(selectedRoute));
    setTripStartTime(new Date());
    setLocationSentCount(0);
  }, [selectedBus, selectedRoute, driverId, startTrip]);

  const handleEndTrip = useCallback(() => {
    if (tripId) {
      endTrip(tripId);
      setTripStartTime(null);
      setCurrentLocation(null);
    }
  }, [tripId, endTrip]);

  const selectedRouteData = routes.find((r) => r.id.toString() === selectedRoute);

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-4 pb-24">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white" data-testid="text-driver-welcome">
            Hello, {driverName}
          </h2>
          <p className="text-sm text-muted-foreground">ID: {driverId}</p>
        </div>
        <Badge variant={isConnected ? "default" : "destructive"} className="gap-1">
          {isConnected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
          {isConnected ? "Connected" : "Offline"}
        </Badge>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Select Bus & Route</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium text-muted-foreground mb-2 block">Bus Number</label>
            <Select value={selectedBus} onValueChange={setSelectedBus} disabled={isTripActive}>
              <SelectTrigger data-testid="select-bus">
                <SelectValue placeholder="Select a bus" />
              </SelectTrigger>
              <SelectContent>
                {buses.filter(b => b.isActive).map((bus) => (
                  <SelectItem key={bus.id} value={bus.id}>
                    {bus.number}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium text-muted-foreground mb-2 block">Assigned Route</label>
            <Select value={selectedRoute} onValueChange={setSelectedRoute} disabled={isTripActive}>
              <SelectTrigger data-testid="select-route">
                <SelectValue placeholder="Select a route" />
              </SelectTrigger>
              <SelectContent>
                {routes.filter(r => r.isActive).map((route) => (
                  <SelectItem key={route.id} value={route.id.toString()}>
                    {route.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {isTripActive && (
        <Card className="border-2 border-green-500 bg-green-50 dark:bg-green-950">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <Badge className="bg-green-500 text-white gap-1 animate-pulse">
                <MapPin className="h-3 w-3" />
                Trip Active - Broadcasting Live
              </Badge>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span data-testid="text-trip-duration">{tripDuration}</span>
              </div>
            </div>

            {currentLocation && (
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div className="text-center p-3 bg-white dark:bg-gray-800 rounded-lg">
                  <p className="text-xs text-muted-foreground">Latitude</p>
                  <p className="font-mono text-sm" data-testid="text-latitude">{currentLocation.lat.toFixed(6)}</p>
                </div>
                <div className="text-center p-3 bg-white dark:bg-gray-800 rounded-lg">
                  <p className="text-xs text-muted-foreground">Longitude</p>
                  <p className="font-mono text-sm" data-testid="text-longitude">{currentLocation.lng.toFixed(6)}</p>
                </div>
              </div>
            )}

            <p className="text-center text-sm text-green-600 dark:text-green-400 mt-4" data-testid="text-location-count">
              Location updates sent: {locationSentCount}
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-3 gap-3">
        <Card className="text-center p-4">
          <Route className="h-6 w-6 mx-auto mb-2 text-primary" />
          <p className="text-2xl font-bold" data-testid="text-stops-count">
            {selectedRouteData ? 10 : 0}
          </p>
          <p className="text-xs text-muted-foreground">Stops</p>
        </Card>
        <Card className="text-center p-4">
          <Users className="h-6 w-6 mx-auto mb-2 text-blue-500" />
          <p className="text-2xl font-bold">24</p>
          <p className="text-xs text-muted-foreground">Students</p>
        </Card>
        <Card className="text-center p-4">
          <Navigation className="h-6 w-6 mx-auto mb-2 text-green-500" />
          <p className="text-2xl font-bold">2.5</p>
          <p className="text-xs text-muted-foreground">km left</p>
        </Card>
      </div>

      <div className="fixed bottom-20 left-4 right-4">
        {!isTripActive ? (
          <Button
            onClick={handleStartTrip}
            className="w-full py-6 bg-green-500 hover:bg-green-600 text-white font-bold text-lg gap-2"
            disabled={!selectedBus || !selectedRoute || !isConnected}
            data-testid="button-start-trip"
          >
            <Play className="h-5 w-5" />
            Start Trip
          </Button>
        ) : (
          <Button
            onClick={handleEndTrip}
            variant="destructive"
            className="w-full py-6 font-bold text-lg gap-2"
            data-testid="button-end-trip"
          >
            <Square className="h-5 w-5" />
            End Trip
          </Button>
        )}
      </div>
    </div>
  );
}
