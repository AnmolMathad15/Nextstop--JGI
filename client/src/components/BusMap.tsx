import { useEffect, useState, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import { Search, Plus, Minus, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { HUBLI_CENTER, ROUTES_DATA, JCET_COLLEGE_COORDS } from "@/lib/constants";
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

interface BusMapProps {
  routeId?: number;
  selectedStop?: string;
  showAllBuses?: boolean;
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

export default function BusMap({ routeId, selectedStop, showAllBuses = false }: BusMapProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [busPosition, setBusPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [eta, setEta] = useState<number | null>(null);
  const [isMissed, setIsMissed] = useState(false);
  const animationRef = useRef<number>();

  const selectedRouteData = routeId ? ROUTES_DATA.find((r) => r.id === routeId) : null;
  const selectedStopData = selectedRouteData?.stops.find((s) => s.name === selectedStop);

  useEffect(() => {
    if (!selectedRouteData) return;

    const stops = selectedRouteData.stops;
    let currentIndex = 0;
    let progress = 0;

    // todo: remove mock functionality - replace with real-time WebSocket data
    const animate = () => {
      if (currentIndex >= stops.length - 1) {
        currentIndex = 0;
        progress = 0;
      }

      const start = stops[currentIndex];
      const end = stops[currentIndex + 1];

      const lat = start.lat + (end.lat - start.lat) * progress;
      const lng = start.lng + (end.lng - start.lng) * progress;

      setBusPosition({ lat, lng });

      progress += 0.02;
      if (progress >= 1) {
        progress = 0;
        currentIndex++;
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [selectedRouteData]);

  useEffect(() => {
    if (busPosition && selectedStopData) {
      const distance = Math.sqrt(
        Math.pow(busPosition.lat - selectedStopData.lat, 2) +
        Math.pow(busPosition.lng - selectedStopData.lng, 2)
      );
      const estimatedMinutes = Math.round(distance * 500);
      setEta(estimatedMinutes);

      // todo: remove mock functionality - Check if bus has passed the stop
      const now = new Date();
      const [hours, minutes] = selectedStopData.scheduledTime.split(":").map(Number);
      const scheduledDate = new Date();
      scheduledDate.setHours(hours, minutes, 0, 0);

      // For demo, show missed alert if current time is past 8 AM
      setIsMissed(now.getHours() >= 20);
    }
  }, [busPosition, selectedStopData]);

  const routeCoordinates = selectedRouteData?.stops.map((s) => [s.lat, s.lng] as [number, number]) || [];

  return (
    <div className="relative h-full w-full" data-testid="bus-map">
      {isMissed && selectedRouteData && selectedStopData && (
        <div className="absolute top-4 left-4 right-4 z-[1000]">
          <MissedBusAlert
            routeName={selectedRouteData.name}
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
          <div className="mt-2 pt-2 border-t border-gray-200">
            <p className="text-xs text-muted-foreground">
              Expected arrival: <span className="font-medium" data-testid="text-arrival-time">
                {new Date(Date.now() + eta * 60000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            </p>
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

        {selectedRouteData && (
          <>
            <Polyline
              positions={routeCoordinates}
              pathOptions={{ color: "#0f766e", weight: 5, opacity: 0.8 }}
            />

            {selectedRouteData.stops.map((stop) => (
              <Marker
                key={stop.name}
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

        {busPosition && (
          <Marker position={[busPosition.lat, busPosition.lng]} icon={busIcon}>
            <Popup>
              <strong>Bus Location</strong>
              <br />
              {selectedRouteData?.name}
            </Popup>
          </Marker>
        )}

        {showAllBuses && ROUTES_DATA.map((route) => (
          <Marker
            key={route.id}
            position={[route.stops[Math.floor(route.stops.length / 2)].lat, route.stops[Math.floor(route.stops.length / 2)].lng]}
            icon={busIcon}
          >
            <Popup>
              <strong>{route.name}</strong>
              <br />
              Bus in transit
            </Popup>
          </Marker>
        ))}

        <MapControls />
      </MapContainer>
    </div>
  );
}
