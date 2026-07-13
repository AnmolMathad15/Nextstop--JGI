/**
 * useWebSocket.ts
 *
 * Real-time hook with automatic REST-polling fallback for Vercel / serverless
 * environments where persistent WebSocket connections are unavailable.
 *
 * Strategy
 * ────────
 * 1. Always attempt a native WebSocket connection first.
 * 2. Track consecutive failures.  After MAX_WS_FAILURES (default 3) the hook
 *    switches to "polling mode":
 *      • Students / admins: GET /api/tracking/poll every POLL_INTERVAL_MS (3 s).
 *      • Drivers: trip lifecycle + location are sent via REST POST endpoints.
 * 3. `isPollingMode` is exposed so the UI can show an indicator.
 */

import { useEffect, useRef, useState, useCallback } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

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

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_WS_FAILURES   = 3;   // consecutive WS errors before falling back
const POLL_INTERVAL_MS  = 3000; // polling cadence for students / admins
const WS_RECONNECT_MS   = 3000;

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useWebSocket(options: UseWebSocketOptions) {
  const {
    role, userId, driverId, routeId,
    onLocationUpdate, onETAUpdate, onNotification, onBusOffline, onFleetAlert,
  } = options;

  const wsRef                = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected]     = useState(false);
  const [isPollingMode, setIsPollingMode] = useState(false);
  const [tripId, setTripId]               = useState<string | null>(null);
  const [isPaused, setIsPaused]           = useState(false);
  const [locations, setLocations]         = useState<LocationUpdate[]>([]);
  const [fleetAlerts, setFleetAlerts]     = useState<FleetAlertPayload[]>([]);
  const [latestETA, setLatestETA]         = useState<ETAUpdate | null>(null);

  const reconnectTimerRef  = useRef<NodeJS.Timeout>();
  const pollTimerRef       = useRef<NodeJS.Timeout>();
  const failureCountRef    = useRef(0);
  const isInitializedRef   = useRef(false);
  const offlineTimersRef   = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const isPollingModeRef   = useRef(false); // sync ref for callbacks

  // ── Offline-detection helpers ──────────────────────────────────────────────

  const markDriverOffline = useCallback((locTripId: string) => {
    setLocations(prev => prev.map(l =>
      l.tripId === locTripId ? { ...l, driverOnline: false } : l,
    ));
  }, []);

  const scheduleOfflineDetection = useCallback((locTripId: string) => {
    const existing = offlineTimersRef.current.get(locTripId);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => markDriverOffline(locTripId), 15_000);
    offlineTimersRef.current.set(locTripId, timer);
  }, [markDriverOffline]);

  // ── REST polling (student / admin fallback) ───────────────────────────────

  const startPolling = useCallback(() => {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);

    const poll = async () => {
      try {
        const res  = await fetch("/api/tracking/poll");
        const data = (await res.json()) as LocationUpdate[];
        if (Array.isArray(data) && data.length > 0) {
          setLocations(prev => {
            let next = [...prev];
            for (const loc of data) {
              const withOnline = { ...loc, driverOnline: true };
              const idx = next.findIndex(l => l.tripId === loc.tripId);
              if (idx >= 0) next[idx] = withOnline;
              else next = [...next, withOnline];
              scheduleOfflineDetection(loc.tripId);
              onLocationUpdate?.(withOnline);
            }
            return next;
          });
        }
      } catch {
        // ignore transient network errors in polling mode
      }
    };

    poll(); // immediate first call
    pollTimerRef.current = setInterval(poll, POLL_INTERVAL_MS);
  }, [onLocationUpdate, scheduleOfflineDetection]);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = undefined;
    }
  }, []);

  // ── WebSocket connection ──────────────────────────────────────────────────

  useEffect(() => {
    if (isInitializedRef.current) return;
    isInitializedRef.current = true;

    const connect = () => {
      if (wsRef.current?.readyState === WebSocket.OPEN) return;
      if (isPollingModeRef.current) return; // already in polling mode

      try {
        const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
        const host  = window.location.host; // includes port when non-standard
        const wsUrl = `${proto}//${host}/ws`;

        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          failureCountRef.current = 0;
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
            const message = JSON.parse(event.data as string);
            handleMessage(message);
          } catch {
            // ignore malformed frames
          }
        };

        ws.onclose = () => {
          setIsConnected(false);
          failureCountRef.current += 1;

          if (failureCountRef.current >= MAX_WS_FAILURES) {
            // Switch to polling mode permanently for this session
            isPollingModeRef.current = true;
            setIsPollingMode(true);
            if (role !== "driver") startPolling();
          } else {
            reconnectTimerRef.current = setTimeout(connect, WS_RECONNECT_MS);
          }
        };

        ws.onerror = () => {
          // onclose fires after onerror — failure counted there
        };
      } catch {
        failureCountRef.current += 1;
        reconnectTimerRef.current = setTimeout(connect, WS_RECONNECT_MS);
      }
    };

    const handleMessage = (message: Record<string, unknown>) => {
      switch (message.type) {
        case "auth:success":
          break;

        case "locations:init":
          setLocations(
            ((message.locations as LocationUpdate[]) || []).map(l => ({
              ...l, driverOnline: true,
            })),
          );
          break;

        case "gps:update":
        case "bus:update": {
          const loc: LocationUpdate = {
            ...(message.location as LocationUpdate), driverOnline: true,
          };
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
          const eta = message as unknown as ETAUpdate;
          setLatestETA(eta);
          onETAUpdate?.(eta);
          break;
        }

        case "notification":
          onNotification?.(message.notification as NotificationPayload);
          break;

        case "bus:offline":
          setLocations(prev =>
            prev.filter(l => l.tripId !== (message.tripId as string)),
          );
          {
            const t = offlineTimersRef.current.get(message.tripId as string);
            if (t) { clearTimeout(t); offlineTimersRef.current.delete(message.tripId as string); }
          }
          onBusOffline?.(message.tripId as string, message.routeId as number);
          break;

        case "bus:paused":
          setLocations(prev =>
            prev.map(l => l.tripId === message.tripId ? { ...l, driverOnline: false } : l),
          );
          break;

        case "trip:started":
          setTripId(message.tripId as string);
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
          const alert = message.alert as FleetAlertPayload;
          setFleetAlerts(prev => [alert, ...prev]);
          onFleetAlert?.(alert);
          break;
        }

        case "location:ack":
        case "panic:ack":
          break;

        case "error":
          console.error("WebSocket error from server:", message.message);
          break;
      }
    };

    connect();

    return () => {
      isInitializedRef.current = false;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      stopPolling();
      offlineTimersRef.current.forEach(t => clearTimeout(t));
      offlineTimersRef.current.clear();
      if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
    };
  }, [
    role, userId, driverId, routeId,
    onLocationUpdate, onETAUpdate, onNotification, onBusOffline, onFleetAlert,
    scheduleOfflineDetection, startPolling, stopPolling,
  ]);

  // ── Driver actions — WS first, REST fallback ──────────────────────────────

  const restPost = useCallback(async (path: string, body: unknown) => {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.json();
  }, []);

  const wsSend = useCallback((payload: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload));
      return true;
    }
    return false;
  }, []);

  const startTrip = useCallback(async (dId: string, busId: string, rId: number) => {
    if (wsSend({ type: "trip:start", driverId: dId, busId, routeId: rId })) return;
    // REST fallback
    const data = await restPost("/api/driver/trip/start", { driverId: dId, busId, routeId: rId });
    if (data?.tripId) setTripId(data.tripId);
  }, [wsSend, restPost]);

  const endTrip = useCallback(async (tId: string) => {
    if (wsSend({ type: "trip:end", tripId: tId })) return;
    await restPost("/api/driver/trip/end", { tripId: tId });
    setTripId(null);
    setIsPaused(false);
  }, [wsSend, restPost]);

  const pauseTrip = useCallback(async (tId: string) => {
    if (wsSend({ type: "trip:pause", tripId: tId })) return;
    await restPost("/api/driver/trip/pause", { tripId: tId });
    setIsPaused(true);
  }, [wsSend, restPost]);

  const resumeTrip = useCallback(async (tId: string) => {
    if (wsSend({ type: "trip:resume", tripId: tId })) return;
    await restPost("/api/driver/trip/resume", { tripId: tId });
    setIsPaused(false);
  }, [wsSend, restPost]);

  const sendLocation = useCallback(async (
    rId: number, busId: string, lat: number, lng: number,
    speed?: number, heading?: number, accuracy?: number,
  ) => {
    const tId = tripId;
    if (!tId || isPaused) return;

    if (wsSend({ type: "location:update", routeId: rId, busId, lat, lng, speed, heading, accuracy })) return;
    // REST fallback (Vercel polling mode)
    await restPost("/api/driver/location", {
      tripId: tId, routeId: rId, busId, lat, lng, speed, heading, accuracy,
    });
  }, [tripId, isPaused, wsSend, restPost]);

  const sendPanic = useCallback(async (lat?: number, lng?: number) => {
    wsSend({ type: "driver:panic", tripId, lat, lng });
    // No REST equivalent for panic yet — requires WS to reach admins live
  }, [tripId, wsSend]);

  // ── Public API ─────────────────────────────────────────────────────────────

  return {
    isConnected,
    isPollingMode,
    tripId,
    isPaused,
    locations,
    fleetAlerts,
    latestETA,
    startTrip,
    endTrip,
    pauseTrip,
    resumeTrip,
    sendLocation,
    sendPanic,
  };
}
