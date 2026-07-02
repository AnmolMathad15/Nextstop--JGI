---
name: Map stack — MapLibre GL not Leaflet
description: BusMap uses maplibregl directly (not react-leaflet). CartoDB Positron tile URLs and marker patterns.
---

# Map Stack

## Library
`maplibre-gl` is already installed. Do NOT switch to Leaflet/react-leaflet — they are NOT installed.
Import: `import maplibregl from 'maplibre-gl'` + `import 'maplibre-gl/dist/maplibre-gl.css'`

## CartoDB Positron tile URLs (3 subdomains)
```
https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png
https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png
https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png
```
Attribution required: `© OpenStreetMap contributors © CARTO`

## Custom marker pattern
Use `maplibregl.Marker({ element: domEl, anchor: "center" })` — no HTML divIcon (that's Leaflet).
CSS classes for markers are in `client/src/index.css` under "NextStop Custom Map Markers":
- `.nextstop-bus-wrapper` + `.nextstop-bus-pulse` — bus marker with CSS pulse animation
- `.nextstop-stop-main` — 18px teal-bordered circle
- `.nextstop-stop-sub` — 10px teal dot
- `.nextstop-stop-destination` — 22px gradient circle for last stop
- `.nextstop-college-marker` — 50px circle for JGI logo

## Polyline
Use GeoJSON source + line layer (NOT react-leaflet Polyline).
Use `as const` type assertions instead of `GeoJSON.Feature<GeoJSON.LineString>` type (avoids extra import).

## fitBounds
`map.fitBounds(bounds, { padding: { top, bottom, left, right }, maxZoom, duration })`
Bottom padding should be ≥230px to account for the bottom sheet.

## Bottom sheet
Pure CSS sliding panel: `position: absolute; bottom: 0; height: sheetOpen ? "55vh" : "200px"`.
CSS transition: `height 0.35s cubic-bezier(0.4,0,0.2,1)`.
Lives inside `BusMap` (not a separate component), uses `stopItemsRef` Map for scroll-into-view.

## onBusOffline callback signature
`(tripId: string, routeId: number) => void` — must match exactly.

**Why:** MapLibre GL was chosen because it's already installed and supports raster tiles out of the box.
Switching to Leaflet would require installing react-leaflet and leaflet npm packages.
