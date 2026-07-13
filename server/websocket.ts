/**
 * websocket.ts — Real-time WebSocket server
 *
 * Integrates all intelligent services:
 *   • ETA engine (60-second rolling average speed)
 *   • Route progress engine (road-segment distance)
 *   • 10-stage notification engine with spam protection
 *   • Multi-radius geofences (1000m/500m/100m/300m)
 *   • Stricter GPS validation
 *   • Student-targeted notifications
 *
 * Socket events emitted:
 *   bus:update, bus:offline, bus:paused, bus:resumed
 *   gps:update, route:update, eta:update
 *   notification
 *   fleet:alert
 *   trip:started, trip:ended, trip:paused, trip:resumed
 *   driver:panic
 */

import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";
import { storage } from "./storage";
import {
  validateLocation,
  checkGeofences,
  checkOperationalGeofence,
  calculateSpeed,
  recordGPSPoint,
  haversineKm,
  type RawLocationInput,
  type ProcessedLocation,
  type LocationAlert,
} from "./locationService";
import { snapToRoad, clearMapMatchState } from "./mapMatching";
import { recordSpeedSample, calculateETA, clearSpeedHistory } from "./etaService";
import { computeRouteProgress, clearRouteProgress } from "./routeProgressService";
import {
  getETANotificationStage,
  shouldSendNotification,
  recordNotification,
  clearNotificationHistory,
  getNotificationTitle,
  type NotificationType,
  type NotificationPayload,
} from "./notificationService";

// ── Client tracking ──────────────────────────────────────────────────────────

interface ClientInfo {
  role: "driver" | "student" | "admin";
  userId?: string;
  driverId?: string;
  tripId?: string;
  routeId?: number;
  /** Student's preferred stop name (for targeted notifications) */
  preferredStop?: string;
  /** Student's preferred stop id (resolved on subscribe) */
  preferredStopId?: number;
}

const clients          = new Map<WebSocket, ClientInfo>();
const latestLocations  = new Map<string, ProcessedLocation>();
const lastUpdateTime   = new Map<string, number>();
const offlineCheckIntervals = new Map<string, NodeJS.Timeout>();
const OFFLINE_THRESHOLD_MS  = 15_000;

// ── Setup ────────────────────────────────────────────────────────────────────

export function setupWebSocket(server: Server) {
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws: WebSocket) => {
    ws.on("message", async (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        switch (message.type) {
          case "auth":             await handleAuth(ws, message); break;
          case "subscribe":        await handleSubscribe(ws, message); break;
          case "location:update":  await handleLocationUpdate(ws, message, wss); break;
          case "trip:start":       await handleTripStart(ws, message, wss); break;
          case "trip:end":         await handleTripEnd(ws, message, wss); break;
          case "trip:pause":       await handleTripPause(ws, message, wss); break;
          case "trip:resume":      await handleTripResume(ws, message, wss); break;
          case "driver:panic":     handleDriverPanic(ws, message, wss); break;
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
        clearSpeedHistory(info.tripId);
        clearRouteProgress(info.tripId);
      }
      clients.delete(ws);
    });

    ws.on("error", (err) => console.error("WebSocket error:", err));
  });

  console.log("WebSocket server initialized on /ws");
  return wss;
}

// ── Auth ─────────────────────────────────────────────────────────────────────

async function handleAuth(ws: WebSocket, message: { role: string; userId?: string; driverId?: string }) {
  const info: ClientInfo = {
    role: message.role as ClientInfo["role"],
    userId: message.userId,
    driverId: message.driverId,
  };

  // For students, pre-load their preferred stop so we can target notifications
  if (message.role === "student" && message.userId) {
    try {
      const student = await storage.getStudentByUserId(message.userId);
      if (student) {
        info.preferredStop = student.preferredStop ?? undefined;
        info.routeId       = student.preferredRouteId ?? undefined;
      }
    } catch { /* non-blocking */ }
  }

  clients.set(ws, info);
  ws.send(JSON.stringify({ type: "auth:success", role: info.role }));
}

// ── Subscribe ─────────────────────────────────────────────────────────────────

