/**
 * mapMatching.ts — Mapbox Map Matching road-snapping
 *
 * Uses the Mapbox Map Matching API to snap raw GPS coordinates to the nearest
 * road geometry. Falls back to raw coordinates when the token is absent or the
 * API is unreachable.
 *
 * Set VITE_MAPBOX_TOKEN (or MAPBOX_TOKEN) in the environment to enable.
 * The Mapbox token is already required for the frontend map, so no extra
 * secrets are needed.
 *
 * API docs: https://docs.mapbox.com/api/navigation/map-matching/
 */

interface SnapResult {
  lat: number;
  lng: number;
  snapped: boolean;
}

// Per-trip GPS history buffer (Map Matching needs ≥2 points, max 100).
const stateMap = new Map<string, { lat: number; lng: number; ts: number }[]>();

const MAPBOX_TOKEN = process.env.VITE_MAPBOX_TOKEN ?? process.env.MAPBOX_TOKEN;
const MAX_HISTORY  = 10;   // keep last 10 points for matching
const MATCH_MIN    = 2;    // minimum points before we attempt matching
// Mapbox allows max 100 waypoints; we stay well under that.

export async function snapToRoad(
  tripId: string,
  lat: number,
  lng: number,
  timestamp?: number,
): Promise<SnapResult> {
  // Accumulate recent coordinates for this trip
  const history = stateMap.get(tripId) ?? [];
  history.push({ lat, lng, ts: timestamp ?? Date.now() });
  if (history.length > MAX_HISTORY) history.shift();
  stateMap.set(tripId, history);

  // Need token + at least 2 points to attempt matching
  if (!MAPBOX_TOKEN || history.length < MATCH_MIN) {
    return { lat, lng, snapped: false };
  }

  try {
    // Build coordinate string: "lng,lat;lng,lat;..."
    const coords = history.map(p => `${p.lng},${p.lat}`).join(";");

    // Mapbox Map Matching — driving profile, GeoJSON geometry, no steps
    const url =
      `https://api.mapbox.com/matching/v5/mapbox/driving/${encodeURIComponent(coords)}` +
      `?access_token=${MAPBOX_TOKEN}` +
      `&geometries=geojson` +
      `&radiuses=${history.map(() => 50).join(";")}` + // 50m snap radius per point
      `&steps=false` +
      `&tidy=true` +
      `&overview=full`;

    const res = await fetch(url, { signal: AbortSignal.timeout(3_000) });

    if (!res.ok) {
      console.warn(`[mapMatching] Mapbox API ${res.status}: ${await res.text().catch(() => "")}`);
      return { lat, lng, snapped: false };
    }

    const json = await res.json() as {
      code: string;
      matchings?: { geometry: { coordinates: [number, number][] }; confidence: number }[];
      message?: string;
    };

    if (json.code !== "Ok" || !json.matchings?.length) {
      // NoSegment / NoMatch / TooManyCoordinates — fall back silently
      return { lat, lng, snapped: false };
    }

    const matching = json.matchings[0];
    // Only trust matches with reasonable confidence
    if (matching.confidence < 0.2) {
      return { lat, lng, snapped: false };
    }

    const coordList = matching.geometry.coordinates;
    const last = coordList[coordList.length - 1];
    return { lat: last[1], lng: last[0], snapped: true };
  } catch {
    // API unreachable or timed out — silent fallback
    return { lat, lng, snapped: false };
  }
}

/** Clear buffered state when a trip ends or is paused. */
export function clearMapMatchState(tripId: string): void {
  stateMap.delete(tripId);
}
