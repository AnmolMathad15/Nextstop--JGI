---
name: Map stack
description: Which map library is used and how BusMap is wired up
---

# Map Stack: Mapbox GL JS

`BusMap.tsx` uses **mapbox-gl** (NOT react-leaflet or maplibre-gl — those are removed).

**Why:** Migrated from MapLibre GL JS to Mapbox GL JS per user spec to fix canvas sizing bug and add real-time tracking layer architecture.

**Token/style:** stored as `VITE_MAPBOX_TOKEN` and `VITE_MAPBOX_STYLE` env vars (shared environment). Falls back to `mapbox://styles/mapbox/streets-v12`.

**How to apply:**
- All map code in `client/src/components/BusMap.tsx`
- CSS class selectors are `.mapboxgl-*` (not maplibregl)
- Live bus position uses a GeoJSON source (`live-bus-source`) + circle layer (`live-bus-layer`), updated via `source.setData()` — no DOM marker recreation on GPS updates
- `updateBusPosition(lng, lat, speed, busId)` is a module-level exported function that updates the GeoJSON source; wires into useWebSocket locations array
- `startSimulatedTracking()` auto-runs on map load; stops when real WebSocket data arrives
- Canvas sizing fix: outer div uses inline `style={{ display:'flex', flex:1, width:'100%', minHeight:'600px', height:'100vh', position:'relative' }}`; inner canvas div uses `position:absolute, top:0, left:0, width:100%, height:100%`
- `map.resize()` called inside `map.on('load')` + `window.addEventListener('resize', ...)` (cleaned up on unmount)
- Stop markers and college pin still use `mapboxgl.Marker` with custom DOM elements
- Route polyline uses source `bus-route` + layers `bus-route-line`, `bus-route-shadow`, `bus-route-dash` (#3b82f6 blue)

**Missing module fixed:** `server/mapMatching.ts` was missing from the repo. Created a stub that uses OSRM (`OSRM_BASE_URL` env var) for road-snapping and falls back gracefully when OSRM is unreachable.
