import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";
import { storage } from "./storage";

// Utility for speed and distance
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

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
const latestLocations = new Map<string, LocationUpdate>();
const OVERSPEED_THRESHOLD = 60; // km/h
const GEOFENCE_RADIUS = 0.3; // 300 meters in km

export function setupWebSocket(server: Server) {
  // ... existing setup ...
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws: WebSocket) => {
    console.log("WebSocket client connected");

    ws.on("message", async (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        
        switch (message.type) {
          case "auth":
            handleAuth(ws, message);
            break;
          case "subscribe":
            handleSubscribe(ws, message);
            break;
          case "location:update":
            await handleLocationUpdate(ws, message, wss);
            break;
          case "trip:start":
            await handleTripStart(ws, message);
            break;
          case "trip:end":
            await handleTripEnd(ws, message, wss);
            break;
        }
      } catch (error) {
        console.error("WebSocket message error:", error);
        ws.send(JSON.stringify({ type: "error", message: "Invalid message format" }));
      }
    });

    ws.on("close", () => {
      const clientInfo = clients.get(ws);
      if (clientInfo?.tripId) {
        latestLocations.delete(clientInfo.tripId);
      }
      clients.delete(ws);
      console.log("WebSocket client disconnected");
    });

    ws.on("error", (error) => {
      console.error("WebSocket error:", error);
    });
  });

  console.log("WebSocket server initialized on /ws");
  return wss;
}

function handleAuth(ws: WebSocket, message: { role: string; userId?: string; driverId?: string }) {
  const clientInfo: ClientInfo = {
    role: message.role as "driver" | "student" | "admin",
    userId: message.userId,
    driverId: message.driverId,
  };
  clients.set(ws, clientInfo);
  ws.send(JSON.stringify({ type: "auth:success", role: clientInfo.role }));
}

function handleSubscribe(ws: WebSocket, message: { routeId?: number }) {
  const clientInfo = clients.get(ws);
  if (clientInfo) {
    clientInfo.routeId = message.routeId;
    clients.set(ws, clientInfo);
    
    if (message.routeId) {
      const routeLocations = Array.from(latestLocations.values())
        .filter(loc => loc.routeId === message.routeId);
      ws.send(JSON.stringify({ type: "locations:init", locations: routeLocations }));
    } else {
      ws.send(JSON.stringify({ type: "locations:init", locations: Array.from(latestLocations.values()) }));
    }
  }
}

// Road snapping using OSRM
async function snapToRoad(lat1: number, lng1: number, lat2: number, lng2: number): Promise<{ lat: number, lng: number }[]> {
  try {
    const url = `https://router.project-osrm.org/match/v1/driving/${lng1},${lat1};${lng2},${lat2}?geometries=geojson&overview=full`;
    const response = await fetch(url);
    
    // Check if response is JSON
    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      const text = await response.text();
      console.warn("OSRM returned non-JSON response:", text.substring(0, 100));
      return [{ lat: lat2, lng: lng2 }];
    }

    const data = await response.json();
    
    if (data.code === 'Ok' && data.matchings && data.matchings.length > 0) {
      const coords = data.matchings[0].geometry.coordinates;
      return coords.map((c: any) => ({ lng: c[0], lat: c[1] }));
    }
  } catch (error) {
    console.error("OSRM matching failed:", error);
  }
  return [{ lat: lat2, lng: lng2 }];
}

async function handleLocationUpdate(ws: WebSocket, message: LocationUpdate, wss: WebSocketServer) {
  const clientInfo = clients.get(ws);
  if (clientInfo?.role !== "driver" || !clientInfo.tripId) {
    ws.send(JSON.stringify({ type: "error", message: "Not authorized to send location updates" }));
    return;
  }

  const prevLocation = latestLocations.get(clientInfo.tripId);
  const now = Date.now();
  
  // GPS Filtering
  if (prevLocation) {
    const timeDiff = (now - (prevLocation.timestamp || 0)) / 1000;
    if (timeDiff < 3) return; // Ignore updates < 3s apart

    const distance = calculateDistance(prevLocation.lat, prevLocation.lng, message.lat, message.lng);
    if (distance > 0.3) return; // Ignore jumps > 300m
  }

  // Snap to road
  let finalLat = message.lat;
  let finalLng = message.lng;
  if (prevLocation) {
    const snapped = await snapToRoad(prevLocation.lat, prevLocation.lng, message.lat, message.lng);
    const lastPoint = snapped[snapped.length - 1];
    finalLat = lastPoint.lat;
    finalLng = lastPoint.lng;
  }

  let calculatedSpeed = message.speed || 0;
  if (prevLocation && !message.speed) {
    const distance = calculateDistance(prevLocation.lat, prevLocation.lng, finalLat, finalLng);
    const timeDiff = (now - (prevLocation.timestamp || now)) / 1000 / 3600;
    if (timeDiff > 0) {
      calculatedSpeed = distance / timeDiff;
    }
  }

  const locationData: LocationUpdate = {
    tripId: clientInfo.tripId,
    routeId: message.routeId,
    busId: message.busId,
    lat: finalLat,
    lng: finalLng,
    speed: calculatedSpeed,
    heading: message.heading,
    accuracy: message.accuracy,
    timestamp: now,
  };

  latestLocations.set(clientInfo.tripId, locationData);
  processAnalytics(clientInfo, locationData, prevLocation).catch(console.error);

  try {
    await storage.appendLiveLocation({
      tripId: clientInfo.tripId,
      lat: finalLat,
      lng: finalLng,
      speed: calculatedSpeed,
      heading: message.heading,
      accuracy: message.accuracy,
    });
  } catch (error) {
    console.error("Failed to persist location:", error);
  }

  wss.clients.forEach((client) => {
    if (client !== ws && client.readyState === WebSocket.OPEN) {
      const info = clients.get(client);
      if (info && (info.role === "admin" || info.routeId === message.routeId)) {
        client.send(JSON.stringify({ type: "bus:update", location: locationData }));
      }
    }
  });

  ws.send(JSON.stringify({ type: "location:ack" }));
}

