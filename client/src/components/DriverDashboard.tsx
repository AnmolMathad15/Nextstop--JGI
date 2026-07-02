import { useState, useEffect, useCallback, useRef } from "react";
import {
  Play, Square, Pause, RotateCcw, MapPin, Navigation,
  Wifi, WifiOff, Clock, Users, Route, Gauge, Signal,
  AlertTriangle, CheckCircle, BatteryLow,
} from "lucide-react";
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

interface Bus     { id: string; number: string; capacity: number; isActive: boolean; }
interface RouteData { id: number; name: string; displayOrder: number; isActive: boolean; }

interface GPSState {
  lat: number;
  lng: number;
  speed: number | null;
  heading: number | null;
  accuracy: number | null;
  status: "waiting" | "good" | "poor" | "error";
}

export default function DriverDashboard({ driverName, driverId, assignedBusId }: DriverDashboardProps) {
  const [selectedBus,    setSelectedBus]    = useState<string>(assignedBusId || "");
  const [selectedRoute,  setSelectedRoute]  = useState<string>("");
  const [gps,            setGps]            = useState<GPSState | null>(null);
  const [tripStartTime,  setTripStartTime]  = useState<Date | null>(null);
  const [locationSentCount, setLocationSentCount] = useState(0);
  const [tripDuration,   setTripDuration]   = useState("0:00");

  // Battery optimisation: track last transmitted position
  const lastSentRef    = useRef<{ lat: number; lng: number; ts: number } | null>(null);
  const watchIdRef     = useRef<number | null>(null);
  const MIN_MOVE_KM    = 0.01; // 10 meters
  const MIN_INTERVAL_MS = 2_000;

  const { data: buses  = [] } = useQuery<Bus[]>({ queryKey: ["/api/buses"] });
  const { data: routes = [] } = useQuery<RouteData[]>({ queryKey: ["/api/routes"] });

  const { isConnected, tripId, isPaused, startTrip, endTrip, pauseTrip, resumeTrip, sendLocation } = useWebSocket({
    role: "driver",
    userId: driverId,
    driverId,
  });

  const isTripActive = !!tripId;

  // ── GPS watch ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isTripActive || !selectedRoute || !selectedBus) return;

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, speed, heading, accuracy } = pos.coords;
        const isGoodAccuracy = accuracy === null || accuracy <= 20;

        setGps({
          lat: latitude,
          lng: longitude,
          speed: speed !== null ? speed * 3.6 : null, // m/s → km/h
          heading,
          accuracy,
          status: isGoodAccuracy ? "good" : "poor",
        });

        if (isPaused) return; // don't send when paused

        // Battery optimisation: skip if not enough movement or too frequent
        const now = Date.now();
        const last = lastSentRef.current;
        if (last) {
          const R = 6371;
          const dLat = ((latitude - last.lat) * Math.PI) / 180;
          const dLon = ((longitude - last.lng) * Math.PI) / 180;
          const a = Math.sin(dLat / 2) ** 2 +
            Math.cos((last.lat * Math.PI) / 180) * Math.cos((latitude * Math.PI) / 180) *
            Math.sin(dLon / 2) ** 2;
          const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          const elapsed = now - last.ts;

          // Skip if < 10m moved AND < 2s elapsed (stationary battery saver)
          if (dist < MIN_MOVE_KM && elapsed < MIN_INTERVAL_MS) return;
        }

        lastSentRef.current = { lat: latitude, lng: longitude, ts: now };
        setLocationSentCount(c => c + 1);

        sendLocation(
          parseInt(selectedRoute),
          selectedBus,
          latitude,
          longitude,
          speed !== null ? speed * 3.6 : undefined,
          heading ?? undefined,
          accuracy ?? undefined,
        );
      },
      (err) => {
        console.error("Geolocation error:", err);
        setGps(prev => prev ? { ...prev, status: "error" } : null);
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 }
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [isTripActive, selectedRoute, selectedBus, isPaused, sendLocation]);

  // ── Trip timer ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!tripStartTime) return;
    const interval = setInterval(() => {
      const diff = Date.now() - tripStartTime.getTime();
      const m = Math.floor(diff / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTripDuration(`${m}:${s.toString().padStart(2, "0")}`);
    }, 1000);
    return () => clearInterval(interval);
  }, [tripStartTime]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleStartTrip = useCallback(() => {
    if (!selectedBus || !selectedRoute) {
      alert("Please select a bus and route first");
      return;
    }
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser");
      return;
    }
    setGps(g => g ? { ...g, status: "waiting" } : { lat: 0, lng: 0, speed: null, heading: null, accuracy: null, status: "waiting" });
    startTrip(driverId, selectedBus, parseInt(selectedRoute));
    setTripStartTime(new Date());
    setLocationSentCount(0);
    lastSentRef.current = null;
  }, [selectedBus, selectedRoute, driverId, startTrip]);

  const handleEndTrip = useCallback(() => {
    if (tripId) {
      endTrip(tripId);
      setTripStartTime(null);
      setGps(null);
      lastSentRef.current = null;
    }
  }, [tripId, endTrip]);

  const handlePause = useCallback(() => { if (tripId) pauseTrip(tripId); }, [tripId, pauseTrip]);
  const handleResume = useCallback(() => { if (tripId) resumeTrip(tripId); }, [tripId, resumeTrip]);

  const selectedRouteData = routes.find(r => r.id.toString() === selectedRoute);

  // GPS status helpers
  const gpsStatusColor = {
    waiting: "text-yellow-500",
    good:    "text-green-500",
    poor:    "text-orange-500",
    error:   "text-red-500",
  };
  const gpsStatusLabel = {
    waiting: "Acquiring GPS…",
    good:    "GPS Lock ✓",
    poor:    "Weak Signal",
    error:   "GPS Error",
  };

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-4 pb-36">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
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

      {/* Bus & Route selector */}
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
                {buses.filter(b => b.isActive).map(bus => (
                  <SelectItem key={bus.id} value={bus.id}>{bus.number}</SelectItem>
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
                {routes.filter(r => r.isActive).map(route => (
                  <SelectItem key={route.id} value={route.id.toString()}>{route.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Active trip panel */}
      {isTripActive && (
        <Card className={`border-2 ${isPaused ? "border-yellow-400 bg-yellow-50 dark:bg-yellow-950" : "border-green-500 bg-green-50 dark:bg-green-950"}`}>
          <CardContent className="pt-6 space-y-4">
            {/* Status row */}
            <div className="flex items-center justify-between">
              <Badge className={`gap-1 ${isPaused ? "bg-yellow-500" : "bg-green-500"} text-white animate-pulse`}>
                <MapPin className="h-3 w-3" />
                {isPaused ? "Trip Paused" : "Broadcasting Live"}
              </Badge>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span data-testid="text-trip-duration">{tripDuration}</span>
              </div>
            </div>

            {/* GPS status */}
            {gps && (
              <div className="space-y-3">
                <div className={`flex items-center gap-2 text-sm font-medium ${gpsStatusColor[gps.status]}`}>
                  <Signal className="h-4 w-4" />
                  <span data-testid="text-gps-status">{gpsStatusLabel[gps.status]}</span>
                  {gps.accuracy !== null && (
                    <span className="text-xs text-muted-foreground ml-auto">
                      ±{gps.accuracy.toFixed(0)}m
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="text-center p-3 bg-white dark:bg-gray-800 rounded-lg">
                    <p className="text-xs text-muted-foreground">Latitude</p>
                    <p className="font-mono text-sm" data-testid="text-latitude">{gps.lat.toFixed(6)}</p>
                  </div>
                  <div className="text-center p-3 bg-white dark:bg-gray-800 rounded-lg">
                    <p className="text-xs text-muted-foreground">Longitude</p>
                    <p className="font-mono text-sm" data-testid="text-longitude">{gps.lng.toFixed(6)}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="text-center p-3 bg-white dark:bg-gray-800 rounded-lg flex items-center gap-2 justify-center">
                    <Gauge className="h-4 w-4 text-primary" />
                    <div>
                      <p className="text-xs text-muted-foreground">Speed</p>
                      <p className="font-semibold text-sm" data-testid="text-speed">
                        {gps.speed !== null ? `${gps.speed.toFixed(1)} km/h` : "—"}
                      </p>
                    </div>
                  </div>
                  <div className="text-center p-3 bg-white dark:bg-gray-800 rounded-lg flex items-center gap-2 justify-center">
                    <Navigation className="h-4 w-4 text-primary" />
                    <div>
                      <p className="text-xs text-muted-foreground">Heading</p>
                      <p className="font-semibold text-sm" data-testid="text-heading">
                        {gps.heading !== null ? `${gps.heading.toFixed(0)}°` : "—"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Accuracy warning */}
            {gps?.status === "poor" && (
              <div className="flex items-center gap-2 text-sm text-orange-600 bg-orange-50 rounded-lg p-2">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                <span>Weak GPS signal (±{gps.accuracy?.toFixed(0)}m). Move to open area.</span>
              </div>
            )}

            <p className="text-center text-sm text-muted-foreground" data-testid="text-location-count">
              Updates sent: <span className="font-semibold text-primary">{locationSentCount}</span>
            </p>
          </CardContent>
        </Card>
      )}

      {/* Stats cards */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="text-center p-4">
          <Route className="h-6 w-6 mx-auto mb-2 text-primary" />
          <p className="text-2xl font-bold" data-testid="text-stops-count">
            {selectedRouteData ? "—" : 0}
          </p>
          <p className="text-xs text-muted-foreground">Stops</p>
        </Card>
        <Card className="text-center p-4">
          <Users className="h-6 w-6 mx-auto mb-2 text-blue-500" />
          <p className="text-2xl font-bold">—</p>
          <p className="text-xs text-muted-foreground">Students</p>
        </Card>
        <Card className="text-center p-4">
          <BatteryLow className="h-6 w-6 mx-auto mb-2 text-green-500" />
          <p className="text-2xl font-bold text-xs pt-1">
            {isPaused ? "Paused" : isTripActive ? "Active" : "Idle"}
          </p>
          <p className="text-xs text-muted-foreground">GPS Mode</p>
        </Card>
      </div>

      {/* Trip controls — fixed bottom bar */}
      <div className="fixed bottom-20 left-4 right-4 space-y-2">
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
          <div className="flex gap-2">
            {/* Pause / Resume */}
            {!isPaused ? (
              <Button
                onClick={handlePause}
                variant="outline"
                className="flex-1 py-6 font-bold text-base gap-2 border-yellow-400 text-yellow-600 hover:bg-yellow-50"
                data-testid="button-pause-trip"
              >
                <Pause className="h-5 w-5" />
                Pause
              </Button>
            ) : (
              <Button
                onClick={handleResume}
                className="flex-1 py-6 bg-blue-500 hover:bg-blue-600 text-white font-bold text-base gap-2"
                data-testid="button-resume-trip"
              >
                <RotateCcw className="h-5 w-5" />
                Resume
              </Button>
            )}
            {/* End trip */}
            <Button
              onClick={handleEndTrip}
              variant="destructive"
              className="flex-1 py-6 font-bold text-base gap-2"
              data-testid="button-end-trip"
            >
              <Square className="h-5 w-5" />
              End Trip
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
