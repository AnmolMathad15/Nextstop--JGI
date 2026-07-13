import { useEffect, useRef, useState, useCallback } from "react";

export interface LocationUpdate {
  tripId: string;
  routeId: number;
  busId: string;
  lat: number;
  lng: number;
  speed?: number;
  heading?: number;
  accuracy?: number;
  timestamp?: number;
  driverOnline?: boolean;
  snappedLat?: number;
  snappedLng?: number;
  roadSnapped?: boolean;
}

export interface ETAUpdate {
  tripId: string;
  routeId: number;
  nextStop: { id: number; name: string; lat: number; lng: number };
  etaMinutes: number;
  avgSpeedKmh: number;
  distanceKm: number;
  expectedArrival: string; // "HH:MM"
  routeProgress: {
    segmentIndex: number;
    distanceAlongKm: number;
    completedStopIds: number[];
  };
}

export type NotificationType =
  | "APPROACHING_10MIN"
  | "APPROACHING_5MIN"
  | "APPROACHING_2MIN"
  | "BUS_ARRIVING"
  | "BUS_DEPARTED"
  | "DELAYED"
  | "ROUTE_CHANGED"
  | "OVERSPEED"
  | "TRIP_STARTED"
  | "TRIP_COMPLETED";

export interface NotificationPayload {
  type: NotificationType;
  tripId: string;
  busId: string;
  routeId: number;
  stopId?: number;
  etaMinutes?: number;
  busName?: string;
  routeName?: string;
  stopName?: string;
  currentSpeed?: number;
  expectedArrival?: string;
}

export interface FleetAlertPayload {
  id: string;
  alertType: string;
  severity: string;
  tripId?: string;
  busId?: string;
  driverId?: string;
  lat?: number;
  lng?: number;
  details?: Record<string, unknown>;
  timestamp: number;
}

interface UseWebSocketOptions {
  role: "driver" | "student" | "admin";
  userId?: string;
  driverId?: string;
  routeId?: number;
  onLocationUpdate?: (location: LocationUpdate) => void;
  onETAUpdate?: (eta: ETAUpdate) => void;
  onNotification?: (n: NotificationPayload) => void;
  onBusOffline?: (tripId: string, routeId: number) => void;
  onFleetAlert?: (alert: FleetAlertPayload) => void;
}

