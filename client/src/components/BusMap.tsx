import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useEffect, useRef, useState, useCallback } from "react";
import { Search, Navigation, MapPin, Clock, Wifi, WifiOff, Bus, ChevronUp, ChevronDown, Signal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { useWebSocket } from "@/hooks/useWebSocket";
import { HUBLI_CENTER, JCET_COLLEGE_COORDS } from "@/lib/constants";
import { ROUTE_GEOMETRY, ROUTE_GEOJSON_COLOR, ALL_ROUTES_GEOJSON } from "@/lib/routeGeometry";
import { BUS_STOPS_GEOJSON, parseStopName } from "@/lib/busStopsData";
import jgiLogo from "@/assets/jgi-logo.png";

// ── Mapbox token ───────────────────────────────────────────────────────────────
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string;
const CUSTOM_STYLE = import.meta.env.VITE_MAPBOX_STYLE as string;
const FALLBACK_STYLE = 'mapbox://styles/mapbox/streets-v12';

mapboxgl.accessToken = MAPBOX_TOKEN;

// ── Module-level map reference (for exported updateBusPosition) ────────────────
let _mapInstance: mapboxgl.Map | null = null;
let _lastUpdated = '';
let _simInterval: ReturnType<typeof setInterval> | null = null;

/** High-performance bus position update — mutates GeoJSON source, no DOM recreation. */
export function updateBusPosition(lng: number, lat: number, speed: number, busId: string) {
  if (!_mapInstance) return;
  const source = _mapInstance.getSource('live-bus-source') as mapboxgl.GeoJSONSource | undefined;
  if (!source) return;
  _lastUpdated = new Date().toLocaleTimeString();
  source.setData({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [lng, lat] },
    properties: { speed, busId, lastUpdated: _lastUpdated },
  });
  _mapInstance.panTo([lng, lat], { duration: 1000 });
}

/** Auto-simulated tracking — runs once on map load to verify render + animation. */
function startSimulatedTracking() {
  if (_simInterval) clearInterval(_simInterval);
  const path: [number, number][] = [
    [75.1240, 15.3647],
    [75.1260, 15.3660],
    [75.1280, 15.3675],
    [75.1300, 15.3690],
    [75.1320, 15.3710],
    [75.1300, 15.3690],
    [75.1280, 15.3675],
    [75.1260, 15.3660],
  ];
  let idx = 0;
  _simInterval = setInterval(() => {
    const [lng, lat] = path[idx % path.length];
    updateBusPosition(lng, lat, 30 + Math.round(Math.random() * 20), 'BUS-SIM-01');
    console.log('Simulating GPS Telemetry Update...', { lng, lat, idx });
    idx++;
  }, 3000);
}

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
  color?: string; // hex color for this route's polyline
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
  snappedLat?: number;
  snappedLng?: number;
  roadSnapped?: boolean;
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

// ── Component ─────────────────────────────────────────────────────────────────

