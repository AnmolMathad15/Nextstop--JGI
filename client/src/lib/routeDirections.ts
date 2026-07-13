/**
 * Fetches road-snapped route geometries from the Mapbox Directions API.
 * Results are cached in memory so each route is only fetched once per session.
 */

import { ROUTE_GEOMETRY } from './routeGeometry';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string;

// Module-level cache: routeId → GeoJSON coordinates
const routeGeometryCache = new Map<number, [number, number][]>();

/**
 * Fetch road-following coordinates for a route via the Mapbox Directions API.
 * Falls back to raw waypoints if the API call fails.
 */
export async function fetchRoadSnappedRoute(routeId: number): Promise<[number, number][]> {
  // Return cached result if available
  if (routeGeometryCache.has(routeId)) {
    return routeGeometryCache.get(routeId)!;
  }

  const waypoints = ROUTE_GEOMETRY[routeId];
  if (!waypoints || waypoints.length < 2) {
    return waypoints ?? [];
  }

  try {
    // Mapbox Directions API supports up to 25 waypoints.
    // Our routes have ≤18 waypoints so all fit in one request.
    const coordString = waypoints.map(([lng, lat]) => `${lng},${lat}`).join(';');
    const url =
      `https://api.mapbox.com/directions/v5/mapbox/driving/${coordString}` +
      `?access_token=${MAPBOX_TOKEN}` +
      `&geometries=geojson` +
      `&overview=full` +
      `&steps=false`;

    const res = await fetch(url);
    if (!res.ok) throw new Error(`Directions API error: ${res.status}`);

    const data = await res.json();
    const route = data?.routes?.[0];
    if (!route?.geometry?.coordinates?.length) {
      throw new Error('No route geometry returned');
    }

    const coords: [number, number][] = route.geometry.coordinates;
    routeGeometryCache.set(routeId, coords);
    return coords;
  } catch (err) {
    console.warn(`[routeDirections] Falling back to raw waypoints for route ${routeId}:`, err);
    // Cache the fallback too so we don't hammer the API on retries
    routeGeometryCache.set(routeId, waypoints);
    return waypoints;
  }
}

/** Pre-warm the cache for all 6 routes in the background. */
export function prefetchAllRoutes(): void {
  const routeIds = Object.keys(ROUTE_GEOMETRY).map(Number);
  routeIds.forEach(id => {
    fetchRoadSnappedRoute(id).catch(() => {/* silent */});
  });
}