async function handleSubscribe(ws: WebSocket, message: { routeId?: number }) {
  const info = clients.get(ws);
  if (!info) return;

  if (message.routeId) {
    info.routeId = message.routeId;

    // Resolve preferred stop name → stop id for targeted notifications
    if (info.preferredStop && info.role === "student") {
      try {
        const stops = await storage.getRouteStops(message.routeId);
        const match = stops.find(s =>
          s.name.toLowerCase().includes(info.preferredStop!.toLowerCase()) ||
          info.preferredStop!.toLowerCase().includes(s.name.toLowerCase()),
        );
        if (match) info.preferredStopId = match.id;
      } catch { /* non-blocking */ }
    }
  }

  clients.set(ws, info);

  const all      = Array.from(latestLocations.values());
  const filtered = message.routeId ? all.filter(l => l.routeId === message.routeId) : all;
  ws.send(JSON.stringify({ type: "locations:init", locations: filtered }));
}

// ── Location Update ──────────────────────────────────────────────────────────

async function handleLocationUpdate(ws: WebSocket, message: {
  routeId: number; busId: string;
  lat: number; lng: number;
  speed?: number; heading?: number; accuracy?: number;
}, wss: WebSocketServer) {
  const info = clients.get(ws);
  if (info?.role !== "driver" || !info.tripId) {
    ws.send(JSON.stringify({ type: "error", message: "Not authorized to send location updates" }));
    return;
  }

  const prev = latestLocations.get(info.tripId);
  const now  = Date.now();

  const raw: RawLocationInput = {
    tripId:   info.tripId,
    routeId:  message.routeId,
    busId:    message.busId,
    driverId: info.driverId || "",
    lat:      message.lat,
    lng:      message.lng,
    speed:    message.speed,
    heading:  message.heading,
    accuracy: message.accuracy,
    timestamp: now,
    provider: "mobile_gps",
  };

  const validated = validateLocation(raw, prev);
  if (!validated.isValid) {
    // Silently drop invalid points; continue with previous predicted position
    ws.send(JSON.stringify({ type: "location:ack" }));
    return;
  }

  const speed = calculateSpeed(prev, { lat: raw.lat, lng: raw.lng, timestamp: now, speed: raw.speed });

  const processed: ProcessedLocation = {
    tripId:   info.tripId,
    routeId:  message.routeId,
    busId:    message.busId,
    driverId: info.driverId || "",
    lat:      validated.lat,
    lng:      validated.lng,
    speed,
    heading:  message.heading,
    accuracy: message.accuracy,
    timestamp: now,
    provider: "mobile_gps",
  };

  // Record for rolling speed average and smoothing buffer
  recordSpeedSample(info.tripId, speed, now);
  recordGPSPoint(info.tripId, { speed, lat: processed.lat, lng: processed.lng, timestamp: now, heading: message.heading });

  lastUpdateTime.set(info.tripId, now);
  scheduleOfflineCheck(info.tripId, wss, message.routeId);

  // Persist location (fire-and-forget)
  storage.appendLiveLocation({
    tripId:   info.tripId,
    lat:      processed.lat,
    lng:      processed.lng,
    speed:    processed.speed,
    heading:  processed.heading,
    accuracy: processed.accuracy,
  }).catch(console.error);

  // Road-snap for display
  const snap = await snapToRoad(info.tripId, processed.lat, processed.lng, now);
  const displayLocation = { ...processed, snappedLat: snap.lat, snappedLng: snap.lng, roadSnapped: snap.snapped };
  latestLocations.set(info.tripId, displayLocation);

  // Broadcast gps:update to all relevant subscribers
  const gpsPayload = JSON.stringify({ type: "gps:update", location: displayLocation });
  const busPayload  = JSON.stringify({ type: "bus:update",  location: displayLocation }); // backward-compat
  broadcastToRoute(wss, ws, message.routeId, gpsPayload, busPayload);

  ws.send(JSON.stringify({ type: "location:ack" }));

  // Non-blocking analytics + notifications
  runAnalyticsAndNotifications(info, processed, prev, wss).catch(console.error);
}

// ── Analytics + Notification pipeline ───────────────────────────────────────

