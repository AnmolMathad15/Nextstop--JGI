import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";
import { storage } from "./storage";
import {
  validateLocation,
  checkGeofences,
  checkOperationalGeofence,
  calculateSpeed,
  haversineKm,
  type RawLocationInput,
  type ProcessedLocation,
  type LocationAlert,
} from "./locationService";
import { snapToRoad, clearMapMatchState } from "../mapMatching";

interface LocationUpdate {
  tripId: string;
  routeId: number;
  busId: string;
  lat: number;
  lng: number;
  speed?: number;
  heading?: number;
  accuracy?: number;
  timestamp?: number;
}

interface ClientInfo {
  role: "driver" | "student" | "admin";
  userId?: string;
  driverId?: string;
  tripId?: string;
  routeId?: number;
}

const clients = new Map<WebSocket, ClientInfo>();
const latestLocations = new Map<string, ProcessedLocation>();

// Offline detection: track last update time per tripId
const lastUpdateTime = new Map<string, number>();
const offlineCheckIntervals = new Map<string, NodeJS.Timeout>();
const OFFLINE_THRESHOLD_MS = 15_000;

export function setupWebSocket(server: Server) {
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws: WebSocket) => {
    ws.on("message", async (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        switch (message.type) {
          case "auth":           handleAuth(ws, message); break;
          case "subscribe":      handleSubscribe(ws, message); break;
          case "location:update": await handleLocationUpdate(ws, message, wss); break;
          case "trip:start":     await handleTripStart(ws, message, wss); break;
          case "trip:end":       await handleTripEnd(ws, message, wss); break;
          case "trip:pause":     await handleTripPause(ws, message, wss); break;
          case "trip:resume":    await handleTripResume(ws, message, wss); break;
        }
      } catch (error) {
        console.error("WebSocket message error:", error);
        ws.send(JSON.stringify({ type: "error", message: "Invalid message format" }));
      }
    });

    ws.on("close", () => {
      const info = clients.get(ws);
      if (info?.tripId) {
        clearOfflineTimer(info.tripId);
        latestLocations.delete(info.tripId);
        lastUpdateTime.delete(info.tripId);
        clearMapMatchState(info.tripId);
      }
      clients.delete(ws);
    });

    ws.on("error", (err) => console.error("WebSocket error:", err));
  });

  console.log("WebSocket server initialized on /ws");
  return wss;
}

// ── Auth & Subscribe ────────────────────────────────────────────────────────

function handleAuth(ws: WebSocket, message: { role: string; userId?: string; driverId?: string }) {
  const info: ClientInfo = {
    role: message.role as ClientInfo["role"],
    userId: message.userId,
    driverId: message.driverId,
  };
  clients.set(ws, info);
  ws.send(JSON.stringify({ type: "auth:success", role: info.role }));
}

function handleSubscribe(ws: WebSocket, message: { routeId?: number }) {
  const info = clients.get(ws);
  if (!info) return;
  info.routeId = message.routeId;
  clients.set(ws, info);

  const all = Array.from(latestLocations.values());
  const filtered = message.routeId ? all.filter(l => l.routeId === message.routeId) : all;
  ws.send(JSON.stringify({ type: "locations:init", locations: filtered }));
}

// ── Location Update ─────────────────────────────────────────────────────────

