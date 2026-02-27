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
import jgiLogo from "@assets/ChatGPT_Image_Feb_26,_2026,_10_28_00_PM_1772162764864.png";
import busIcon from "@assets/bus_1772162905635.jpeg";

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
  const busMarkerRef = useRef<maplibregl.Marker | null>(null);
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);
  const stopMarkersRef = useRef<maplibregl.Marker[]>([]);
  const routeLineRef = useRef<string | null>(null);
  const lastRouteUpdateRef = useRef<number>(0);
  const animationFrameRef = useRef<number | null>(null);
  const prevCoordsRef = useRef<[number, number] | null>(null);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [isMissed, setIsMissed] = useState(false);
  const [eta, setEta] = useState<number | null>(null);

  const { data: routeData } = useQuery<RouteWithStops>({
    queryKey: ["/api/routes", routeId],
    enabled: !!routeId,
  });

  const { isConnected, locations } = useWebSocket({
    role: role === "admin" ? "admin" : "student",
    routeId: showAllBuses ? undefined : routeId,
  });

  const selectedStopData = routeData?.stops.find((s) => s.name === selectedStop);

  const calculateBearing = (start: [number, number], end: [number, number]) => {
    const startLat = start[1] * Math.PI / 180;
    const startLng = start[0] * Math.PI / 180;
    const endLat = end[1] * Math.PI / 180;
    const endLng = end[0] * Math.PI / 180;
    const y = Math.sin(endLng - startLng) * Math.cos(endLat);
    const x = Math.cos(startLat) * Math.sin(endLat) -
          Math.sin(startLat) * Math.cos(endLat) * Math.cos(endLng - startLng);
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  };

  const updateLiveRoute = useCallback(async (busLocation: LocationUpdate) => {
    const map = mapRef.current;
    if (!map || !map.loaded() || !routeData) return;

    // Fixed route display logic
    const stops = [...routeData.stops].sort((a, b) => a.sequence - b.sequence);
    const coordinates = stops.map(s => [s.lng, s.lat]);
    
    const geojson: GeoJSON.Feature = {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: coordinates
      },
      properties: {}
    };

    const source = map.getSource('route') as maplibregl.GeoJSONSource;
    if (source) {
      source.setData(geojson);
    } else {
      map.addSource('route', { type: 'geojson', data: geojson });
      map.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'route',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#14b8a6', 'line-width': 5, 'line-opacity': 0.8 }
      });
    }

    // ETA calculation based on stop order
    if (selectedStopData) {
      const busIdx = findNearestStopIndex(busLocation, stops);
      const targetIdx = stops.findIndex(s => s.id === selectedStopData.id);

      if (busIdx > targetIdx) {
        setEta(-1); // Passed
      } else {
        let totalDist = 0;
        for (let i = busIdx; i < targetIdx; i++) {
          totalDist += calculateDistance(stops[i].lat, stops[i].lng, stops[i+1].lat, stops[i+1].lng);
        }
        const speed = busLocation.speed || 30; // fallback 30km/h
        setEta(Math.round((totalDist / speed) * 60));
      }
    }
  }, [routeData, selectedStopData]);

  const findNearestStopIndex = (loc: {lat: number, lng: number}, stops: RouteStop[]) => {
    let minD = Infinity;
    let idx = 0;
    stops.forEach((s, i) => {
      const d = calculateDistance(loc.lat, loc.lng, s.lat, s.lng);
      if (d < minD) {
        minD = d;
        idx = i;
      }
    });
    return idx;
  };

  function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  const animateMarker = useCallback((targetCoords: [number, number], heading?: number) => {
    if (!busMarkerRef.current) return;
    const marker = busMarkerRef.current;
    const startCoords = marker.getLngLat();
    const startTime = performance.now();
    const duration = 3000;

    const startLngLat = [startCoords.lng, startCoords.lat] as [number, number];
    const finalHeading = heading ?? (prevCoordsRef.current ? calculateBearing(prevCoordsRef.current, targetCoords) : 0);
    prevCoordsRef.current = targetCoords;

    const frame = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);

      const lng = startLngLat[0] + (targetCoords[0] - startLngLat[0]) * progress;
      const lat = startLngLat[1] + (targetCoords[1] - startLngLat[1]) * progress;

      marker.setLngLat([lng, lat]);
      const el = marker.getElement();
      el.style.transform = `rotate(${finalHeading}deg)`;

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(frame);
      }
    };

    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    animationFrameRef.current = requestAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: "raster",
            tiles: ["https://a.tile.openstreetmap.org/{z}/{x}/{y}.png"],
            tileSize: 256,
            attribution: "© OpenStreetMap contributors"
          }
        },
        layers: [{ id: "osm", type: "raster", source: "osm" }]
      },
      center: [HUBLI_CENTER.lng, HUBLI_CENTER.lat],
      zoom: 13,
      attributionControl: false
    });

    map.on('load', () => {
      map.addControl(new maplibregl.NavigationControl(), 'top-right');
      
      const el = document.createElement('div');
      el.className = 'college-marker';
      el.style.backgroundImage = `url(${jgiLogo})`;
      el.style.width = '45px';
      el.style.height = '45px';
      el.style.backgroundSize = 'contain';
      el.style.backgroundRepeat = 'no-repeat';
      el.style.cursor = 'pointer';
      el.style.borderRadius = '50%';
      el.style.backgroundColor = 'white';
      el.style.boxShadow = '0 0 10px rgba(0,0,0,0.2)';

      new maplibregl.Marker(el)
        .setLngLat([JCET_COLLEGE_COORDS.lng, JCET_COLLEGE_COORDS.lat])
        .setPopup(new maplibregl.Popup().setHTML('JCET College'))
        .addTo(map);

      // User location
      if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition((position) => {
          const { latitude, longitude } = position.coords;
          const userEl = document.createElement('div');
          userEl.className = 'user-marker';
          Object.assign(userEl.style, {
            width: '15px', height: '15px', borderRadius: '50%',
            backgroundColor: '#3b82f6', border: '2px solid white',
            boxShadow: '0 0 10px rgba(59, 130, 246, 0.5)'
          });
          userMarkerRef.current = new maplibregl.Marker(userEl)
            .setLngLat([longitude, latitude])
            .addTo(map);
          
          map.easeTo({ center: [longitude, latitude], zoom: 14 });
        });
      }
    });

    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || locations.length === 0) return;

    const loc = locations[0];
    if (!busMarkerRef.current) {
      const el = document.createElement('div');
      el.className = 'bus-marker';
      el.style.backgroundImage = `url(${busIcon})`;
      el.style.width = '50px';
      el.style.height = '50px';
      el.style.backgroundSize = 'contain';
      el.style.backgroundRepeat = 'no-repeat';
      el.style.transition = 'transform 0.3s ease-out';
      el.style.cursor = 'pointer';

      busMarkerRef.current = new maplibregl.Marker(el)
        .setLngLat([loc.lng, loc.lat])
        .setPopup(new maplibregl.Popup().setHTML(`<strong>Bus: ${loc.busId}</strong>`))
        .addTo(map);
    }

    animateMarker([loc.lng, loc.lat], loc.heading);
    updateLiveRoute(loc);
    
    if (role === "student" && mapRef.current) {
      mapRef.current.easeTo({ center: [loc.lng, loc.lat], duration: 1000 });
    }
  }, [locations, updateLiveRoute, animateMarker, role]);

  useEffect(() => {
    if (selectedStopData) {
      const now = new Date();
      const [hours, minutes] = selectedStopData.scheduledTime.split(":").map(Number);
      const scheduledDate = new Date();
      scheduledDate.setHours(hours, minutes, 0, 0);
      setIsMissed(now > scheduledDate && now.getHours() < 12);
    }
  }, [selectedStopData]);

  return (
    <div className="relative w-full h-screen" data-testid="bus-map">
      {isMissed && routeData && selectedStopData && (
        <div className="absolute top-4 left-4 right-4 z-50">
          <MissedBusAlert routeName={routeData.name} stopName={selectedStopData.name} departureTime={selectedStopData.scheduledTime} />
        </div>
      )}

      <div className="absolute top-4 left-4 right-4 z-50" style={{ top: isMissed ? "140px" : "16px" }}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />
          <Input type="search" placeholder="Search destination" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-full pl-10 pr-4 py-3 bg-white shadow-lg border-none focus:ring-2 focus:ring-yellow-400" />
        </div>
      </div>

      {selectedStopData && eta !== null && !isMissed && (
        <div className="absolute top-20 left-4 right-4 z-50 bg-white/95 backdrop-blur rounded-lg p-4 shadow-lg" style={{ top: isMissed ? "200px" : "80px" }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Your Stop</p>
              <p className="font-semibold text-gray-900" data-testid="text-selected-stop">{selectedStop}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">ETA</p>
              <p className="text-2xl font-bold text-primary" data-testid="text-eta">
                {eta === -1 ? "Passed" : `${eta} min`}
              </p>
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-gray-200 flex items-center justify-between">
            <p className="text-xs text-muted-foreground"> 
              {eta === -1 ? "Bus has already passed your stop" : `Expected arrival: ${new Date(Date.now() + eta * 60000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}
            </p>
            <span className={`text-xs px-2 py-1 rounded-full ${isConnected ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
              {isConnected ? "Live" : "Offline"}
            </span>
          </div>
        </div>
      )}

      <div ref={mapContainerRef} className="w-full h-full" />
      
      <div className="absolute bottom-28 right-4 z-50 flex flex-col gap-2">
        <div className="flex flex-col overflow-hidden rounded-lg bg-white shadow-md">
          <Button size="icon" variant="ghost" onClick={() => mapRef.current?.zoomIn()} className="h-11 w-11 rounded-none"><Plus className="h-5 w-5" /></Button>
          <hr className="border-gray-200" /><Button size="icon" variant="ghost" onClick={() => mapRef.current?.zoomOut()} className="h-11 w-11 rounded-none"><Minus className="h-5 w-5" /></Button>
        </div>
        <Button size="icon" onClick={() => mapRef.current?.flyTo({ center: [HUBLI_CENTER.lng, HUBLI_CENTER.lat], zoom: 14 })}
          className="h-11 w-11 rounded-full bg-yellow-500 hover:bg-yellow-600 text-gray-900 shadow-md"><Navigation className="h-5 w-5" /></Button>
      </div>
    </div>
  );
}