async function runAnalyticsAndNotifications(
  info: ClientInfo,
  current: ProcessedLocation,
  prev: ProcessedLocation | undefined,
  wss: WebSocketServer,
) {
  if (!info.driverId || !info.tripId) return;

  // 1. Driver stats
  const stats = await storage.getDriverStats(info.driverId) || {
    driverId: info.driverId, totalDistance: 0, avgSpeed: 0, overspeedCount: 0, performanceScore: 100,
  };
  if (prev) {
    stats.totalDistance = (stats.totalDistance || 0) + haversineKm(prev.lat, prev.lng, current.lat, current.lng);
  }
  const route      = await storage.getRoute(current.routeId);
  const speedLimit = route?.speedLimit ?? 40;
  if (current.speed > speedLimit) stats.overspeedCount = (stats.overspeedCount || 0) + 1;
  stats.performanceScore = Math.max(0, 100 - (stats.overspeedCount || 0) * 5);
  storage.updateDriverStats(info.driverId, stats).catch(console.error);

  const alerts: LocationAlert[] = [];

  // 2. Multi-radius geofence check + notification events
  if (route) {
    const { alerts: geoAlerts, geofenceEvents } = await checkGeofences(current, route);
    alerts.push(...geoAlerts);

    // Fire notifications based on geofence events
    for (const evt of geofenceEvents) {
      let notifType: NotificationType | null = null;
      if (evt.event === "ARRIVED")    notifType = "BUS_ARRIVING";
      if (evt.event === "DEPARTED")   notifType = "BUS_DEPARTED";
      if (evt.event === "APPROACHING") notifType = "APPROACHING_2MIN";
      // NEAR → handled by ETA-based notifications below

      if (notifType) {
        await emitNotification(wss, info, current, {
          type:       notifType,
          stopId:     evt.stopId,
          stopName:   evt.stopName,
          routeName:  route.name,
        });
      }
    }
  }

  // 3. Route progress + ETA-based notifications
  try {
    const progress = await computeRouteProgress(info.tripId, current.lat, current.lng, current.routeId);

    if (progress.nextStop) {
      const etaResult = calculateETA(info.tripId, progress.remainingDistanceToNextStopKm);
      const etaMinutes = etaResult.etaMinutes;

      // Broadcast eta:update to all subscribers on this route
      const etaPayload = JSON.stringify({
        type:          "eta:update",
        tripId:        info.tripId,
        routeId:       current.routeId,
        nextStop:      progress.nextStop,
        etaMinutes,
        avgSpeedKmh:   etaResult.avgSpeedKmh,
        distanceKm:    progress.remainingDistanceToNextStopKm,
        expectedArrival: new Date(Date.now() + etaMinutes * 60_000).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
        routeProgress: {
          segmentIndex:     progress.currentSegmentIndex,
          distanceAlongKm:  progress.distanceAlongRouteKm,
          completedStopIds: progress.completedStopIds,
        },
      });

      broadcastToRouteAll(wss, current.routeId, etaPayload);

      // ETA-based notification for each student's stop
      const distToNextStop = haversineKm(
        current.lat, current.lng,
        progress.nextStop.lat, progress.nextStop.lng,
      );
      const etaNotifType = getETANotificationStage(etaMinutes, distToNextStop);

      if (etaNotifType && route) {
        await emitNotification(wss, info, current, {
          type:      etaNotifType,
          stopId:    progress.nextStop.id,
          stopName:  progress.nextStop.name,
          routeName: route.name,
          etaMinutes,
          expectedArrival: new Date(Date.now() + etaMinutes * 60_000)
            .toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
        });
      }
    }
  } catch (err) {
    console.error("Route progress / ETA error:", err);
  }

  // 4. Operational geofence
  const areaAlert = checkOperationalGeofence(current);
  if (areaAlert) alerts.push(areaAlert);

  // 5. Persist + broadcast fleet alerts (admin-only)
  for (const alert of alerts) {
    try {
      const saved = await storage.createFleetAlert({
        tripId:    alert.tripId,
        busId:     alert.busId,
        driverId:  alert.driverId,
        alertType: alert.alertType,
        severity:  alert.severity,
        lat:       alert.lat,
        lng:       alert.lng,
        details:   JSON.stringify(alert.details),
      });

      // Overspeed → also send as student notification
      if (alert.alertType === "RASH_DRIVING" && route) {
        await emitNotification(wss, info, current, {
          type:      "OVERSPEED",
          routeName: route.name,
        });
      }

      const alertPayload = JSON.stringify({ type: "fleet:alert", alert: { ...saved, details: alert.details } });
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

// ── Notification emitter ──────────────────────────────────────────────────────

/**
 * Build, spam-check, persist, and broadcast a notification.
 *
 * Student targeting: if the notification is stop-specific, only send to students
 * whose preferredStopId (or preferredStop name) matches.  General notifications
 * (OVERSPEED, TRIP_STARTED, etc.) are sent to all students on the route.
 */
async function emitNotification(
  wss: WebSocketServer,
  driverInfo: ClientInfo,
  loc: ProcessedLocation,
  overrides: {
    type: NotificationType;
    stopId?: number;
    stopName?: string;
    routeName?: string;
    etaMinutes?: number;
    expectedArrival?: string;
  },
) {
  if (!driverInfo.tripId) return;

  // Look up bus number for the toast body
  let busName: string | undefined;
  try {
    const bus = await storage.getBus(loc.busId);
    busName = bus?.number;
  } catch { /* non-blocking */ }

  const payload: NotificationPayload = {
    type:        overrides.type,
    tripId:      driverInfo.tripId,
    busId:       loc.busId,
    routeId:     loc.routeId,
    stopId:      overrides.stopId,
    etaMinutes:  overrides.etaMinutes,
    busName,
    routeName:   overrides.routeName,
    stopName:    overrides.stopName,
    currentSpeed: loc.speed,
    expectedArrival: overrides.expectedArrival,
  };

  if (!shouldSendNotification(payload)) return;

  recordNotification(payload);

  // Persist notification
  try {
    await storage.createNotification({
      tripId:           driverInfo.tripId,
      busId:            loc.busId,
      routeId:          loc.routeId,
      stopId:           overrides.stopId,
      notificationType: overrides.type,
      etaMinutes:       overrides.etaMinutes,
      busName,
      routeName:        overrides.routeName,
      stopName:         overrides.stopName,
      currentSpeed:     loc.speed,
      expectedArrival:  overrides.expectedArrival,
    });
  } catch (err) {
    console.error("Failed to persist notification:", err);
  }

  // Broadcast to relevant clients
  const notifMsg = JSON.stringify({ type: "notification", notification: payload });

  wss.clients.forEach(client => {
    if (client.readyState !== WebSocket.OPEN) return;
    const ci = clients.get(client);
    if (!ci) return;

    // Admins always get all notifications
    if (ci.role === "admin") {
      client.send(notifMsg);
      return;
    }

    // Students: must be on the same route
    if (ci.role === "student" && ci.routeId === loc.routeId) {
      // For stop-specific notifications, check if this student's stop matches
      if (overrides.stopId !== undefined) {
        // Send if student has the matching stop, or if they have no preferred stop set
        const studentStopMatches =
          !ci.preferredStopId ||
          ci.preferredStopId === overrides.stopId;
        if (studentStopMatches) client.send(notifMsg);
      } else {
        // General notification (OVERSPEED, TRIP_STARTED, etc.) → all students
        client.send(notifMsg);
      }
    }
  });
}

// ── Offline detection ─────────────────────────────────────────────────────────

function scheduleOfflineCheck(tripId: string, wss: WebSocketServer, routeId: number) {
  clearOfflineTimer(tripId);
  const timer = setTimeout(() => {
    const last = lastUpdateTime.get(tripId);
    if (!last || Date.now() - last >= OFFLINE_THRESHOLD_MS) {
      const payload = JSON.stringify({ type: "bus:paused", tripId, routeId });
      broadcastToRouteAll(wss, routeId, payload);
    }
  }, OFFLINE_THRESHOLD_MS);
  offlineCheckIntervals.set(tripId, timer);
}

function clearOfflineTimer(tripId: string) {
  const existing = offlineCheckIntervals.get(tripId);
  if (existing) { clearTimeout(existing); offlineCheckIntervals.delete(tripId); }
}

// ── Broadcast helpers ─────────────────────────────────────────────────────────

/** Send to all subscribers of a route (except the sending driver's socket). */
function broadcastToRoute(
  wss: WebSocketServer,
  senderWs: WebSocket,
  routeId: number,
  ...payloads: string[]
) {
  wss.clients.forEach(client => {
    if (client === senderWs || client.readyState !== WebSocket.OPEN) return;
    const ci = clients.get(client);
    if (ci && (ci.role === "admin" || ci.routeId === routeId)) {
      payloads.forEach(p => client.send(p));
    }
  });
}

/** Send to all subscribers of a route (including the driver). */
function broadcastToRouteAll(wss: WebSocketServer, routeId: number, payload: string) {
  wss.clients.forEach(client => {
    if (client.readyState !== WebSocket.OPEN) return;
    const ci = clients.get(client);
    if (ci && (ci.role === "admin" || ci.routeId === routeId)) {
      client.send(payload);
    }
  });
}

// ── Trip Start ────────────────────────────────────────────────────────────────

async function handleTripStart(
  ws: WebSocket,
  message: { driverId: string; busId: string; routeId: number },
  wss: WebSocketServer,
) {
  const info = clients.get(ws);
  if (info?.role !== "driver") {
    ws.send(JSON.stringify({ type: "error", message: "Not authorized" }));
    return;
  }
  try {
    const existing = await storage.getActiveTripByDriver(message.driverId);
    if (existing) await storage.endTrip(existing.id);

    const trip = await storage.createTrip({ driverId: message.driverId, busId: message.busId, routeId: message.routeId });
    info.tripId = trip.id;
    clients.set(ws, info);
    ws.send(JSON.stringify({ type: "trip:started", tripId: trip.id }));

    // trip:start socket event + TRIP_STARTED notification
    const route   = await storage.getRoute(message.routeId);
    const tripMsg = JSON.stringify({ type: "trip:start", tripId: trip.id, routeId: message.routeId });
    broadcastToRouteAll(wss, message.routeId, tripMsg);

    if (route) {
      await emitNotification(wss, info, {
        tripId: trip.id, routeId: message.routeId, busId: message.busId,
        driverId: message.driverId, lat: 0, lng: 0, speed: 0,
        timestamp: Date.now(), provider: "mobile_gps",
      }, { type: "TRIP_STARTED", routeName: route.name });
    }
  } catch (error) {
    console.error("Failed to start trip:", error);
    ws.send(JSON.stringify({ type: "error", message: "Failed to start trip" }));
  }
}

// ── Trip End ──────────────────────────────────────────────────────────────────

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
      clearSpeedHistory(message.tripId);
      clearRouteProgress(message.tripId);
      clearNotificationHistory(message.tripId);
      latestLocations.delete(message.tripId);
      lastUpdateTime.delete(message.tripId);
      clearMapMatchState(message.tripId);
      info.tripId = undefined;
      clients.set(ws, info);

      const offlinePayload = JSON.stringify({ type: "bus:offline", tripId: message.tripId, routeId: trip.routeId });
      const tripEndPayload = JSON.stringify({ type: "trip:end", tripId: message.tripId, routeId: trip.routeId });
      broadcastToRouteAll(wss, trip.routeId, offlinePayload);
      broadcastToRouteAll(wss, trip.routeId, tripEndPayload);

      // TRIP_COMPLETED notification
      const route = await storage.getRoute(trip.routeId);
      if (route) {
        await emitNotification(wss, info, {
          tripId: message.tripId, routeId: trip.routeId, busId: trip.busId,
          driverId: trip.driverId, lat: 0, lng: 0, speed: 0,
          timestamp: Date.now(), provider: "mobile_gps",
        }, { type: "TRIP_COMPLETED", routeName: route.name });
      }

      ws.send(JSON.stringify({ type: "trip:ended", tripId: message.tripId }));
    }
  } catch (error) {
    console.error("Failed to end trip:", error);
    ws.send(JSON.stringify({ type: "error", message: "Failed to end trip" }));
  }
}

