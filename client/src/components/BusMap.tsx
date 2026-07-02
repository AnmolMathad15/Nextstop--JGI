import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useRef, useState, useCallback } from "react";
import { Search, Navigation, MapPin, Clock, Wifi, WifiOff, Bus, ChevronUp, ChevronDown, Signal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { useWebSocket } from "@/hooks/useWebSocket";
import { HUBLI_CENTER, JCET_COLLEGE_COORDS } from "@/lib/constants";
import jgiLogo from "@/assets/jgi-logo.png";
import busIcon from "@/assets/bus-icon.jpeg";

// ── Types ─────────────────────────────────────────────────────────────────────

interface RouteStop {
  id: number;
  routeId: number;
  name: string;
  lat: number;
  lng: number;
  scheduledTime: string;
  time1015am?: string;
  sequence: number;
  isMainStop?: boolean;
}

interface RouteWithStops {
  id: number;
  name: string;
  displayOrder: number;
  isActive: boolean;
  stops: RouteStop[];
}

interface LiveLocation {
  tripId?: string;
  routeId?: number;
  busId?: string;
  lat: number;
  lng: number;
  speed?: number;
  heading?: number;
  accuracy?: number;
  driverOnline?: boolean;
}

interface BusMapProps {
  routeId?: number;
  selectedStop?: string;
  showAllBuses?: boolean;
  role?: "student" | "admin";
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function calcBearing(from: [number, number], to: [number, number]): number {
  const fLat = (from[1] * Math.PI) / 180, fLng = (from[0] * Math.PI) / 180;
  const tLat = (to[1]   * Math.PI) / 180, tLng = (to[0]   * Math.PI) / 180;
  const y = Math.sin(tLng - fLng) * Math.cos(tLat);
  const x = Math.cos(fLat) * Math.sin(tLat) - Math.sin(fLat) * Math.cos(tLat) * Math.cos(tLng - fLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function nearestStopIdx(loc: { lat: number; lng: number }, stops: RouteStop[]): number {
  let minD = Infinity, idx = 0;
  stops.forEach((s, i) => {
    const d = haversineKm(loc.lat, loc.lng, s.lat, s.lng);
    if (d < minD) { minD = d; idx = i; }
  });
  return idx;
}

function isMain(stop: RouteStop, idx: number, total: number): boolean {
  return !!(stop.isMainStop) || idx === 0 || idx === total - 1 || idx % 3 === 0;
}

// CartoDB Positron — clean, minimal, desaturated base map
const CARTO_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    carto: {
      type: "raster",
      tiles: [
        "https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png",
        "https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png",
        "https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png",
      ],
      tileSize: 256,
      attribution:
        '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors © <a href="https://carto.com/">CARTO</a>',
    },
  },
  layers: [{ id: "carto-light", type: "raster", source: "carto" }],
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function BusMap({
  routeId,
  selectedStop,
  showAllBuses = false,
  role = "student",
}: BusMapProps) {
  const containerRef    = useRef<HTMLDivElement>(null);
  const mapRef          = useRef<maplibregl.Map | null>(null);
  const busMarkerRef    = useRef<maplibregl.Marker | null>(null);
  const stopMarkersRef  = useRef<maplibregl.Marker[]>([]);
  const animFrameRef    = useRef<number | null>(null);
  const prevCoordsRef   = useRef<[number, number] | null>(null);
  const offlineTimerRef = useRef<NodeJS.Timeout | null>(null);
  const stopItemsRef    = useRef<Map<number, HTMLDivElement>>(new Map());

  const [sheetOpen,    setSheetOpen]    = useState(false);
  const [stopSearch,   setStopSearch]   = useState("");
  const [activeStopId, setActiveStopId] = useState<number | null>(null);
  const [isOffline,    setIsOffline]    = useState(false);
  const [liveSpeed,    setLiveSpeed]    = useState<number | null>(null);
  const [eta,          setEta]          = useState<number | null>(null);
  const [stopETAs,     setStopETAs]     = useState<Map<number, number>>(new Map());
  const [mapLoaded,    setMapLoaded]    = useState(false);

  // ── Data ───────────────────────────────────────────────────────────────────
  const { data: routeData } = useQuery<RouteWithStops>({
    queryKey: ["/api/routes", routeId],
    enabled: !!routeId,
  });

  const { isConnected, locations } = useWebSocket({
    role: role === "admin" ? "admin" : "student",
    routeId: showAllBuses ? undefined : routeId,
    onBusOffline: useCallback((_tripId: string, _rId: number) => setIsOffline(true), []),
  });

  const selectedStopData = routeData?.stops.find(s => s.name === selectedStop);

  // ── Map initialisation ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: CARTO_STYLE,
      center: [JCET_COLLEGE_COORDS.lng, JCET_COLLEGE_COORDS.lat],
      zoom: 14,
      attributionControl: false,
    });

    map.on("load", () => {
      map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");

      // ── JCET College pin (always visible) ──
      const colEl = document.createElement("div");
      colEl.className = "nextstop-college-marker";
      const colImg = document.createElement("img");
      colImg.src = jgiLogo;
      colImg.style.cssText = "width:100%;height:100%;object-fit:cover;border-radius:50%;";
      colEl.appendChild(colImg);

      new maplibregl.Marker({ element: colEl, anchor: "center" })
        .setLngLat([JCET_COLLEGE_COORDS.lng, JCET_COLLEGE_COORDS.lat])
        .setPopup(
          new maplibregl.Popup({
            closeButton: false,
            offset: 28,
            className: "nextstop-popup",
          }).setHTML(
            `<p style="font-weight:700;margin:0 0 3px">🏫 JCET College</p>
             <p style="font-size:11px;color:#6b7280;margin:0">Jain College of Engineering &amp; Technology</p>`
          )
        )
        .addTo(map);

      setMapLoaded(true);
    });

    mapRef.current = map;
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (offlineTimerRef.current) clearTimeout(offlineTimerRef.current);
      map.remove();
      mapRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Route rendering ────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded || !routeData) return;

    // Clear old stop markers
    stopMarkersRef.current.forEach(m => m.remove());
    stopMarkersRef.current = [];
    stopItemsRef.current.clear();

    const stops = [...routeData.stops].sort((a, b) => a.sequence - b.sequence);

    // ── Draw polyline ─────────────────────────────────────────────────────
    const coords = stops.map(s => [s.lng, s.lat]);
    const geoJson = {
      type: "Feature" as const,
      geometry: { type: "LineString" as const, coordinates: coords },
      properties: {},
    };

    const src = map.getSource("route") as maplibregl.GeoJSONSource | undefined;
    if (src) {
      src.setData(geoJson);
    } else {
      map.addSource("route", { type: "geojson", data: geoJson });
      // Soft glow behind the line
      map.addLayer({
        id: "route-shadow",
        type: "line",
        source: "route",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-color": "#0d9488", "line-width": 10, "line-opacity": 0.12, "line-blur": 5 },
      });
      // Main teal line
      map.addLayer({
        id: "route-line",
        type: "line",
        source: "route",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-color": "#0d9488", "line-width": 4, "line-opacity": 0.9 },
      });
      // Subtle white dashes
      map.addLayer({
        id: "route-dash",
        type: "line",
        source: "route",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-color": "#ffffff", "line-width": 1.5, "line-opacity": 0.3, "line-dasharray": [4, 8] },
      });
    }

    // ── Stop markers ──────────────────────────────────────────────────────
    stops.forEach((stop, idx) => {
      const main   = isMain(stop, idx, stops.length);
      const isLast = idx === stops.length - 1;

      const el = document.createElement("div");
      el.className = isLast
        ? "nextstop-stop-destination"
        : main
          ? "nextstop-stop-main"
          : "nextstop-stop-sub";
      if (isLast) el.textContent = "🏫";
      el.title = stop.name;

      el.addEventListener("click", () => {
        setActiveStopId(stop.id);
        setSheetOpen(true);
        map.flyTo({ center: [stop.lng, stop.lat], zoom: 16, duration: 800 });
        setTimeout(() => {
          stopItemsRef.current.get(stop.id)?.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 300);
      });

      const popup = new maplibregl.Popup({
        closeButton: false,
        offset: main ? 14 : 9,
        className: "nextstop-popup",
      }).setHTML(
        `<p style="font-weight:600;margin:0 0 3px">${stop.name}</p>
         <p style="font-size:11px;color:#6b7280;margin:0">⏰ ${stop.scheduledTime}${stop.time1015am ? ` / ${stop.time1015am}` : ""}</p>`
      );

      const marker = new maplibregl.Marker({ element: el, anchor: "center" })
        .setLngLat([stop.lng, stop.lat])
        .setPopup(popup)
        .addTo(map);

      stopMarkersRef.current.push(marker);
    });

    // ── Auto-fit viewport to route ────────────────────────────────────────
    const bounds = new maplibregl.LngLatBounds();
    stops.forEach(s => bounds.extend([s.lng, s.lat]));
    map.fitBounds(bounds, {
      padding: { top: 80, bottom: 230, left: 60, right: 60 },
      maxZoom: 15,
      duration: 1200,
    });
  }, [routeData, mapLoaded]);

  // ── Active stop highlight ──────────────────────────────────────────────────
  useEffect(() => {
    stopMarkersRef.current.forEach(m => m.getElement().classList.remove("active"));
    if (activeStopId !== null) {
      const sorted = (routeData?.stops ?? []).sort((a, b) => a.sequence - b.sequence);
      const idx = sorted.findIndex(s => s.id === activeStopId);
      if (idx >= 0) stopMarkersRef.current[idx]?.getElement().classList.add("active");
    }
  }, [activeStopId, routeData]);

  // ── Smooth marker animation ────────────────────────────────────────────────
  const animateMarker = useCallback((target: [number, number], heading?: number) => {
    const marker = busMarkerRef.current;
    if (!marker) return;

    const start = marker.getLngLat();
    const from: [number, number] = [start.lng, start.lat];
    const bearing = heading ?? (prevCoordsRef.current ? calcBearing(prevCoordsRef.current, target) : 0);
    prevCoordsRef.current = target;

    const t0  = performance.now();
    const dur = 2800;

    const frame = (now: number) => {
      const p    = Math.min((now - t0) / dur, 1);
      const ease = p < 0.5 ? 2 * p * p : -1 + (4 - 2 * p) * p;
      marker.setLngLat([from[0] + (target[0] - from[0]) * ease, from[1] + (target[1] - from[1]) * ease]);
      const icon = marker.getElement().querySelector(".nextstop-bus-icon") as HTMLElement | null;
      if (icon) icon.style.transform = `translate(-50%,-50%) rotate(${bearing}deg)`;
      if (p < 1) animFrameRef.current = requestAnimationFrame(frame);
    };

    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    animFrameRef.current = requestAnimationFrame(frame);
  }, []);

  // ── ETA computation ────────────────────────────────────────────────────────
  const updateStopETAs = useCallback(
    (loc: LiveLocation, stops: RouteStop[]) => {
      const sorted = [...stops].sort((a, b) => a.sequence - b.sequence);
      const busIdx = nearestStopIdx(loc, sorted);
      const speed  = loc.speed && loc.speed > 2 ? loc.speed : 30;

      const map = new Map<number, number>();
      sorted.forEach((stop, idx) => {
        if (idx < busIdx) {
          map.set(stop.id, -1);
        } else {
          let dist = 0;
          for (let i = busIdx; i < idx; i++) {
            dist += haversineKm(sorted[i].lat, sorted[i].lng, sorted[i + 1].lat, sorted[i + 1].lng);
          }
          map.set(stop.id, Math.max(0, Math.round((dist / speed) * 60)));
        }
      });
      setStopETAs(map);
      if (selectedStopData) setEta(map.get(selectedStopData.id) ?? null);
    },
    [selectedStopData]
  );

  // ── Live location handler ──────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || locations.length === 0) return;

    const loc = locations[0] as LiveLocation;
    setIsOffline(loc.driverOnline === false);
    setLiveSpeed(loc.speed ?? null);

    // Create bus marker on first GPS ping
    if (!busMarkerRef.current) {
      const wrapper = document.createElement("div");
      wrapper.className = "nextstop-bus-wrapper";
      const pulse = document.createElement("div");
      pulse.className = "nextstop-bus-pulse";
      wrapper.appendChild(pulse);
      const icon = document.createElement("img");
      icon.src = busIcon;
      icon.className = "nextstop-bus-icon";
      wrapper.appendChild(icon);
      busMarkerRef.current = new maplibregl.Marker({ element: wrapper, anchor: "center" })
        .setLngLat([loc.lng, loc.lat])
        .addTo(map);
    }

    animateMarker([loc.lng, loc.lat], loc.heading);
    if (routeData) updateStopETAs(loc, routeData.stops);
    if (role === "student") {
      map.easeTo({ center: [loc.lng, loc.lat], duration: 1500 });
    }

    // Offline detection — 15 s silence = offline
    if (offlineTimerRef.current) clearTimeout(offlineTimerRef.current);
    offlineTimerRef.current = setTimeout(() => setIsOffline(true), 15_000);
  }, [locations, routeData, animateMarker, updateStopETAs, role]);

  // ── Fly to stop ────────────────────────────────────────────────────────────
  const flyToStop = useCallback((stop: RouteStop) => {
    mapRef.current?.flyTo({ center: [stop.lng, stop.lat], zoom: 16, duration: 800 });
    setActiveStopId(stop.id);
    setSheetOpen(true);
    setTimeout(() => {
      stopItemsRef.current.get(stop.id)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 300);
  }, []);

  // ── Derived ────────────────────────────────────────────────────────────────
  const sortedStops = routeData
    ? [...routeData.stops].sort((a, b) => a.sequence - b.sequence)
    : [];

  const filteredStops = stopSearch.trim()
    ? sortedStops.filter(s => s.name.toLowerCase().includes(stopSearch.toLowerCase()))
    : sortedStops;

  const etaLabel = (stopId: number) => {
    const v = stopETAs.get(stopId);
    if (v === undefined) {
      const stop = sortedStops.find(s => s.id === stopId);
      return <span className="text-xs text-gray-400">{stop?.scheduledTime}</span>;
    }
    if (v === -1) return <span className="text-xs text-gray-300">Passed</span>;
    if (v === 0)  return <span className="text-xs font-semibold text-green-600">~Now</span>;
    return <span className="text-xs font-semibold text-teal-600">~{v} min</span>;
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="relative w-full h-full overflow-hidden" data-testid="bus-map">

      {/* Map canvas */}
      <div ref={containerRef} className="absolute inset-0" />

      {/* ── No route overlay ─────────────────────────────────────────────── */}
      {!routeId && (
        <div className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none">
          <div className="bg-white/96 backdrop-blur rounded-2xl shadow-xl p-7 mx-6 text-center pointer-events-auto max-w-xs">
            <div className="w-14 h-14 bg-teal-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <MapPin className="h-7 w-7 text-teal-600" />
            </div>
            <h3 className="font-bold text-gray-900 mb-2">Select Your Route</h3>
            <p className="text-sm text-gray-500 leading-relaxed">
              Go to the Routes tab, choose your bus route and boarding stop — the live map will appear here.
            </p>
          </div>
        </div>
      )}

      {/* ── Offline banner ────────────────────────────────────────────────── */}
      {isOffline && locations.length > 0 && (
        <div className="absolute top-3 left-3 right-3 z-50" data-testid="offline-banner">
          <div className="bg-gray-900/92 text-white rounded-xl px-4 py-3 flex items-center gap-3 shadow-xl">
            <div className="p-1.5 bg-red-500 rounded-lg flex-shrink-0">
              <WifiOff className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm">Driver Offline</p>
              <p className="text-xs text-gray-300 truncate">Showing last known location</p>
            </div>
            <Signal className="h-4 w-4 text-red-400 animate-pulse flex-shrink-0" />
          </div>
        </div>
      )}

      {/* ── Live status badge ─────────────────────────────────────────────── */}
      <div className="absolute top-3 right-3 z-50">
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium shadow-md ${
            isConnected && !isOffline ? "bg-green-500 text-white" : "bg-gray-600/90 text-white"
          }`}
          data-testid="status-connection"
        >
          {isConnected && !isOffline
            ? <><Wifi className="h-3 w-3" /> Live</>
            : <><WifiOff className="h-3 w-3" /> Offline</>}
        </span>
      </div>

      {/* ── ETA chip (bus is live + stop is selected) ─────────────────────── */}
      {selectedStopData && eta !== null && (
        <div
          className="absolute left-3 right-3 z-40 bg-white/96 backdrop-blur rounded-xl px-4 py-3 shadow-lg flex items-center gap-3"
          style={{ top: isOffline && locations.length > 0 ? "72px" : "48px" }}
          data-testid="eta-panel"
        >
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-400">Your stop</p>
            <p className="font-semibold text-gray-900 text-sm truncate" data-testid="text-selected-stop">
              {selectedStop}
            </p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-xs text-gray-400">ETA</p>
            <p className="text-xl font-bold text-teal-600" data-testid="text-eta">
              {eta === -1 ? "Passed" : eta === 0 ? "~Now" : `${eta} min`}
            </p>
          </div>
          {liveSpeed !== null && (
            <div className="text-right flex-shrink-0 border-l border-gray-100 pl-3">
              <p className="text-xs text-gray-400">Speed</p>
              <p className="text-sm font-semibold text-blue-600">
                {liveSpeed.toFixed(0)}<span className="text-xs font-normal"> km/h</span>
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Re-centre button ─────────────────────────────────────────────── */}
      <div
        className="absolute right-3 z-40 transition-all duration-300"
        style={{ bottom: sheetOpen ? "calc(55vh + 10px)" : "214px" }}
      >
        <Button
          size="icon"
          className="h-10 w-10 rounded-full bg-white text-gray-700 shadow-md hover:bg-gray-50 border border-gray-200"
          onClick={() => {
            if (locations.length > 0) {
              mapRef.current?.flyTo({ center: [locations[0].lng, locations[0].lat], zoom: 15 });
            } else {
              mapRef.current?.flyTo({ center: [JCET_COLLEGE_COORDS.lng, JCET_COLLEGE_COORDS.lat], zoom: 14 });
            }
          }}
          data-testid="button-recenter"
        >
          <Navigation className="h-4 w-4" />
        </Button>
      </div>

      {/* ── Bottom Sheet ─────────────────────────────────────────────────── */}
      {routeId && routeData && (
        <div
          className="absolute left-0 right-0 z-50 bg-white rounded-t-2xl shadow-2xl flex flex-col"
          style={{
            bottom: 0,
            height: sheetOpen ? "55vh" : "200px",
            transition: "height 0.35s cubic-bezier(0.4,0,0.2,1)",
          }}
          data-testid="stop-sheet"
        >
          {/* Header — tappable to expand/collapse */}
          <div
            className="flex-shrink-0 cursor-pointer select-none"
            onClick={() => setSheetOpen(o => !o)}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-gray-200 rounded-full" />
            </div>

            {/* Route name + meta */}
            <div className="flex items-center justify-between px-4 py-1.5">
              <div className="min-w-0">
                <p className="font-bold text-gray-900 text-sm capitalize truncate">
                  {routeData.name}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {filteredStops.length !== sortedStops.length
                    ? `${filteredStops.length} of ${sortedStops.length} stops`
                    : `${sortedStops.length} stops`}
                  {locations.length > 0 && !isOffline && (
                    <span className="ml-2 text-green-500 font-medium">● Active</span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {liveSpeed !== null && !isOffline && (
                  <Badge variant="outline" className="text-xs gap-1 text-blue-600 border-blue-200 py-0.5">
                    <Bus className="h-3 w-3" />
                    {liveSpeed.toFixed(0)} km/h
                  </Badge>
                )}
                {sheetOpen
                  ? <ChevronDown className="h-5 w-5 text-gray-400" />
                  : <ChevronUp   className="h-5 w-5 text-gray-400" />}
              </div>
            </div>

            {/* Search */}
            <div className="px-4 py-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                <Input
                  placeholder="Search stops…"
                  value={stopSearch}
                  onChange={e => {
                    setStopSearch(e.target.value);
                    if (!sheetOpen) setSheetOpen(true);
                  }}
                  className="pl-8 h-8 text-sm bg-gray-50 border-gray-200 rounded-lg"
                  onClick={e => e.stopPropagation()}
                  data-testid="input-stop-search"
                />
              </div>
            </div>
          </div>

          {/* Scrollable stop list */}
          <div className="flex-1 overflow-y-auto overscroll-contain">
            {filteredStops.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                <Search className="h-8 w-8 mb-2 opacity-40" />
                <p className="text-sm">No stops match "{stopSearch}"</p>
              </div>
            ) : (
              <div className="px-3 pb-20 pt-1">
                {filteredStops.map((stop, idx) => {
                  const etaVal   = stopETAs.get(stop.id);
                  const isPassed = etaVal === -1;
                  const isCurr   = etaVal === 0;
                  const isActive = activeStopId === stop.id;
                  const isSel    = stop.name === selectedStop;
                  const main     = isMain(stop, idx, filteredStops.length);
                  const isLast   = idx === filteredStops.length - 1;

                  return (
                    <div
                      key={stop.id}
                      ref={el => el && stopItemsRef.current.set(stop.id, el)}
                      onClick={() => flyToStop(stop)}
                      className={`flex items-start gap-3 px-2 py-2.5 rounded-xl cursor-pointer transition-all duration-150 ${
                        isActive ? "bg-teal-50 ring-1 ring-inset ring-teal-200"
                        : isSel  ? "bg-amber-50"
                        : "hover:bg-gray-50 active:bg-gray-100"
                      }`}
                      data-testid={`stop-row-${stop.id}`}
                    >
                      {/* Vertical connector */}
                      <div className="flex flex-col items-center mt-1 flex-shrink-0" style={{ width: 18 }}>
                        <div className={`rounded-full flex-shrink-0 border-2 transition-all ${
                          isCurr   ? "w-4 h-4 bg-green-500 border-green-400 shadow-[0_0_0_3px_rgba(34,197,94,0.2)]"
                          : isPassed ? "w-2.5 h-2.5 bg-gray-200 border-gray-200"
                          : isSel    ? "w-4 h-4 bg-amber-400 border-amber-300"
                          : isActive  ? "w-4 h-4 bg-teal-500 border-teal-400"
                          : main      ? "w-3.5 h-3.5 bg-white border-teal-400"
                          :             "w-2 h-2 bg-teal-300 border-transparent"
                        }`} />
                        {!isLast && (
                          <div className={`w-0.5 mt-1 ${isPassed ? "bg-gray-100" : "bg-teal-100"}`} style={{ height: 20 }} />
                        )}
                      </div>

                      {/* Name + time */}
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm leading-snug ${
                          isPassed   ? "text-gray-300 line-through"
                          : isSel    ? "font-bold text-amber-700"
                          : isActive ? "font-semibold text-teal-700"
                          : main     ? "font-medium text-gray-800"
                          :            "text-gray-600"
                        }`}>
                          {stop.name}
                          {isSel  && <span className="ml-1 text-xs">📍</span>}
                          {isCurr && <span className="ml-1 text-xs">🚌</span>}
                        </p>
                        <p className={`text-xs mt-0.5 flex items-center gap-1 ${isPassed ? "text-gray-200" : "text-gray-400"}`}>
                          <Clock className="h-2.5 w-2.5 inline" />
                          {stop.scheduledTime}
                          {stop.time1015am && <span className="opacity-60">/ {stop.time1015am}</span>}
                        </p>
                      </div>

                      {/* ETA */}
                      <div className="flex-shrink-0 pt-0.5 min-w-[48px] text-right">
                        {etaLabel(stop.id)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