async function handleLocationUpdate(ws: WebSocket, message: LocationUpdate, wss: WebSocketServer) {
  const info = clients.get(ws);
  if (info?.role !== "driver" || !info.tripId) {
    ws.send(JSON.stringify({ type: "error", message: "Not authorized to send location updates" }));
    return;
  }

  const prev = latestLocations.get(info.tripId);

  const raw: RawLocationInput = {
    tripId: info.tripId,
    routeId: message.routeId,
    busId: message.busId,
    driverId: info.driverId || "",
    lat: message.lat,
    lng: message.lng,
    speed: message.speed,
    heading: message.heading,
    accuracy: message.accuracy,
    timestamp: Date.now(),
    provider: "mobile_gps",
  };

  const validated = validateLocation(raw, prev);
  if (!validated.isValid) {
    // Silently drop invalid points — don't penalise the driver
    return;
  }

  const speed = calculateSpeed(prev, { lat: raw.lat, lng: raw.lng, timestamp: raw.timestamp!, speed: raw.speed });

  const processed: ProcessedLocation = {
    tripId: info.tripId,
    routeId: message.routeId,
    busId: message.busId,
    driverId: info.driverId || "",
    lat: validated.lat,
    lng: validated.lng,
    speed,
    heading: message.heading,
    accuracy: message.accuracy,
    timestamp: validated.timestamp,
    provider: "mobile_gps",
  };

  lastUpdateTime.set(info.tripId, Date.now());
  scheduleOfflineCheck(info.tripId, wss, message.routeId);

  // Persist to DB (fire-and-forget, don't block broadcast)
  storage.appendLiveLocation({
    tripId: info.tripId,
    lat: processed.lat,
    lng: processed.lng,
    speed: processed.speed,
    heading: processed.heading,
    accuracy: processed.accuracy,
  }).catch(console.error);

  // Road-snap for display — raw `processed` (unsnapped) still drives geofencing/
  // analytics below, so stop-arrival logic is never affected by a bad map-match.
  const snap = await snapToRoad(info.tripId, processed.lat, processed.lng, processed.timestamp);
  const displayLocation = { ...processed, snappedLat: snap.lat, snappedLng: snap.lng, roadSnapped: snap.snapped };
  latestLocations.set(info.tripId, displayLocation);

  // Broadcast bus:update to relevant subscribers
  const broadcastPayload = JSON.stringify({ type: "bus:update", location: displayLocation });
  wss.clients.forEach(client => {
    if (client !== ws && client.readyState === WebSocket.OPEN) {
      const ci = clients.get(client);
      if (ci && (ci.role === "admin" || ci.routeId === message.routeId)) {
        client.send(broadcastPayload);
      }
    }
  });

  ws.send(JSON.stringify({ type: "location:ack" }));

  // Analytics (non-blocking)
  runAnalytics(info, processed, prev, wss).catch(console.error);
}

// ── Analytics: geofencing + rash driving + operational area ────────────────

async function runAnalytics(
  info: ClientInfo,
  current: ProcessedLocation,
  prev: ProcessedLocation | undefined,
  wss: WebSocketServer,
) {
  if (!info.driverId) return;

  // 1. Driver stats
  const stats = await storage.getDriverStats(info.driverId) || {
    driverId: info.driverId, totalDistance: 0, avgSpeed: 0, overspeedCount: 0, performanceScore: 100,
  };
  if (prev) {
    stats.totalDistance = (stats.totalDistance || 0) + haversineKm(prev.lat, prev.lng, current.lat, current.lng);
  }
  const route = await storage.getRoute(current.routeId);
  const speedLimit = route?.speedLimit ?? 40;
  if (current.speed > speedLimit) stats.overspeedCount = (stats.overspeedCount || 0) + 1;
  stats.performanceScore = Math.max(0, 100 - (stats.overspeedCount || 0) * 5);
  storage.updateDriverStats(info.driverId, stats).catch(console.error);

  const alerts: LocationAlert[] = [];

  // 2. Stop geofencing (100m radius + 5s dwell)
  if (route) {
    const geoAlerts = await checkGeofences(current, route);
    alerts.push(...geoAlerts);
  }

  // 3. Operational geofence
  const areaAlert = checkOperationalGeofence(current);
  if (areaAlert) alerts.push(areaAlert);

  // 4. Persist + broadcast any alerts
  for (const alert of alerts) {
    try {
      const saved = await storage.createFleetAlert({
        tripId: alert.tripId,
        busId: alert.busId,
        driverId: alert.driverId,
        alertType: alert.alertType,
        severity: alert.severity,
        lat: alert.lat,
        lng: alert.lng,
        details: JSON.stringify(alert.details),
      });

      const alertPayload = JSON.stringify({
        type: "fleet:alert",
        alert: { ...saved, details: alert.details },
      });
      wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          const ci = clients.get(client);
          if (ci?.role === "admin") client.send(alertPayload);
        }
      });
    } catch (err) {
      console.error("Failed to save fleet alert:", err);
    }
  }
}

// ── Offline Detection ────────────────────────────────────────────────────────

function scheduleOfflineCheck(tripId: string, wss: WebSocketServer, routeId: number) {
  clearOfflineTimer(tripId);
  const timer = setTimeout(() => {
    const last = lastUpdateTime.get(tripId);
    if (!last || Date.now() - last >= OFFLINE_THRESHOLD_MS) {
      // Broadcast driver offline to subscribers
      const payload = JSON.stringify({ type: "bus:paused", tripId, routeId });
      wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          const ci = clients.get(client);
          if (ci && (ci.role === "admin" || ci.routeId === routeId)) {
            client.send(payload);
          }
        }
      });
    }
  }, OFFLINE_THRESHOLD_MS);
  offlineCheckIntervals.set(tripId, timer);
}

function clearOfflineTimer(tripId: string) {
  const existing = offlineCheckIntervals.get(tripId);
  if (existing) { clearTimeout(existing); offlineCheckIntervals.delete(tripId); }
}