export default function BusMap({
  routeId,
  selectedStop,
  showAllBuses = false,
  role = "student",
}: BusMapProps) {
  const containerRef   = useRef<HTMLDivElement>(null);
  const mapRef         = useRef<mapboxgl.Map | null>(null);
  const stopMarkersRef = useRef<mapboxgl.Marker[]>([]); // kept for cleanup safety
  const stopItemsRef   = useRef<Map<number, HTMLDivElement>>(new Map());
  const routeDataRef   = useRef<RouteWithStops | null>(null);

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

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: CUSTOM_STYLE || FALLBACK_STYLE,
      center: [HUBLI_CENTER.lng, HUBLI_CENTER.lat], // [75.1240, 15.3647]
      zoom: 13,
      pitch: 45,
      attributionControl: false,
    });

    map.on('load', () => {
      // MANDATORY: force canvas to recalculate dimensions after layout settles
      map.resize();
      console.log('Map loaded and canvas resized successfully!');

      map.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-right');
      map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'bottom-right');

      // ── JCET College pin ───────────────────────────────────────────────
      const colEl = document.createElement('div');
      colEl.className = 'nextstop-college-marker';
      const colImg = document.createElement('img');
      colImg.src = jgiLogo;
      colImg.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:50%;';
      colEl.appendChild(colImg);

      new mapboxgl.Marker({ element: colEl, anchor: 'center' })
        .setLngLat([JCET_COLLEGE_COORDS.lng, JCET_COLLEGE_COORDS.lat])
        .setPopup(
          new mapboxgl.Popup({ closeButton: false, offset: 28, className: 'nextstop-popup' })
            .setHTML(
              `<p style="font-weight:700;margin:0 0 3px">🏫 JCET College</p>
               <p style="font-size:11px;color:#6b7280;margin:0">Jain College of Engineering &amp; Technology</p>`
            )
        )
        .addTo(map);

      // ── All routes — dim background (all 6 routes always visible) ────
      map.addSource('all-routes', {
        type: 'geojson',
        data: ALL_ROUTES_GEOJSON,
      });
      map.addLayer({
        id: 'all-routes-line',
        type: 'line',
        source: 'all-routes',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': ['get', 'color'],
          'line-width': 2,
          'line-opacity': 0.22,
        },
      });

      // ── Active route line (updated when user selects a route) ─────────
      map.addSource('bus-route', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      map.addLayer({
        id: 'bus-route-shadow',
        type: 'line',
        source: 'bus-route',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#3b82f6', 'line-width': 14, 'line-opacity': 0.12, 'line-blur': 6 },
      });
      map.addLayer({
        id: 'bus-route-line',
        type: 'line',
        source: 'bus-route',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#3b82f6', 'line-width': 5, 'line-opacity': 0.95 },
      });
      map.addLayer({
        id: 'bus-route-dash',
        type: 'line',
        source: 'bus-route',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#ffffff', 'line-width': 1.5, 'line-opacity': 0.35, 'line-dasharray': [4, 8] },
      });

      // ── Bus stops from GeoJSON (circle + label layers) ─────────────────
      map.addSource('bus-stops', {
        type: 'geojson',
        data: BUS_STOPS_GEOJSON,
      });
      // Invisible until a route is selected (filter matches nothing initially)
      map.addLayer({
        id: 'bus-stops-circle',
        type: 'circle',
        source: 'bus-stops',
        filter: ['==', ['get', 'color'], '__none__'],
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 4, 15, 8],
          'circle-color': ['get', 'color'],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
          'circle-opacity': 0.95,
        },
      });
      map.addLayer({
        id: 'bus-stops-label',
        type: 'symbol',
        source: 'bus-stops',
        filter: ['==', ['get', 'color'], '__none__'],
        layout: {
          // Strip "BusstopJgi - " prefix (13 chars) for clean label
          'text-field': ['slice', ['get', 'label_text'], 13],
          'text-size': 11,
          'text-offset': [0, 1.3],
          'text-anchor': 'top',
          'text-optional': true,
          'text-max-width': 9,
          'text-allow-overlap': false,
        },
        paint: {
          'text-color': '#111827',
          'text-halo-color': '#ffffff',
          'text-halo-width': 1.5,
        },
      });

      // ── Stop click → open sheet and fly to stop ─────────────────────
      map.on('click', 'bus-stops-circle', (e) => {
        if (!e.features?.length) return;
        const props = e.features[0].properties as Record<string, string>;
        const stopName = parseStopName(props.label_text);
        const dbStop = routeDataRef.current?.stops.find(
          s => s.name.toLowerCase() === stopName.toLowerCase()
        );
        map.flyTo({ center: e.lngLat, zoom: 16, duration: 800 });
        if (dbStop) {
          setActiveStopId(dbStop.id);
          setSheetOpen(true);
          setTimeout(() => {
            stopItemsRef.current.get(dbStop.id)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, 300);
        }
        new mapboxgl.Popup({ closeButton: false, offset: 12, className: 'nextstop-popup' })
          .setLngLat(e.lngLat)
          .setHTML(
            `<p style="font-weight:600;margin:0 0 3px">${stopName}</p>
             <p style="font-size:11px;color:#6b7280;margin:0">📍 Bus Stop</p>`
          )
          .addTo(map);
      });
      map.on('mouseenter', 'bus-stops-circle', () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', 'bus-stops-circle', () => { map.getCanvas().style.cursor = ''; });

      // ── Live bus GeoJSON source + circle layer ─────────────────────────
      map.addSource('live-bus-source', {
        type: 'geojson',
        data: {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [HUBLI_CENTER.lng, HUBLI_CENTER.lat] },
          properties: { speed: 0, busId: '', lastUpdated: '' },
        },
      });
      // Outer pulse ring
      map.addLayer({
        id: 'live-bus-pulse',
        type: 'circle',
        source: 'live-bus-source',
        paint: {
          'circle-radius': 20,
          'circle-color': '#ef4444',
          'circle-opacity': 0.25,
          'circle-stroke-width': 0,
        },
      });
      // Main bus dot
      map.addLayer({
        id: 'live-bus-layer',
        type: 'circle',
        source: 'live-bus-source',
        paint: {
          'circle-radius': 10,
          'circle-color': '#ef4444',
          'circle-stroke-width': 3,
          'circle-stroke-color': '#ffffff',
        },
      });

      // ── Click popup on bus layer ───────────────────────────────────────
      map.on('click', 'live-bus-layer', (e) => {
        if (!e.features || e.features.length === 0) return;
        const props = e.features[0].properties as Record<string, string | number>;
        new mapboxgl.Popup({ className: 'nextstop-popup' })
          .setLngLat(e.lngLat)
          .setHTML(`
            <p style="font-weight:700;margin:0 0 6px">🚌 Live Bus</p>
            <p style="font-size:12px;margin:0 0 3px"><strong>Bus ID:</strong> ${props?.busId || 'N/A'}</p>
            <p style="font-size:12px;margin:0 0 3px"><strong>Speed:</strong> ${props?.speed ?? 0} km/h</p>
            <p style="font-size:12px;margin:0"><strong>Last Updated:</strong> ${props?.lastUpdated || '—'}</p>
          `)
          .addTo(map);
      });
      map.on('mouseenter', 'live-bus-layer', () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', 'live-bus-layer', () => { map.getCanvas().style.cursor = ''; });

      // ── Start simulated tracking to confirm render ─────────────────────
      startSimulatedTracking();

      setMapLoaded(true);
    });

    // Window resize → recalculate canvas
    const onResize = () => map.resize();
    window.addEventListener('resize', onResize);

    mapRef.current = map;
    _mapInstance = map;

    return () => {
      window.removeEventListener('resize', onResize);
      if (_simInterval) { clearInterval(_simInterval); _simInterval = null; }
      map.remove();
      mapRef.current = null;
      _mapInstance = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Keep routeDataRef in sync for use inside map event handlers ───────────
  useEffect(() => {
    routeDataRef.current = routeData ?? null;
  }, [routeData]);

  // ── Route rendering ────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded || !routeData) return;

    // Remove any legacy DOM markers
    stopMarkersRef.current.forEach(m => m.remove());
    stopMarkersRef.current = [];

    const stops = [...routeData.stops].sort((a, b) => a.sequence - b.sequence);

    // ── Update active-route polyline from GeoJSON coordinates ─────────
    const coords: [number, number][] =
      ROUTE_GEOMETRY[routeData.id] ?? stops.map(s => [s.lng, s.lat] as [number, number]);
    const src = map.getSource('bus-route') as mapboxgl.GeoJSONSource | undefined;
    if (src) {
      src.setData({
        type: 'FeatureCollection',
        features: [{
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: coords },
          properties: {},
        }],
      });
    }

    // ── Route colour from GeoJSON palette ─────────────────────────────
    const geojsonColor = ROUTE_GEOJSON_COLOR[routeData.id] ?? routeData.color ?? '#3b82f6';
    if (map.getLayer('bus-route-shadow')) map.setPaintProperty('bus-route-shadow', 'line-color', geojsonColor);
    if (map.getLayer('bus-route-line'))   map.setPaintProperty('bus-route-line',   'line-color', geojsonColor);

    // ── Show only this route's stops via Mapbox filter ────────────────
    const stopFilter: mapboxgl.FilterSpecification = ['==', ['get', 'color'], geojsonColor];
    if (map.getLayer('bus-stops-circle')) map.setFilter('bus-stops-circle', stopFilter);
    if (map.getLayer('bus-stops-label'))  map.setFilter('bus-stops-label',  stopFilter);

    // ── Fit viewport to route geometry ────────────────────────────────
    if (coords.length > 1) {
      const bounds = coords.reduce(
        (b, c) => b.extend(c as [number, number]),
        new mapboxgl.LngLatBounds(coords[0], coords[0])
      );
      map.fitBounds(bounds, {
        padding: { top: 80, bottom: 230, left: 60, right: 60 },
        maxZoom: 14,
        duration: 1200,
      });
    }
  }, [routeData, mapLoaded]);

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
    if (locations.length === 0) return;

    const loc = locations[0] as LiveLocation;
    setIsOffline(loc.driverOnline === false);
    setLiveSpeed(loc.speed ?? null);

    // Prefer road-snapped position from OSRM, fall back to raw GPS
    const dispLat = loc.snappedLat ?? loc.lat;
    const dispLng = loc.snappedLng ?? loc.lng;

    // Stop the simulation once real data arrives
    if (_simInterval) { clearInterval(_simInterval); _simInterval = null; }

    updateBusPosition(dispLng, dispLat, loc.speed ?? 0, loc.busId ?? 'BUS-01');

    if (routeData) updateStopETAs({ ...loc, lat: dispLat, lng: dispLng }, routeData.stops);

    if (role === 'student' && mapRef.current) {
      mapRef.current.easeTo({ center: [dispLng, dispLat], duration: 1500 });
    }
  }, [locations, routeData, updateStopETAs, role]);

  // ── Fly to stop ────────────────────────────────────────────────────────────
  const flyToStop = useCallback((stop: RouteStop) => {
    mapRef.current?.flyTo({ center: [stop.lng, stop.lat], zoom: 16, duration: 800 });
    setActiveStopId(stop.id);
    setSheetOpen(true);
    setTimeout(() => {
      stopItemsRef.current.get(stop.id)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
    <div
      className="relative overflow-hidden"
      data-testid="bus-map"
      style={{ display: 'flex', flex: 1, width: '100%', minHeight: '600px', height: '100vh', position: 'relative' }}
    >
      {/* Map canvas — fills parent absolutely */}
      <div
        ref={containerRef}
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
      />

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
            isConnected && !isOffline ? 'bg-green-500 text-white' : 'bg-gray-600/90 text-white'
          }`}
          data-testid="status-connection"
        >
          {isConnected && !isOffline
            ? <><Wifi className="h-3 w-3" /> Live</>
            : <><WifiOff className="h-3 w-3" /> Offline</>}
        </span>
      </div>

      {/* ── ETA chip ─────────────────────────────────────────────────────── */}
      {selectedStopData && eta !== null && (
        <div
          className="absolute left-3 right-3 z-40 bg-white/96 backdrop-blur rounded-xl px-4 py-3 shadow-lg flex items-center gap-3"
          style={{ top: isOffline && locations.length > 0 ? '72px' : '48px' }}
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
              {eta === -1 ? 'Passed' : eta === 0 ? '~Now' : `${eta} min`}
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
        style={{ bottom: sheetOpen ? 'calc(55vh + 10px)' : '214px' }}
      >
        <Button
          size="icon"
          className="h-10 w-10 rounded-full bg-white text-gray-700 shadow-md hover:bg-gray-50 border border-gray-200"
          onClick={() => {
            if (locations.length > 0) {
              const l = locations[0] as LiveLocation;
              mapRef.current?.flyTo({ center: [l.snappedLng ?? l.lng, l.snappedLat ?? l.lat], zoom: 15 });
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
            height: sheetOpen ? '55vh' : '200px',
            transition: 'height 0.35s cubic-bezier(0.4,0,0.2,1)',
          }}
          data-testid="stop-sheet"
        >
          {/* Header */}
          <div
            className="flex-shrink-0 cursor-pointer select-none"
            onClick={() => setSheetOpen(o => !o)}
          >
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-gray-200 rounded-full" />
            </div>

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
                        isActive ? 'bg-teal-50 ring-1 ring-inset ring-teal-200'
                        : isSel  ? 'bg-amber-50'
                        : 'hover:bg-gray-50 active:bg-gray-100'
                      }`}
                      data-testid={`stop-row-${stop.id}`}
                    >
                      {/* Vertical connector */}
                      <div className="flex flex-col items-center mt-1 flex-shrink-0" style={{ width: 18 }}>
                        <div className={`rounded-full flex-shrink-0 border-2 transition-all ${
                          isCurr    ? 'w-4 h-4 bg-green-500 border-green-400 shadow-[0_0_0_3px_rgba(34,197,94,0.2)]'
                          : isPassed ? 'w-2.5 h-2.5 bg-gray-200 border-gray-200'
                          : isSel    ? 'w-4 h-4 bg-amber-400 border-amber-300'
                          : isActive  ? 'w-4 h-4 bg-teal-500 border-teal-400'
                          : main      ? 'w-3.5 h-3.5 bg-white border-teal-400'
                          :             'w-2 h-2 bg-teal-300 border-transparent'
                        }`} />
                        {!isLast && (
                          <div className={`w-0.5 mt-1 ${isPassed ? 'bg-gray-100' : 'bg-teal-100'}`} style={{ height: 20 }} />
                        )}
                      </div>

                      {/* Name + time */}
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm leading-snug ${
                          isPassed   ? 'text-gray-300 line-through'
                          : isSel    ? 'font-bold text-amber-700'
                          : isActive ? 'font-semibold text-teal-700'
                          : main     ? 'font-medium text-gray-800'
                          :            'text-gray-600'
                        }`}>
                          {stop.name}
                          {isSel  && <span className="ml-1 text-xs">📍</span>}
                          {isCurr && <span className="ml-1 text-xs">🚌</span>}
                        </p>
                        <p className={`text-xs mt-0.5 flex items-center gap-1 ${isPassed ? 'text-gray-200' : 'text-gray-400'}`}>
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
