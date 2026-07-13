/**
 * routeProgressService.ts — Road-segment route progress engine
 *
 * Instead of straight-line distance to a stop, this module:
 * 1. Projects the bus GPS position onto the nearest route segment.
 * 2. Computes distanceAlongRoute (total km traveled so far).
 * 3. Computes remainingDistanceToNextStop (along the route polyline).
 *
 * This feeds the ETA engine with realistic distances, matching Uber/Google Maps
 * behavior instead of naïve haversine-to-stop calculations.
 */

import { haversineKm } from "./locationService";
import { storage } from "./storage";
import type { RouteStop } from "@shared/schema";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RouteProgress {
  /** 0-based index of the route segment the bus is currently on */
  currentSegmentIndex: number;
  /** Total km the bus has traveled along the route polyline */
  distanceAlongRouteKm: number;
  /** The next upcoming stop (null if at/past the last stop) */
  nextStop: RouteStop | null;
  /** Remaining distance along the route polyline to nextStop */
  remainingDistanceToNextStopKm: number;
  /** IDs of stops the bus has already passed */
  completedStopIds: number[];
}

// ── Per-trip cache ────────────────────────────────────────────────────────────

const progressCache = new Map<string, RouteProgress>();

export function getCachedProgress(tripId: string): RouteProgress | undefined {
  return progressCache.get(tripId);
}

export function clearRouteProgress(tripId: string): void {
  progressCache.delete(tripId);
}

// ── Geometry helpers ──────────────────────────────────────────────────────────

/**
 * Project point P onto segment A→B.
 * Returns: fraction along segment [0,1] and perpendicular distance in degrees.
 */
function projectPointOnSegment(
  px: number, py: number,
  ax: number, ay: number,
  bx: number, by: number,
): { fraction: number; perpDistDeg: number } {
  const dx = bx - ax, dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) {
    return { fraction: 0, perpDistDeg: Math.hypot(px - ax, py - ay) };
  }
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  const cx = ax + t * dx, cy = ay + t * dy;
  return { fraction: t, perpDistDeg: Math.hypot(px - cx, py - cy) };
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Compute the bus's current progress along a route.
 *
 * @param tripId   - used for caching
 * @param busLat   - raw (or road-snapped) bus latitude
 * @param busLng   - raw (or road-snapped) bus longitude
 * @param routeId  - route to project onto
 */
export async function computeRouteProgress(
  tripId: string,
  busLat: number,
  busLng: number,
  routeId: number,
): Promise<RouteProgress> {
  const stops = await storage.getRouteStops(routeId);

  if (stops.length < 2) {
    const fallback: RouteProgress = {
      currentSegmentIndex: 0,
      distanceAlongRouteKm: 0,
      nextStop: stops[0] ?? null,
      remainingDistanceToNextStopKm: stops[0]
        ? haversineKm(busLat, busLng, stops[0].lat, stops[0].lng)
        : 0,
      completedStopIds: [],
    };
    progressCache.set(tripId, fallback);
    return fallback;
  }

  // ── Find the closest segment ──────────────────────────────────────────────

  let bestSegIdx  = 0;
  let bestFrac    = 0;
  let bestDistDeg = Infinity;

  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i];
    const b = stops[i + 1];
    const { fraction, perpDistDeg } = projectPointOnSegment(
      busLng, busLat,
      a.lng, a.lat,
      b.lng, b.lat,
    );
    if (perpDistDeg < bestDistDeg) {
      bestDistDeg  = perpDistDeg;
      bestSegIdx   = i;
      bestFrac     = fraction;
    }
  }

  // ── Distance along route to current position ──────────────────────────────

  let distAlongRoute = 0;
  for (let i = 0; i < bestSegIdx; i++) {
    distAlongRoute += haversineKm(stops[i].lat, stops[i].lng, stops[i + 1].lat, stops[i + 1].lng);
  }
  const segLen = haversineKm(
    stops[bestSegIdx].lat, stops[bestSegIdx].lng,
    stops[bestSegIdx + 1].lat, stops[bestSegIdx + 1].lng,
  );
  distAlongRoute += bestFrac * segLen;

  // ── Remaining distance to the NEXT stop ──────────────────────────────────

  const nextStopIdx = bestSegIdx + 1;
  const nextStop    = nextStopIdx < stops.length ? stops[nextStopIdx] : null;

  // Remaining = partial segment + full segments up to nextStop
  const remainingDistanceToNextStopKm = nextStop
    ? (1 - bestFrac) * segLen
    : 0;

  // ── Completed stops ───────────────────────────────────────────────────────

  const completedStopIds = stops.slice(0, bestSegIdx).map(s => s.id);

  const progress: RouteProgress = {
    currentSegmentIndex: bestSegIdx,
    distanceAlongRouteKm: distAlongRoute,
    nextStop,
    remainingDistanceToNextStopKm,
    completedStopIds,
  };

  progressCache.set(tripId, progress);
  return progress;
}