export function useWebSocket(options: UseWebSocketOptions) {
  const {
    role, userId, driverId, routeId,
    onLocationUpdate, onETAUpdate, onNotification, onBusOffline, onFleetAlert,
  } = options;

  const wsRef            = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected]   = useState(false);
  const [tripId, setTripId]             = useState<string | null>(null);
  const [isPaused, setIsPaused]         = useState(false);
  const [locations, setLocations]       = useState<LocationUpdate[]>([]);
  const [fleetAlerts, setFleetAlerts]   = useState<FleetAlertPayload[]>([]);
  const [latestETA, setLatestETA]       = useState<ETAUpdate | null>(null);
  const reconnectTimeoutRef             = useRef<NodeJS.Timeout>();
  const isInitializedRef                = useRef(false);
  const offlineTimersRef                = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const markDriverOffline = useCallback((locTripId: string) => {
    setLocations(prev => prev.map(l => l.tripId === locTripId ? { ...l, driverOnline: false } : l));
  }, []);

  const scheduleOfflineDetection = useCallback((locTripId: string) => {
    const existing = offlineTimersRef.current.get(locTripId);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => markDriverOffline(locTripId), 15_000);
    offlineTimersRef.current.set(locTripId, timer);
  }, [markDriverOffline]);

  useEffect(() => {
    if (isInitializedRef.current) return;
    isInitializedRef.current = true;

    const connect = () => {
      if (wsRef.current?.readyState === WebSocket.OPEN) return;

      try {
        const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
        const host  = window.location.hostname || "localhost";
        const port  = window.location.port || (window.location.protocol === "https:" ? "443" : "80");
        const wsUrl = `${proto}//${host}${port && port !== "80" && port !== "443" ? `:${port}` : ""}/ws`;

        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          setIsConnected(true);
          ws.send(JSON.stringify({ type: "auth", role, userId, driverId }));
          if (role !== "driver" && routeId) {
            ws.send(JSON.stringify({ type: "subscribe", routeId }));
          }
          if (role === "admin") {
            ws.send(JSON.stringify({ type: "subscribe" }));
          }
        };

        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            switch (message.type) {
              case "auth:success":
                break;

              case "locations:init":
                setLocations((message.locations || []).map((l: LocationUpdate) => ({ ...l, driverOnline: true })));
                break;

              // gps:update is the new canonical event; bus:update kept for backward-compat
              case "gps:update":
              case "bus:update": {
                const loc: LocationUpdate = { ...message.location, driverOnline: true };
                setLocations(prev => {
                  const idx = prev.findIndex(l => l.tripId === loc.tripId);
                  if (idx >= 0) { const u = [...prev]; u[idx] = loc; return u; }
                  return [...prev, loc];
                });
                scheduleOfflineDetection(loc.tripId);
                onLocationUpdate?.(loc);
                break;
              }

              case "eta:update": {
                const eta = message as ETAUpdate & { type: string };
                setLatestETA(eta);
                onETAUpdate?.(eta);
                break;
              }

              case "notification": {
                onNotification?.(message.notification as NotificationPayload);
                break;
              }

              case "bus:offline":
                setLocations(prev => prev.filter(l => l.tripId !== message.tripId));
                offlineTimersRef.current.get(message.tripId) && clearTimeout(offlineTimersRef.current.get(message.tripId)!);
                offlineTimersRef.current.delete(message.tripId);
                onBusOffline?.(message.tripId, message.routeId);
                break;

              case "bus:paused":
                setLocations(prev => prev.map(l => l.tripId === message.tripId ? { ...l, driverOnline: false } : l));
                break;

              case "trip:started":
                setTripId(message.tripId);
                setIsPaused(false);
                break;

              case "trip:ended":
                setTripId(null);
                setIsPaused(false);
                setLatestETA(null);
                break;

              case "trip:paused":
                setIsPaused(true);
                break;

              case "trip:resumed":
                setIsPaused(false);
                break;

              case "fleet:alert": {
                const alert: FleetAlertPayload = message.alert;
                setFleetAlerts(prev => [alert, ...prev]);
                onFleetAlert?.(alert);
                break;
              }

              case "location:ack":
              case "panic:ack":
                break;

              case "error":
                console.error("WebSocket error:", message.message);
                break;
            }
          } catch (error) {
            console.error("Failed to parse WebSocket message:", error);
          }
        };

        ws.onclose = () => {
          setIsConnected(false);
          reconnectTimeoutRef.current = setTimeout(connect, 3000);
        };

        ws.onerror = () => {};
      } catch {
        reconnectTimeoutRef.current = setTimeout(connect, 3000);
      }
    };

    connect();

    return () => {
      isInitializedRef.current = false;
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      offlineTimersRef.current.forEach(t => clearTimeout(t));
      offlineTimersRef.current.clear();
      if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
    };
  }, [role, userId, driverId, routeId, onLocationUpdate, onETAUpdate, onNotification, onBusOffline, onFleetAlert, scheduleOfflineDetection]);

  const startTrip = useCallback((dId: string, busId: string, rId: number) => {
    wsRef.current?.readyState === WebSocket.OPEN &&
      wsRef.current.send(JSON.stringify({ type: "trip:start", driverId: dId, busId, routeId: rId }));
  }, []);

  const endTrip = useCallback((tId: string) => {
    wsRef.current?.readyState === WebSocket.OPEN &&
      wsRef.current.send(JSON.stringify({ type: "trip:end", tripId: tId }));
  }, []);

  const pauseTrip = useCallback((tId: string) => {
    wsRef.current?.readyState === WebSocket.OPEN &&
      wsRef.current.send(JSON.stringify({ type: "trip:pause", tripId: tId }));
  }, []);

  const resumeTrip = useCallback((tId: string) => {
    wsRef.current?.readyState === WebSocket.OPEN &&
      wsRef.current.send(JSON.stringify({ type: "trip:resume", tripId: tId }));
  }, []);

  const sendLocation = useCallback((
    rId: number, busId: string, lat: number, lng: number,
    speed?: number, heading?: number, accuracy?: number,
  ) => {
    if (wsRef.current?.readyState === WebSocket.OPEN && tripId && !isPaused) {
      wsRef.current.send(JSON.stringify({ type: "location:update", routeId: rId, busId, lat, lng, speed, heading, accuracy }));
    }
  }, [tripId, isPaused]);

  /** Send a driver panic signal to admins. */
  const sendPanic = useCallback((lat?: number, lng?: number) => {
    wsRef.current?.readyState === WebSocket.OPEN &&
      wsRef.current.send(JSON.stringify({ type: "driver:panic", tripId, lat, lng }));
  }, [tripId]);

  return {
    isConnected, tripId, isPaused, locations, fleetAlerts, latestETA,
    startTrip, endTrip, pauseTrip, resumeTrip, sendLocation, sendPanic,
  };
}
