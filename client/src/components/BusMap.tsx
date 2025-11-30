import { useEffect, useState, useCallback } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import { Search, Plus, Minus, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useQuery } from "@tanstack/react-query";
import { useWebSocket } from "@/hooks/useWebSocket";
import { HUBLI_CENTER, JCET_COLLEGE_COORDS } from "@/lib/constants";
import MissedBusAlert from "./MissedBusAlert";

const busIcon = new L.DivIcon({
  className: "bus-marker",
  html: `<div style="background: #facc15; border: 3px solid #854d0e; border-radius: 50%; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; font-size: 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.3);">🚌</div>`,
  iconSize: [40, 40],
  iconAnchor: [20, 20],
});

const stopIcon = new L.DivIcon({
  className: "stop-marker",
  html: `<div style="background: #0f766e; border: 2px solid white; border-radius: 50%; width: 20px; height: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.3);"></div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

const selectedStopIcon = new L.DivIcon({
  className: "selected-stop-marker",
  html: `<div style="background: #facc15; border: 3px solid #854d0e; border-radius: 50%; width: 28px; height: 28px; box-shadow: 0 0 12px rgba(250,204,21,0.8); animation: pulse 2s infinite;"></div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

const collegeIcon = new L.DivIcon({
  className: "college-marker",
  html: `<div style="background: #059669; border: 3px solid white; border-radius: 50%; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; font-size: 18px; box-shadow: 0 4px 12px rgba(0,0,0,0.3);">🏫</div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 18],
});

interface RouteStop {
  id: number;
  routeId: number;
  name: string;
  lat: number;
  lng: number;
  scheduledTime: string;
  sequence: number;
}

interface RouteWithStops {
  id: number;
  name: string;
  displayOrder: number;
  isActive: boolean;
  stops: RouteStop[];
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
}

interface BusMapProps {
  routeId?: number;
  selectedStop?: string;
  showAllBuses?: boolean;
  role?: "student" | "admin";
}

function MapControls() {
  const map = useMap();

  return (
    <div className="absolute bottom-28 right-4 z-[1000] flex flex-col gap-2">
      <div className="flex flex-col overflow-hidden rounded-lg bg-white shadow-md">
        <Button
          size="icon"
          variant="ghost"
          onClick={() => map.zoomIn()}
          className="h-11 w-11 rounded-none"
          data-testid="button-zoom-in"
        >
          <Plus className="h-5 w-5" />
        </Button>
        <hr className="border-gray-200" />
        <Button
          size="icon"
          variant="ghost"
          onClick={() => map.zoomOut()}
          className="h-11 w-11 rounded-none"
          data-testid="button-zoom-out"
        >
          <Minus className="h-5 w-5" />
        </Button>
      </div>
      <Button
        size="icon"
        onClick={() => map.setView([HUBLI_CENTER.lat, HUBLI_CENTER.lng], 14)}
        className="h-11 w-11 rounded-full bg-yellow-500 hover:bg-yellow-600 text-gray-900 shadow-md"
        data-testid="button-center-map"
      >
        <Navigation className="h-5 w-5" />
      </Button>
    </div>
  );
}

export default function BusMap({ routeId, selectedStop, showAllBuses = false, role = "student" }: BusMapProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [busLocations, setBusLocations] = useState<Map<string, LocationUpdate>>(new Map());
  const [isMissed, setIsMissed] = useState(false);

  const { data: routeData } = useQuery<RouteWithStops>({
    queryKey: ["/api/routes", routeId],
    enabled: !!routeId,
  });

  const handleLocationUpdate = useCallback((location: LocationUpdate) => {
    setBusLocations(prev => {
      const updated = new Map(prev);
      updated.set(location.tripId, location);
      return updated;
    });
  }, []);

  const handleBusOffline = useCallback((tripId: string) => {
    setBusLocations(prev => {
      const updated = new Map(prev);
      updated.delete(tripId);
      return updated;
    });
  }, []);

  const { isConnected, locations: wsLocations } = useWebSocket({
    role: role === "admin" ? "admin" : "student",
    routeId: showAllBuses ? undefined : routeId,
    onLocationUpdate: handleLocationUpdate,
    onBusOffline: handleBusOffline,
  });

  useEffect(() => {
    const initialLocations = new Map<string, LocationUpdate>();
    wsLocations.forEach(loc => {
      initialLocations.set(loc.tripId, loc);
    });
    setBusLocations(initialLocations);
  }, [wsLocations]);

  const selectedStopData = routeData?.stops.find((s) => s.name === selectedStop);

  useEffect(() => {
    if (selectedStopData) {
      const now = new Date();
      const [hours, minutes] = selectedStopData.scheduledTime.split(":").map(Number);
      const scheduledDate = new Date();
      scheduledDate.setHours(hours, minutes, 0, 0);
      setIsMissed(now > scheduledDate && now.getHours() < 12);
    }
  }, [selectedStopData]);

  const routeCoordinates = routeData?.stops.map((s) => [s.lat, s.lng] as [number, number]) || [];

  const calculateETA = () => {
    if (!selectedStopData || busLocations.size === 0) return null;
    
    const busLocation = Array.from(busLocations.values())[0];
    if (!busLocation) return null;

    const distance = Math.sqrt(
      Math.pow(busLocation.lat - selectedStopData.lat, 2) +
      Math.pow(busLocation.lng - selectedStopData.lng, 2)
    );
    return Math.max(1, Math.round(distance * 500));
  };

  const eta = calculateETA();

  return (
    <div className="relative h-full w-full" data-testid="bus-map">
      {isMissed && routeData && selectedStopData && (
        <div className="absolute top-4 left-4 right-4 z-[1000]">
          <MissedBusAlert
            routeName={routeData.name}
            stopName={selectedStopData.name}
            departureTime={selectedStopData.scheduledTime}
          />
        </div>
      )}

      <div className="absolute top-4 left-4 right-4 z-[1000]" style={{ top: isMissed ? "140px" : "16px" }}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />
          <Input
            type="search"
            placeholder="Search destination or stop"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-full pl-10 pr-4 py-3 bg-white shadow-lg border-none focus:ring-2 focus:ring-yellow-400"
            data-testid="input-search-map"
          />
        </div>
      </div>

      {selectedStopData && eta !== null && !isMissed && (
        <div className="absolute top-20 left-4 right-4 z-[1000] bg-white/95 backdrop-blur rounded-lg p-4 shadow-lg" style={{ top: isMissed ? "200px" : "80px" }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Your Stop</p>
              <p className="font-semibold text-gray-900" data-testid="text-selected-stop">{selectedStop}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">ETA</p>
              <p className="text-2xl font-bold text-primary" data-testid="text-eta">{eta} min</p>
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-gray-200 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Expected arrival: <span className="font-medium" data-testid="text-arrival-time">
                {new Date(Date.now() + eta * 60000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            </p>
            <span className={`text-xs px-2 py-1 rounded-full ${isConnected ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
              {isConnected ? "Live" : "Offline"}
            </span>
          </div>
        </div>
      )}

      <MapContainer
        center={[HUBLI_CENTER.lat, HUBLI_CENTER.lng]}
        zoom={13}
        className="h-full w-full"
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <Marker position={[JCET_COLLEGE_COORDS.lat, JCET_COLLEGE_COORDS.lng]} icon={collegeIcon}>
          <Popup>JCET College - Destination</Popup>
        </Marker>

        {routeData && (
          <>
            <Polyline
              positions={routeCoordinates}
              pathOptions={{ color: "#0f766e", weight: 5, opacity: 0.8 }}
            />

            {routeData.stops.map((stop) => (
              <Marker
                key={stop.id}
                position={[stop.lat, stop.lng]}
                icon={stop.name === selectedStop ? selectedStopIcon : stopIcon}
              >
                <Popup>
                  <strong>{stop.name}</strong>
                  <br />
                  Scheduled: {stop.scheduledTime}
                </Popup>
              </Marker>
            ))}
          </>
        )}

        {Array.from(busLocations.values()).map((location) => (
          <Marker
            key={location.tripId}
            position={[location.lat, location.lng]}
            icon={busIcon}
          >
            <Popup>
              <strong>Live Bus Location</strong>
              <br />
              Route ID: {location.routeId}
              <br />
              <span className="text-green-600">Tracking live</span>
            </Popup>
          </Marker>
        ))}

        <MapControls />
      </MapContainer>
    </div>
  );
}
