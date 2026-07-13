/**
 * mapMatching.ts — OSRM-based road snapping
 *
 * Attempts to snap raw GPS coordinates to the nearest road using an OSRM
 * map-matching endpoint. Falls back to the raw coordinates silently when
 * OSRM is unreachable (e.g. not configured or offline on Replit).
 *
 * Configure OSRM_BASE_URL in the environment to enable road snapping.
 * Without it, snapped === false and the raw lat/lng are returned as-is.
 */

interface SnapResult {
  lat: number;
  lng: number;
  snapped: boolean;
}

// Per-trip GPS history buffer used for map-matching (requires ≥2 points).
const stateMap = new Map<string, { lat: number; lng: number; ts: number }[]>();

const OSRM_BASE = process.env.OSRM_BASE_URL;
const MAX_HISTORY = 10;

export async function snapToRoad(
  tripId: string,
  lat: number,
  lng: number,
  timestamp?: number
): Promise<SnapResult> {
  // Accumulate recent coordinates for this trip
  const history = stateMap.get(tripId) ?? [];
  history.push({ lat, lng, ts: timestamp ?? Date.now() });
  if (history.length > MAX_HISTORY) history.shift();
  stateMap.set(tripId, history);

  // Need at least 2 points and a valid OSRM endpoint to attempt matching
  if (!OSRM_BASE || history.length < 2) {
    return { lat, lng, snapped: false };
  }

  try {
    const coords = history.map(p => `${p.lng},${p.lat}`).join(";");
    const timestamps = history.map(p => Math.floor(p.ts / 1000)).join(";");
    const url = `${OSRM_BASE}/match/v1/driving/${coords}?timestamps=${timestamps}&geometries=geojson&annotations=false&overview=full`;

    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return { lat, lng, snapped: false };

    const json = await res.json() as {
      code: string;
      matchings?: { geometry: { coordinates: [number, number][] } }[];
    };

    if (json.code !== "Ok" || !json.matchings?.length) {
      return { lat, lng, snapped: false };
    }

    const coords2d = json.matchings[0].geometry.coordinates;
    const last = coords2d[coords2d.length - 1];
    return { lat: last[1], lng: last[0], snapped: true };
  } catch {
    // OSRM unreachable or timed out — silently fall back
    return { lat, lng, snapped: false };
  }
}

/** Clear buffered state when a trip ends or is paused. */
export function clearMapMatchState(tripId: string): void {
  stateMap.delete(tripId);
}