async function processAnalytics(clientInfo: ClientInfo, current: LocationUpdate, prev?: LocationUpdate) {
  if (!clientInfo.driverId) return;

  const driverId = clientInfo.driverId;
  const stats = await storage.getDriverStats(driverId) || {
    driverId,
    totalDistance: 0,
    avgSpeed: 0,
    overspeedCount: 0,
    performanceScore: 100,
  };

  // 1. Distance update
  if (prev) {
    const dist = calculateDistance(prev.lat, prev.lng, current.lat, current.lng);
    stats.totalDistance = (stats.totalDistance || 0) + dist;
  }

  // 2. Overspeed detection
  let overspeedDetected = false;
  if (current.speed && current.speed > OVERSPEED_THRESHOLD) {
    stats.overspeedCount = (stats.overspeedCount || 0) + 1;
    overspeedDetected = true;
  }

  // 3. Performance Score
  stats.performanceScore = Math.max(0, 100 - (stats.overspeedCount || 0) * 5);
  
  // Throttle DB updates: only update if overspeed or distance changed significantly (e.g., > 100m)
  if (overspeedDetected || (stats.totalDistance || 0) % 0.1 < 0.01) {
    await storage.updateDriverStats(driverId, stats);
  }

  // 4. Geo-fencing
  const stops = await storage.getRouteStops(current.routeId);
  for (const stop of stops) {
    const distToStop = calculateDistance(current.lat, current.lng, stop.lat, stop.lng);
    const lastEvent = await storage.getLatestGeoEvent(current.tripId, stop.id);

    if (distToStop <= GEOFENCE_RADIUS) {
      // ENTER
      if (!lastEvent || lastEvent.type === "EXIT") {
        await storage.logGeoEvent({ tripId: current.tripId, stopId: stop.id, type: "ENTER" });
      }
    } else {
      // EXIT
      if (lastEvent && lastEvent.type === "ENTER") {
        await storage.logGeoEvent({ tripId: current.tripId, stopId: stop.id, type: "EXIT" });
      }
    }
  }
}

async function handleTripStart(ws: WebSocket, message: { driverId: string; busId: string; routeId: number }) {
  const clientInfo = clients.get(ws);
  if (clientInfo?.role !== "driver") {
    ws.send(JSON.stringify({ type: "error", message: "Not authorized" }));
    return;
  }

  try {
    const existingTrip = await storage.getActiveTripByDriver(message.driverId);
    if (existingTrip) {
      await storage.endTrip(existingTrip.id);
    }

    const trip = await storage.createTrip({
      driverId: message.driverId,
      busId: message.busId,
      routeId: message.routeId,
    });

    clientInfo.tripId = trip.id;
    clients.set(ws, clientInfo);

    ws.send(JSON.stringify({ type: "trip:started", tripId: trip.id }));
  } catch (error) {
    console.error("Failed to start trip:", error);
    ws.send(JSON.stringify({ type: "error", message: "Failed to start trip" }));
  }
}

async function handleTripEnd(ws: WebSocket, message: { tripId: string }, wss: WebSocketServer) {
  const clientInfo = clients.get(ws);
  if (clientInfo?.role !== "driver" || clientInfo.tripId !== message.tripId) {
    ws.send(JSON.stringify({ type: "error", message: "Not authorized" }));
    return;
  }

  try {
    const trip = await storage.endTrip(message.tripId);
    if (trip) {
      const locationData = latestLocations.get(message.tripId);
      latestLocations.delete(message.tripId);
      clientInfo.tripId = undefined;
      clients.set(ws, clientInfo);

      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          const info = clients.get(client);
          if (info && (info.role === "admin" || info.routeId === trip.routeId)) {
            client.send(JSON.stringify({ type: "bus:offline", tripId: message.tripId, routeId: trip.routeId }));
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

export function getActiveLocations(): LocationUpdate[] {
  return Array.from(latestLocations.values());
}
