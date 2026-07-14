/**
 * LocationService — Modular Location Provider Architecture
 *
 * This is the central location processing engine. It is source-agnostic:
 * any provider (Driver Mobile GPS, Transight 4G, ESP32, Admin Manual) feeds
 * validated location updates through validateLocation(). Downstream consumers
 * (WebSocket broadcaster, analytics, geofencing) never know which provider
 * supplied the data.
 *
 * Current provider: Driver Mobile GPS (via WebSocket)
 * Future providers: Transight Discovery 4G GPS, ESP32 GPS, Admin Manual Update
 *
 * Validation thresholds (Step 7 spec):
 *   • Max speed: 120 km/h — above this the GPS fix is rejected
 *   • Jump limit: 250m in 2 seconds — physically impossible for a campus bus
 *   • Accuracy gate: 50m — poorer fixes are rejected
 *   • Heading change: >90° in <2s flagged as unreliable
 *
 * Geofence radii (Step 5 spec):
 *   • 1000m — Near Radius   → "Bus Approaching"
 *   •  500m — Arrival Alert → forces "2 Minutes Away" notification
 *   •  100m — Arrival Radius → "Bus Has Arrived"
 *   •  300m — Departure Radius → "Bus Departed" when exiting after entry
 */

import { storage } from "./storage";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RawLocationInput {
  tripId: string;
  routeId: number;
  busId: string;
  driverId: string;
  lat: number;
  lng: number;
  speed?: number;
  heading?: number;
  accuracy?: number;
  timestamp?: number;
  provider?: string;
}

export interface ValidatedLocation extends RawLocationInput {
  provider: string;
  timestamp: number;
  isValid: boolean;
  validationError?: string;
}

export interface ProcessedLocation {
  tripId: string;
  routeId: number;
  busId: string;
  driverId: string;
  lat: number;
  lng: number;
  speed: number;
  heading?: number;
  accuracy?: number;
  timestamp: number;
  provider: string;
  isUnreliable?: boolean; // true when GPS is suspicious but we continue with predicted position
}

export type AlertType =
  | "OUT_OF_AREA"
  | "RASH_DRIVING"
  | "OVERSPEED"
  | "GPS_OFFLINE"
  | "DRIVER_OFFLINE"
  | "STOP_REACHED";

export type AlertSeverity = "low" | "medium" | "high";

export interface LocationAlert {
  alertType: AlertType;
  severity: AlertSeverity;
  tripId?: string;
  busId?: string;
  driverId?: string;
  lat?: number;
  lng?: number;
  details: Record<string, unknown>;
}

// ── Geofence radius constants (km) ───────────────────────────────────────────

export const GEOFENCE_NEAR_KM       = 1.0;  // 1000m — bus approaching
export const GEOFENCE_ARRIVAL_KM    = 0.5;  // 500m  — force 2-min notification
export const GEOFENCE_STOP_KM       = 0.1;  // 100m  — bus arrived
export const GEOFENCE_DEPARTURE_KM  = 0.3;  // 300m  — bus departed after entry

// ── Hubli–Dharwad Operational Polygon ────────────────────────────────────────
const OPERATIONAL_POLYGON: [number, number][] = [
  [74.88, 15.28],
  [75.30, 15.28],
  [75.30, 15.53],
  [74.88, 15.53],
  [74.88, 15.28],
];

