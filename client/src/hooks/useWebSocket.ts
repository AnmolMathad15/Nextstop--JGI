import { useEffect, useRef, useState, useCallback, useMemo } from "react";

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
  const [locations, setLocations] = useState<Map<string, LocationUpdate>>(new Map());
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();

  // Memoize callbacks to avoid infinite reconnections
  const memoizedOptions = useMemo(
    () => ({ role, userId, routeId, onLocationUpdate, onBusOffline }),
    [role, userId, routeId, onLocationUpdate, onBusOffline]
  );

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    try {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const host = window.location.host;
      const wsUrl = `${protocol}//${host}/ws`;
      
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("WebSocket connected");
        setIsConnected(true);
        ws.send(JSON.stringify({ type: "auth", role: memoizedOptions.role, userId: memoizedOptions.userId }));
        
        if (memoizedOptions.role !== "driver" && memoizedOptions.routeId) {
          ws.send(JSON.stringify({ type: "subscribe", routeId: memoizedOptions.routeId }));
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
              const initialLocations = new Map<string, LocationUpdate>();
              message.locations.forEach((loc: LocationUpdate) => {
                initialLocations.set(loc.tripId, loc);
              });
              setLocations(initialLocations);
              break;
            case "bus:update":
              setLocations(prev => {
                const updated = new Map(prev);
                updated.set(message.location.tripId, message.location);
                return updated;
              });
              memoizedOptions.onLocationUpdate?.(message.location);
              break;
            case "bus:offline":
              setLocations(prev => {
                const updated = new Map(prev);
                updated.delete(message.tripId);
                return updated;
              });
              memoizedOptions.onBusOffline?.(message.tripId, message.routeId);
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
  }, [memoizedOptions]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      wsRef.current?.close();
    };
  }, [connect]);

  const startTrip = useCallback((driverId: string, busId: string, routeId: number) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: "trip:start",
        driverId,
        busId,
        routeId,
      }));
    }
  }, []);

  const endTrip = useCallback((tripId: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: "trip:end",
        tripId,
      }));
    }
  }, []);

  const sendLocation = useCallback((routeId: number, busId: string, lat: number, lng: number, speed?: number, heading?: number, accuracy?: number) => {
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
  }, [tripId]);

  return {
    isConnected,
    tripId,
    locations: Array.from(locations.values()),
    startTrip,
    endTrip,
    sendLocation,
  };
}
