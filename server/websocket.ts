import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";
import { storage } from "./storage";

interface LocationUpdate {
  tripId: string;
  routeId: number;
  busId: string;
  lat: number;
  lng: number;
  speed?: number;
  heading?: number;
  accuracy?: number;
}

interface ClientInfo {
  role: "driver" | "student" | "admin";
  userId?: string;
  tripId?: string;
  routeId?: number;
}

const clients = new Map<WebSocket, ClientInfo>();
const latestLocations = new Map<string, LocationUpdate>();

export function setupWebSocket(server: Server) {
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

function handleAuth(ws: WebSocket, message: { role: string; userId?: string }) {
  const clientInfo: ClientInfo = {
    role: message.role as "driver" | "student" | "admin",
    userId: message.userId,
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

async function handleLocationUpdate(ws: WebSocket, message: LocationUpdate, wss: WebSocketServer) {
  const clientInfo = clients.get(ws);
  if (clientInfo?.role !== "driver" || !clientInfo.tripId) {
    ws.send(JSON.stringify({ type: "error", message: "Not authorized to send location updates" }));
    return;
  }

  const locationData: LocationUpdate = {
    tripId: clientInfo.tripId,
    routeId: message.routeId,
    busId: message.busId,
    lat: message.lat,
    lng: message.lng,
    speed: message.speed,
    heading: message.heading,
    accuracy: message.accuracy,
  };

  latestLocations.set(clientInfo.tripId, locationData);

  try {
    await storage.appendLiveLocation({
      tripId: clientInfo.tripId,
      lat: message.lat,
      lng: message.lng,
      speed: message.speed,
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
