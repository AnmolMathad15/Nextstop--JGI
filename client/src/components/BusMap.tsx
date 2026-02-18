import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useRef, useState, useCallback } from "react";
import { Search, Plus, Minus, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useQuery } from "@tanstack/react-query";
import { useWebSocket } from "@/hooks/useWebSocket";
import { HUBLI_CENTER, JCET_COLLEGE_COORDS } from "@/lib/constants";
import MissedBusAlert from "./MissedBusAlert";

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

export default function BusMap({ routeId, selectedStop, showAllBuses = false, role = "student" }: BusMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const busMarkersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const stopMarkersRef = useRef<maplibregl.Marker[]>([]);
  const routeLineRef = useRef<string | null>(null);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [isMissed, setIsMissed] = useState(false);

  const { data: routeData } = useQuery<RouteWithStops>({
    queryKey: ["/api/routes", routeId],
    enabled: !!routeId,
  });

  const { isConnected, locations } = useWebSocket({
    role: role === "admin" ? "admin" : "student",
    routeId: showAllBuses ? undefined : routeId,
  });

  const selectedStopData = routeData?.stops.find((s) => s.name === selectedStop);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: 'https://demotiles.maplibre.org/style.json',
      center: [HUBLI_CENTER.lng, HUBLI_CENTER.lat],
      zoom: 13,
      attributionControl: false
    });

    map.addControl(new maplibregl.NavigationControl(), 'top-right');
    mapRef.current = map;

    // College Marker
    const el = document.createElement('div');
    el.className = 'college-marker';
    el.innerHTML = '🏫';
    el.style.background = '#059669';
    el.style.border = '3px solid white';
    el.style.borderRadius = '50%';
    el.style.width = '36px';
    el.style.height = '36px';
    el.style.display = 'flex';
    el.style.alignItems = 'center';
    el.style.justifyContent = 'center';
    el.style.fontSize = '18px';
    el.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';

    new maplibregl.Marker(el)
      .setLngLat([JCET_COLLEGE_COORDS.lng, JCET_COLLEGE_COORDS.lat])
      .setPopup(new maplibregl.Popup().setHTML('JCET College - Destination'))
      .addTo(map);

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update Route and Stops
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !routeData) return;

    // Clear old markers
    stopMarkersRef.current.forEach(m => m.remove());
    stopMarkersRef.current = [];

    const coords = routeData.stops.map(s => [s.lng, s.lat] as [number, number]);

    // Route Line
    if (map.loaded()) {
      updateRouteLayer(map, coords);
    } else {
      map.on('load', () => updateRouteLayer(map, coords));
    }

    // Stop Markers
    routeData.stops.forEach(stop => {
      const isSelected = stop.name === selectedStop;
      const el = document.createElement('div');
      el.className = isSelected ? 'selected-stop-marker' : 'stop-marker';
      
      if (isSelected) {
        el.style.background = '#facc15';
        el.style.border = '3px solid #854d0e';
        el.style.boxShadow = '0 0 12px rgba(250,204,21,0.8)';
        el.style.width = '28px';
        el.style.height = '28px';
      } else {
        el.style.background = '#0f766e';
        el.style.border = '2px solid white';
        el.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';
        el.style.width = '20px';
        el.style.height = '20px';
      }
      el.style.borderRadius = '50%';

      const marker = new maplibregl.Marker(el)
        .setLngLat([stop.lng, stop.lat])
        .setPopup(new maplibregl.Popup().setHTML(`<strong>${stop.name}</strong><br/>Scheduled: ${stop.scheduledTime}`))
        .addTo(map);
      
      stopMarkersRef.current.push(marker);
    });

  }, [routeData, selectedStop]);

  const updateRouteLayer = (map: maplibregl.Map, coords: [number, number][]) => {
    const sourceId = 'route-source';
    const layerId = 'route-layer';

    if (map.getSource(sourceId)) {
      (map.getSource(sourceId) as maplibregl.GeoJSONSource).setData({
        type: 'Feature',
        properties: {},
        geometry: { type: 'LineString', coordinates: coords }
      });
    } else {
      map.addSource(sourceId, {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: { type: 'LineString', coordinates: coords }
        }
      });
      map.addLayer({
        id: layerId,
        type: 'line',
        source: sourceId,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#0f766e', 'line-width': 5, 'line-opacity': 0.8 }
      });
    }
  };

  // Update Bus Markers (Live)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    locations.forEach(loc => {
      let marker = busMarkersRef.current.get(loc.tripId);
      
      if (!marker) {
        const el = document.createElement('div');
        el.className = 'bus-marker';
        el.innerHTML = '🚌';
        el.style.background = '#facc15';
        el.style.border = '3px solid #854d0e';
        el.style.borderRadius = '50%';
        el.style.width = '40px';
        el.style.height = '40px';
        el.style.display = 'flex';
        el.style.alignItems = 'center';
        el.style.justifyContent = 'center';
        el.style.fontSize = '20px';
        el.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
        el.style.transition = 'transform 3s linear';

        marker = new maplibregl.Marker(el)
          .setLngLat([loc.lng, loc.lat])
          .setPopup(new maplibregl.Popup().setHTML(`<strong>Bus: ${loc.busId}</strong><br/>Route: ${loc.routeId}`))
          .addTo(map);
        
        busMarkersRef.current.set(loc.tripId, marker);
      } else {
        // Animate movement
        animateMarker(marker, [loc.lng, loc.lat], loc.heading || 0);
      }
    });

    // Remove offline buses
    const activeTripIds = new Set(locations.map(l => l.tripId));
    busMarkersRef.current.forEach((marker, tripId) => {
      if (!activeTripIds.has(tripId)) {
        marker.remove();
        busMarkersRef.current.delete(tripId);
      }
    });
  }, [locations]);

  const animateMarker = (marker: maplibregl.Marker, targetCoords: [number, number], heading: number) => {
    const startCoords = marker.getLngLat();
    const startTime = performance.now();
    const duration = 3000;

    const frame = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);

      const lng = startCoords.lng + (targetCoords[0] - startCoords.lng) * progress;
      const lat = startCoords.lat + (targetCoords[1] - startCoords.lat) * progress;

      marker.setLngLat([lng, lat]);
      
      const el = marker.getElement();
      el.style.transform = `rotate(${heading}deg)`;

      if (progress < 1) {
        requestAnimationFrame(frame);
      }
    };

    requestAnimationFrame(frame);
  };

  useEffect(() => {
    if (selectedStopData) {
      const now = new Date();
      const [hours, minutes] = selectedStopData.scheduledTime.split(":").map(Number);
      const scheduledDate = new Date();
      scheduledDate.setHours(hours, minutes, 0, 0);
      setIsMissed(now > scheduledDate && now.getHours() < 12);
    }
  }, [selectedStopData]);

  const calculateETA = () => {
    if (!selectedStopData || locations.length === 0) return null;
    const busLocation = locations[0];
    const distance = Math.sqrt(
      Math.pow(busLocation.lat - selectedStopData.lat, 2) +
      Math.pow(busLocation.lng - selectedStopData.lng, 2)
    );
    return Math.max(1, Math.round(distance * 500));
  };

  const eta = calculateETA();

  return (
    <div className="relative w-full" style={{ height: "100vh", minHeight: "100vh" }} data-testid="bus-map">
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

      <div ref={mapContainerRef} className="w-full h-full" />
      
      {/* Custom Map Controls */}
      <div className="absolute bottom-28 right-4 z-[1000] flex flex-col gap-2">
        <div className="flex flex-col overflow-hidden rounded-lg bg-white shadow-md">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => mapRef.current?.zoomIn()}
            className="h-11 w-11 rounded-none"
            data-testid="button-zoom-in"
          >
            <Plus className="h-5 w-5" />
          </Button>
          <hr className="border-gray-200" />
          <Button
            size="icon"
            variant="ghost"
            onClick={() => mapRef.current?.zoomOut()}
            className="h-11 w-11 rounded-none"
            data-testid="button-zoom-out"
          >
            <Minus className="h-5 w-5" />
          </Button>
        </div>
        <Button
          size="icon"
          onClick={() => mapRef.current?.flyTo({ center: [HUBLI_CENTER.lng, HUBLI_CENTER.lat], zoom: 14 })}
          className="h-11 w-11 rounded-full bg-yellow-500 hover:bg-yellow-600 text-gray-900 shadow-md"
          data-testid="button-center-map"
        >
          <Navigation className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}
