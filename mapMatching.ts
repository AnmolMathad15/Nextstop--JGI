/**
 * Road-Snapping via OSRM Map Matching
 *
 * Raw phone GPS drifts a few meters off the actual road (into buildings,
 * medians, parallel lanes). This module snaps each new fix onto the real
 * road network using OSRM's public Map Matching API, the same category of
 * service Uber/Zepto use internally (their own map-matching engines) to make
 * the bus icon glide along roads instead of floating over rooftops.
 *
 * Strategy:
 *  - Keep a short rolling trace (last few fixes) per trip — OSRM matches
 *    a *trace*, not a single point, so it can use direction of travel.
 *  - Only call OSRM every MIN_MATCH_INTERVAL_MS (rate-limit friendly,
 *    the public demo server throttles aggressively otherwise).
 *  - Between real OSRM calls, re-apply the last computed snap offset to
 *    the new raw fix, so the bus doesn't "unsnap" every other tick.
 *  - Any failure (timeout, no match, bad match) falls back to raw GPS —
 *    tracking never breaks because the map-matching call failed.
 *
 * NOTE: router.project-osrm.org is OSRM's public demo server — free, no
 * API key, but rate-limited and not meant for heavy production traffic.
 * Fine for a college project; if this ever needs to scale, self-host OSRM
 * (docker) or swap OSRM_MATCH_URL for a paid map-matching provider — the
 * rest of this module doesn't change.
 */

interface TracePoint {
  lat: number;
  lng: number;
  timestamp: number;
}

interface SnapOffset {
  dLat: number;
  dLng: number;
}

export interface SnapResult {
  lat: number;
  lng: number;
  snapped: boolean; // true if this fix is on/near a real road match
}

const MAX_TRACE_POINTS = 6;
const MIN_MATCH_INTERVAL_MS = 3_000; // don't hammer OSRM more than ~once per 3s per trip
const MAX_ACCEPTABLE_SNAP_KM = 0.15; // if OSRM's answer is >150m from raw fix, distrust it
const OSRM_TIMEOUT_MS = 2_500;
const OSRM_MATCH_URL = "https://router.project-osrm.org/match/v1/driving";

const traceBuffers   = new Map<string, TracePoint[]>();
const lastMatchTime  = new Map<string, number>();
const lastSnapOffset = new Map<string, SnapOffset>();

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Snap a new raw GPS fix onto the road network for a given trip.
 * Always resolves — never throws — so a bad/slow OSRM call never blocks
 * the location pipeline.
 */
export async function snapToRoad(
  tripId: string,
  lat: number,
  lng: number,
  timestamp: number
): Promise<SnapResult> {
  const buf = traceBuffers.get(tripId) ?? [];
  buf.push({ lat, lng, timestamp });
  if (buf.length > MAX_TRACE_POINTS) buf.shift();
  traceBuffers.set(tripId, buf);

  const last = lastMatchTime.get(tripId) ?? 0;
  const now = Date.now();

  // Throttled: reuse the last known offset for continuity between real calls
  if (buf.length < 2 || now - last < MIN_MATCH_INTERVAL_MS) {
    const offset = lastSnapOffset.get(tripId);
    if (offset) {
      return { lat: lat + offset.dLat, lng: lng + offset.dLng, snapped: true };
    }
    return { lat, lng, snapped: false };
  }

  lastMatchTime.set(tripId, now);

  try {
    const coordsStr = buf.map(p => `${p.lng},${p.lat}`).join(";");
    const timestamps = buf.map(p => Math.round(p.timestamp / 1000)).join(";");
    const radiuses = buf.map(() => "25").join(";"); // ~25m GPS uncertainty per point

    const url = `${OSRM_MATCH_URL}/${coordsStr}?timestamps=${timestamps}&radiuses=${radiuses}&geometries=geojson&overview=false`;

    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), OSRM_TIMEOUT_MS);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutHandle);

    if (!res.ok) throw new Error(`OSRM responded ${res.status}`);
    const data = await res.json();

    if (data.code !== "Ok" || !Array.isArray(data.tracepoints) || data.tracepoints.length === 0) {
      throw new Error("No match returned");
    }

    // The last tracepoint corresponds to the latest raw fix we sent
    const lastTracepoint = data.tracepoints[data.tracepoints.length - 1];
    if (!lastTracepoint?.location) throw new Error("No tracepoint for latest fix");

    const [snappedLng, snappedLat] = lastTracepoint.location;

    // Sanity check — reject wild matches (bad match on sparse/unmapped roads)
    const snapDistKm = haversineKm(lat, lng, snappedLat, snappedLng);
    if (snapDistKm > MAX_ACCEPTABLE_SNAP_KM) throw new Error("Snap too far from raw fix");

    lastSnapOffset.set(tripId, { dLat: snappedLat - lat, dLng: snappedLng - lng });
    return { lat: snappedLat, lng: snappedLng, snapped: true };
  } catch {
    // OSRM unreachable, timed out, or gave a bad match — fall back to raw GPS.
    // Keep the previous offset around so the next throttled tick can still use it.
    return { lat, lng, snapped: false };
  }
}

/** Call when a trip ends/pauses so stale trace data doesn't leak between trips */
export function clearMapMatchState(tripId: string) {
  traceBuffers.delete(tripId);
  lastMatchTime.delete(tripId);
  lastSnapOffset.delete(tripId);
}