// ── Trip Start ───────────────────────────────────────────────────────────────

async function handleTripStart(ws: WebSocket, message: { driverId: string; busId: string; routeId: number }, wss: WebSocketServer) {
  const info = clients.get(ws);
  if (info?.role !== "driver") {
    ws.send(JSON.stringify({ type: "error", message: "Not authorized" }));
    return;
  }
  try {
    const existing = await storage.getActiveTripByDriver(message.driverId);
    if (existing) await storage.endTrip(existing.id);

    const trip = await storage.createTrip({
      driverId: message.driverId,
      busId: message.busId,
      routeId: message.routeId,
    });
    info.tripId = trip.id;
    clients.set(ws, info);
    ws.send(JSON.stringify({ type: "trip:started", tripId: trip.id }));
  } catch (error) {
    console.error("Failed to start trip:", error);
    ws.send(JSON.stringify({ type: "error", message: "Failed to start trip" }));
  }
}

// ── Trip End ────────────────────────────────────────────────────────────────

async function handleTripEnd(ws: WebSocket, message: { tripId: string }, wss: WebSocketServer) {
  const info = clients.get(ws);
  if (info?.role !== "driver" || info.tripId !== message.tripId) {
    ws.send(JSON.stringify({ type: "error", message: "Not authorized" }));
    return;
  }
  try {
    const trip = await storage.endTrip(message.tripId);
    if (trip) {
      clearOfflineTimer(message.tripId);
      latestLocations.delete(message.tripId);
      lastUpdateTime.delete(message.tripId);
      clearMapMatchState(message.tripId);
      info.tripId = undefined;
      clients.set(ws, info);

      const offlinePayload = JSON.stringify({
        type: "bus:offline",
        tripId: message.tripId,
        routeId: trip.routeId,
      });
      wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          const ci = clients.get(client);
          if (ci && (ci.role === "admin" || ci.routeId === trip.routeId)) {
            client.send(offlinePayload);
          }
        }
      });

      ws.send(JSON.stringify({ type: "trip:ended", tripId: message.tripId }));
    }
  } catch (error) {
    console.error("Failed to end trip:", error);
    ws.send(JSON.stringify({ type: "error", message: "Failed to end trip" }));
  }
}

// ── Trip Pause ──────────────────────────────────────────────────────────────

async function handleTripPause(ws: WebSocket, message: { tripId: string }, wss: WebSocketServer) {
  const info = clients.get(ws);
  if (info?.role !== "driver" || info.tripId !== message.tripId) {
    ws.send(JSON.stringify({ type: "error", message: "Not authorized" }));
    return;
  }
  try {
    await storage.pauseTrip(message.tripId);
    clearOfflineTimer(message.tripId);
    ws.send(JSON.stringify({ type: "trip:paused", tripId: message.tripId }));

    const loc = latestLocations.get(message.tripId);
    const pausedPayload = JSON.stringify({
      type: "bus:paused",
      tripId: message.tripId,
      routeId: loc?.routeId,
    });
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        const ci = clients.get(client);
        if (ci && (ci.role === "admin" || ci.routeId === loc?.routeId)) {
          client.send(pausedPayload);
        }
      }
    });
  } catch (error) {
    console.error("Failed to pause trip:", error);
    ws.send(JSON.stringify({ type: "error", message: "Failed to pause trip" }));
  }
}

// ── Trip Resume ─────────────────────────────────────────────────────────────

async function handleTripResume(ws: WebSocket, message: { tripId: string }, wss: WebSocketServer) {
  const info = clients.get(ws);
  if (info?.role !== "driver" || info.tripId !== message.tripId) {
    ws.send(JSON.stringify({ type: "error", message: "Not authorized" }));
    return;
  }
  try {
    await storage.resumeTrip(message.tripId);
    ws.send(JSON.stringify({ type: "trip:resumed", tripId: message.tripId }));

    const loc = latestLocations.get(message.tripId);
    const resumePayload = JSON.stringify({
      type: "bus:resumed",
      tripId: message.tripId,
      routeId: loc?.routeId,
    });
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        const ci = clients.get(client);
        if (ci && (ci.role === "admin" || ci.routeId === loc?.routeId)) {
          client.send(resumePayload);
        }
      }
    });
  } catch (error) {
    console.error("Failed to resume trip:", error);
    ws.send(JSON.stringify({ type: "error", message: "Failed to resume trip" }));
  }
}

export function getActiveLocations(): ProcessedLocation[] {
  return Array.from(latestLocations.values());
}