// ── Trip Pause ────────────────────────────────────────────────────────────────

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
    if (loc) {
      const pausedPayload = JSON.stringify({ type: "bus:paused", tripId: message.tripId, routeId: loc.routeId });
      broadcastToRouteAll(wss, loc.routeId, pausedPayload);
    }
  } catch (error) {
    console.error("Failed to pause trip:", error);
    ws.send(JSON.stringify({ type: "error", message: "Failed to pause trip" }));
  }
}

// ── Trip Resume ───────────────────────────────────────────────────────────────

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
    if (loc) {
      const resumePayload = JSON.stringify({ type: "bus:resumed", tripId: message.tripId, routeId: loc.routeId });
      broadcastToRouteAll(wss, loc.routeId, resumePayload);
    }
  } catch (error) {
    console.error("Failed to resume trip:", error);
    ws.send(JSON.stringify({ type: "error", message: "Failed to resume trip" }));
  }
}

// ── Driver Panic ──────────────────────────────────────────────────────────────

function handleDriverPanic(ws: WebSocket, message: { tripId?: string; lat?: number; lng?: number }, wss: WebSocketServer) {
  const info = clients.get(ws);
  if (info?.role !== "driver") return;

  const panicPayload = JSON.stringify({
    type:     "driver:panic",
    tripId:   message.tripId ?? info.tripId,
    driverId: info.driverId,
    lat:      message.lat,
    lng:      message.lng,
    timestamp: Date.now(),
  });

  // Broadcast to all admins
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      const ci = clients.get(client);
      if (ci?.role === "admin") client.send(panicPayload);
    }
  });

  ws.send(JSON.stringify({ type: "panic:ack" }));
}

// ── Public helpers ────────────────────────────────────────────────────────────

export function getActiveLocations(): ProcessedLocation[] {
  return Array.from(latestLocations.values());
}
