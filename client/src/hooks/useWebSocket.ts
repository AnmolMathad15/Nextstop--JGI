import { useEffect, useRef, useState } from "react";

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

interface UseWebSocketOptions {
  role: "driver" | "student" | "admin";
  userId?: string;
  routeId?: number;
  onLocationUpdate?: (location: LocationUpdate) => void;
  onBusOffline?: (tripId: string, routeId: number) => void;
}

export function useWebSocket(options: UseWebSocketOptions) {
  const { role, userId, routeId, onLocationUpdate, onBusOffline } = options;
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [tripId, setTripId] = useState<string | null>(null);
  const [locations, setLocations] = useState<LocationUpdate[]>([]);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const isInitializedRef = useRef(false);

  useEffect(() => {
    if (isInitializedRef.current) return;
    isInitializedRef.current = true;

    const connect = () => {
      if (wsRef.current?.readyState === WebSocket.OPEN) return;

      try {
        const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
        const host = window.location.hostname || "localhost";
        const port = window.location.port || (window.location.protocol === "https:" ? "443" : "80");
        const wsUrl = `${proto}//${host}${port && port !== "80" && port !== "443" ? `:${port}` : ""}/ws`;
        
        console.log("Connecting to WebSocket:", wsUrl);
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          console.log("WebSocket connected");
          setIsConnected(true);
          ws.send(JSON.stringify({ type: "auth", role, userId }));
          
          if (role !== "driver" && routeId) {
            ws.send(JSON.stringify({ type: "subscribe", routeId }));
          }
        };

        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            
            switch (message.type) {
              case "auth:success":
                console.log("WebSocket authenticated as", message.role);
                break;
              case "locations:init":
                setLocations(message.locations || []);
                break;
              case "bus:update":
                setLocations(prev => {
                  const index = prev.findIndex(l => l.tripId === message.location.tripId);
                  if (index >= 0) {
                    const updated = [...prev];
                    updated[index] = message.location;
                    return updated;
                  }
                  return [...prev, message.location];
                });
                onLocationUpdate?.(message.location);
                break;
              case "bus:offline":
                setLocations(prev => prev.filter(l => l.tripId !== message.tripId));
                onBusOffline?.(message.tripId, message.routeId);
                break;
              case "trip:started":
                setTripId(message.tripId);
                break;
              case "trip:ended":
                setTripId(null);
                break;
              case "location:ack":
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
          console.log("WebSocket disconnected");
          setIsConnected(false);
          reconnectTimeoutRef.current = setTimeout(connect, 3000);
        };

        ws.onerror = (error) => {
          console.error("WebSocket error:", error);
        };
      } catch (error) {
        console.error("Failed to create WebSocket:", error);
        reconnectTimeoutRef.current = setTimeout(connect, 3000);
      }
    };

    connect();

    return () => {
      isInitializedRef.current = false;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [role, userId, routeId, onLocationUpdate, onBusOffline]);

  const startTrip = (driverId: string, busId: string, routeId: number) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: "trip:start",
        driverId,
        busId,
        routeId,
      }));
    }
  };

  const endTrip = (tripId: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: "trip:end",
        tripId,
      }));
    }
  };

  const sendLocation = (routeId: number, busId: string, lat: number, lng: number, speed?: number, heading?: number, accuracy?: number) => {
    if (wsRef.current?.readyState === WebSocket.OPEN && tripId) {
      wsRef.current.send(JSON.stringify({
        type: "location:update",
        routeId,
        busId,
        lat,
        lng,
        speed,
        heading,
        accuracy,
      }));
    }
  };

  return {
    isConnected,
    tripId,
    locations,
    startTrip,
    endTrip,
    sendLocation,
  };
}