/** Ray-casting point-in-polygon test */
export function isInsideOperationalArea(lat: number, lng: number): boolean {
  const x = lng, y = lat;
  let inside = false;
  const poly = OPERATIONAL_POLYGON;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1];
    const xj = poly[j][0], yj = poly[j][1];
    const intersect = ((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

// ── Haversine distance (km) ───────────────────────────────────────────────────
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Rolling speed buffer (Step 6 spec: last 30 GPS points) ───────────────────

interface SpeedBufferEntry {
  speed: number;
  lat: number;
  lng: number;
  timestamp: number;
  heading?: number;
}

/** tripId → ring buffer of last 30 validated GPS points */
const speedBuffers = new Map<string, SpeedBufferEntry[]>();
const SPEED_BUFFER_MAX = 30;

export function recordGPSPoint(tripId: string, entry: SpeedBufferEntry): void {
  const buf = speedBuffers.get(tripId) ?? [];
  buf.push(entry);
  if (buf.length > SPEED_BUFFER_MAX) buf.shift();
  speedBuffers.set(tripId, buf);
}

/**
 * Return the moving-average speed from the last N GPS points.
 * Filters out stopped (<2 km/h) and unrealistic (>100 km/h) readings.
 */
export function getSmoothedSpeed(tripId: string): number {
  const buf = speedBuffers.get(tripId) ?? [];
  const valid = buf.map(e => e.speed).filter(s => s >= 2 && s <= 100);
  if (valid.length === 0) return 0;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

export function clearSpeedBuffer(tripId: string): void {
  speedBuffers.delete(tripId);
}

// ── Validation thresholds ─────────────────────────────────────────────────────
const MAX_ACCURACY_METERS    = 50;    // spec: reject if accuracy > 50m
const MAX_SPEED_KMH          = 120;   // spec: reject if speed > 120 km/h
const JUMP_DISTANCE_KM       = 0.25;  // spec: 250m jump
const JUMP_TIME_SEC          = 2;     // spec: in 2 seconds
const MAX_HEADING_CHANGE_DEG = 90;    // spec: unrealistic heading change
const HEADING_CHANGE_MS      = 2000;  // within 2 seconds

export function validateLocation(
  input: RawLocationInput,
  prevLocation?: ProcessedLocation,
): ValidatedLocation {
  const result: ValidatedLocation = {
    ...input,
    provider: input.provider || "mobile_gps",
    timestamp: input.timestamp || Date.now(),
    isValid: true,
  };

  // 1. Coordinate sanity
  if (Math.abs(input.lat) > 90 || Math.abs(input.lng) > 180 || input.lat === 0 || input.lng === 0) {
    return { ...result, isValid: false, validationError: "Invalid coordinates" };
  }

  // 2. Accuracy gate (mobile GPS only)
  if (
    input.provider === "mobile_gps" &&
    input.accuracy !== undefined &&
    input.accuracy > MAX_ACCURACY_METERS
  ) {
    return { ...result, isValid: false, validationError: `Accuracy too low: ${input.accuracy.toFixed(0)}m (max ${MAX_ACCURACY_METERS}m)` };
  }

  // 3. Speed gate — reject if reported speed exceeds maximum
  if (input.speed !== undefined && input.speed > MAX_SPEED_KMH) {
    return { ...result, isValid: false, validationError: `Speed too high: ${input.speed.toFixed(0)} km/h (max ${MAX_SPEED_KMH})` };
  }

  if (prevLocation) {
    const dist        = haversineKm(prevLocation.lat, prevLocation.lng, input.lat, input.lng);
    const timeDeltaSec = (result.timestamp - prevLocation.timestamp) / 1000;
    const timeDeltaHr  = timeDeltaSec / 3600;

    // 4. Impossible jump: >250m in <2 seconds
    if (dist > JUMP_DISTANCE_KM && timeDeltaSec <= JUMP_TIME_SEC) {
      return { ...result, isValid: false, validationError: `GPS jump: ${(dist * 1000).toFixed(0)}m in ${timeDeltaSec.toFixed(1)}s` };
    }

    // 5. Implied speed via haversine
    const impliedSpeedKmh = timeDeltaHr > 0 ? dist / timeDeltaHr : 0;
    if (impliedSpeedKmh > MAX_SPEED_KMH) {
      return { ...result, isValid: false, validationError: `Implied speed too high: ${impliedSpeedKmh.toFixed(0)} km/h` };
    }

    // 6. Heading sanity: >90° change in <2s (skip if we don't have both headings)
    if (
      input.heading !== undefined &&
      prevLocation.heading !== undefined &&
      timeDeltaSec <= HEADING_CHANGE_MS / 1000
    ) {
      let headingDelta = Math.abs(input.heading - prevLocation.heading);
      if (headingDelta > 180) headingDelta = 360 - headingDelta;
      if (headingDelta > MAX_HEADING_CHANGE_DEG) {
        return { ...result, isValid: false, validationError: `Unrealistic heading change: ${headingDelta.toFixed(0)}°` };
      }
    }

    // 7. Minimum movement gate: ignore micro-jitter (<10m AND <3s elapsed)
    const timeDeltaMs = result.timestamp - prevLocation.timestamp;
    if (dist < 0.01 && timeDeltaMs < 3000) {
      return { ...result, isValid: false, validationError: "Duplicate — no significant movement" };
    }
  }

  return result;
}

// ── In-memory geofence state ──────────────────────────────────────────────────

/** Tracks when the bus ENTERED a stop's inner geofence (100m) */
const stopDwellTimers = new Map<string, number>(); // `${tripId}-${stopId}` → enterTime

/** Tracks whether a stop was "inside" the 300m departure fence last update */
const stopInsideDepFence = new Map<string, boolean>(); // `${tripId}-${stopId}` → wasInside

/** Rash driving: overspeed streak per driver */
export const driverOverspeedStreak = new Map<string, number>();

/** Out-of-area pending confirmation */
const outOfAreaCounters = new Map<string, { count: number; since: number }>();
const OUT_OF_AREA_CONFIRM_FIXES = 3;
const OUT_OF_AREA_CONFIRM_MS   = 30_000;
const DWELL_REQUIRED_MS        = 5_000;

// ── Geofence event type for multi-radius system ───────────────────────────────

export type GeofenceEvent =
  | "NEAR"       // entered 1000m radius
  | "APPROACHING" // entered 500m radius
  | "ARRIVED"    // entered 100m radius (dwelled 5s)
  | "DEPARTED";  // exited 300m radius after having been inside

export interface GeofenceResult {
  stopId: number;
  stopName: string;
  event: GeofenceEvent;
  distanceKm: number;
}

// ── Multi-radius geofence check ───────────────────────────────────────────────

/**
 * Checks all stops on the route against the current bus position using the
 * four-radius system. Returns fired geofence events for this update cycle.
 */
export async function checkGeofences(
  loc: ProcessedLocation,
  route: { speedLimit?: number | null },
): Promise<{ alerts: LocationAlert[]; geofenceEvents: GeofenceResult[] }> {
  const alerts: LocationAlert[] = [];
  const geofenceEvents: GeofenceResult[] = [];
  const stops = await storage.getRouteStops(loc.routeId);
  const speedLimit = route.speedLimit ?? 40;

  for (const stop of stops) {
    const dist    = haversineKm(loc.lat, loc.lng, stop.lat, stop.lng);
    const arrKey  = `${loc.tripId}-${stop.id}`;
    const depKey  = `dep-${loc.tripId}-${stop.id}`;

    // ── 100m inner zone — "Bus Arrived" (with 5s dwell requirement) ──────────
    if (dist <= GEOFENCE_STOP_KM) {
      const lastEvent     = await storage.getLatestGeoEvent(loc.tripId, stop.id);
      const alreadyArrived = lastEvent?.type === "REACHED";

      if (!alreadyArrived) {
        const enterTime = stopDwellTimers.get(arrKey);
        if (!enterTime) {
          stopDwellTimers.set(arrKey, Date.now());
        } else if (Date.now() - enterTime >= DWELL_REQUIRED_MS && (!loc.speed || loc.speed <= 8)) {
          // Confirmed arrival — speed gate (≤8 km/h) prevents drive-by false triggers
          await storage.logGeoEvent({ tripId: loc.tripId, stopId: stop.id, type: "REACHED" });
          stopDwellTimers.delete(arrKey);

          geofenceEvents.push({ stopId: stop.id, stopName: stop.name, event: "ARRIVED", distanceKm: dist });

          // Rash-driving check
          if (loc.speed > speedLimit) {
            const streak = (driverOverspeedStreak.get(loc.driverId) ?? 0) + 1;
            driverOverspeedStreak.set(loc.driverId, streak);
            if (streak >= 3) {
              alerts.push({
                alertType: "RASH_DRIVING",
                severity: "high",
                tripId: loc.tripId,
                busId: loc.busId,
                driverId: loc.driverId,
                lat: loc.lat,
                lng: loc.lng,
                details: { currentSpeed: loc.speed, speedLimit, stopsOverspeeding: streak, stopName: stop.name },
              });
              driverOverspeedStreak.set(loc.driverId, 0);
            }
          } else {
            driverOverspeedStreak.set(loc.driverId, 0);
          }
        }
      }

      // Mark as inside departure fence
      stopInsideDepFence.set(depKey, true);
    } else {
      // Outside 100m → clear dwell timer
      stopDwellTimers.delete(arrKey);

      // ── 300m departure zone — "Bus Departed" ───────────────────────────────
      const wasInsideDep = stopInsideDepFence.get(depKey) ?? false;
      if (wasInsideDep && dist > GEOFENCE_DEPARTURE_KM) {
        stopInsideDepFence.set(depKey, false);
        geofenceEvents.push({ stopId: stop.id, stopName: stop.name, event: "DEPARTED", distanceKm: dist });
      }

      // ── 500m approaching zone ─────────────────────────────────────────────
      if (dist <= GEOFENCE_ARRIVAL_KM) {
        geofenceEvents.push({ stopId: stop.id, stopName: stop.name, event: "APPROACHING", distanceKm: dist });
      }
      // ── 1000m near zone ───────────────────────────────────────────────────
      else if (dist <= GEOFENCE_NEAR_KM) {
        geofenceEvents.push({ stopId: stop.id, stopName: stop.name, event: "NEAR", distanceKm: dist });
      }
    }
  }

  return { alerts, geofenceEvents };
}

// ── Operational geofence ──────────────────────────────────────────────────────

export function checkOperationalGeofence(loc: ProcessedLocation): LocationAlert | null {
  const inside = isInsideOperationalArea(loc.lat, loc.lng);
  const key    = loc.tripId;

  if (!inside) {
    const existing = outOfAreaCounters.get(key) ?? { count: 0, since: Date.now() };
    existing.count += 1;
    outOfAreaCounters.set(key, existing);

    const elapsedMs = Date.now() - existing.since;
    if (existing.count >= OUT_OF_AREA_CONFIRM_FIXES && elapsedMs >= OUT_OF_AREA_CONFIRM_MS) {
      outOfAreaCounters.delete(key);
      return {
        alertType: "OUT_OF_AREA",
        severity: "high",
        tripId: loc.tripId,
        busId: loc.busId,
        driverId: loc.driverId,
        lat: loc.lat,
        lng: loc.lng,
        details: { confirmedFixes: existing.count, elapsedSeconds: Math.round(elapsedMs / 1000) },
      };
    }
  } else {
    outOfAreaCounters.delete(key);
  }

  return null;
}

// ── Speed calculation helper ──────────────────────────────────────────────────

export function calculateSpeed(
  prev: ProcessedLocation | undefined,
  cur: { lat: number; lng: number; timestamp: number; speed?: number },
): number {
  if (cur.speed !== undefined && cur.speed !== null && cur.speed >= 0) return cur.speed;
  if (!prev) return 0;
  const dist       = haversineKm(prev.lat, prev.lng, cur.lat, cur.lng);
  const timeDeltaHr = (cur.timestamp - prev.timestamp) / 3_600_000;
  return timeDeltaHr > 0 ? dist / timeDeltaHr : 0;
}
