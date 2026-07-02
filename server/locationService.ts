/**
 * LocationService — Modular Location Provider Architecture
 *
 * This is the central location processing engine. It is source-agnostic:
 * any provider (Driver Mobile GPS, Transight 4G, ESP32, Admin Manual) feeds
 * validated location updates through processUpdate(). Downstream consumers
 * (WebSocket broadcaster, analytics, geofencing) never know which provider
 * supplied the data.
 *
 * Current provider: Driver Mobile GPS (via WebSocket)
 * Future providers: Transight Discovery 4G GPS, ESP32 GPS, Admin Manual Update
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
  provider?: string; // "mobile_gps" | "transight_4g" | "esp32" | "manual"
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

// ── Hubli–Dharwad Operational Polygon ────────────────────────────────────────
// Covers all 6 routes: Keshwapur, PG, Siddaroodh Math, Gadag/BVB, Dharwad, Navangar
// Coordinates: [lng, lat] (GeoJSON order)
const OPERATIONAL_POLYGON: [number, number][] = [
  [74.88, 15.28], // SW — below Hubli
  [75.30, 15.28], // SE — east of Hubli
  [75.30, 15.53], // NE — north of Dharwad
  [74.88, 15.53], // NW — west of Dharwad
  [74.88, 15.28], // close polygon
];

/** Ray-casting point-in-polygon test */
export function isInsideOperationalArea(lat: number, lng: number): boolean {
  const x = lng;
  const y = lat;
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

// ── Validation ────────────────────────────────────────────────────────────────
const MAX_ACCURACY_METERS = 20; // reject GPS points less accurate than this

export function validateLocation(
  input: RawLocationInput,
  prevLocation?: ProcessedLocation
): ValidatedLocation {
  const result: ValidatedLocation = { ...input, provider: input.provider || "mobile_gps", timestamp: input.timestamp || Date.now(), isValid: true };

  // 1. Coordinate sanity
  if (Math.abs(input.lat) > 90 || Math.abs(input.lng) > 180 || input.lat === 0 || input.lng === 0) {
    return { ...result, isValid: false, validationError: "Invalid coordinates" };
  }

  // 2. Accuracy gate (mobile GPS only — hardware GPS may not report accuracy)
  if (input.provider === "mobile_gps" && input.accuracy !== undefined && input.accuracy > MAX_ACCURACY_METERS) {
    return { ...result, isValid: false, validationError: `Accuracy too low: ${input.accuracy.toFixed(0)}m` };
  }

  // 3. Impossible jump detection
  if (prevLocation) {
    const dist = haversineKm(prevLocation.lat, prevLocation.lng, input.lat, input.lng);
    const timeDeltaHr = (result.timestamp - prevLocation.timestamp) / 3_600_000;
    const impliedSpeed = timeDeltaHr > 0 ? dist / timeDeltaHr : 0;
    if (impliedSpeed > 200) {
      // > 200 km/h implied → GPS jump
      return { ...result, isValid: false, validationError: `Impossible GPS jump: ${impliedSpeed.toFixed(0)} km/h implied` };
    }
    // Minimum movement gate: skip if < 10m moved AND < 3s elapsed
    const timeDeltaMs = result.timestamp - prevLocation.timestamp;
    if (dist < 0.01 && timeDeltaMs < 3000) {
      return { ...result, isValid: false, validationError: "Duplicate — no significant movement" };
    }
  }

  return result;
}

// ── In-memory state for geofencing / rash-driving ─────────────────────────────
// stopDwellTimers: tracks when the bus ENTERED a stop's geofence
const stopDwellTimers = new Map<string, number>(); // key: `${tripId}-${stopId}`
const DWELL_REQUIRED_MS = 5_000; // 5 seconds inside geofence to count as "reached"

// Rash driving: overspeed streak per driver
export const driverOverspeedStreak = new Map<string, number>(); // driverId -> consecutive stops count

// Out-of-area pending confirmation: need 3 consecutive bad fixes before alerting
const outOfAreaCounters = new Map<string, { count: number; since: number }>(); // tripId -> {count, since}
const OUT_OF_AREA_CONFIRM_FIXES = 3;
const OUT_OF_AREA_CONFIRM_MS = 30_000;

// ── Geofencing ────────────────────────────────────────────────────────────────
export async function checkGeofences(
  loc: ProcessedLocation,
  route: { speedLimit?: number | null }
): Promise<LocationAlert[]> {
  const alerts: LocationAlert[] = [];
  const stops = await storage.getRouteStops(loc.routeId);
  const speedLimit = route.speedLimit ?? 40;

  let enteredAny = false;

  for (const stop of stops) {
    const radius = (stop.radius ?? 0.1); // km
    const dist = haversineKm(loc.lat, loc.lng, stop.lat, stop.lng);
    const key = `${loc.tripId}-${stop.id}`;
    const lastEvent = await storage.getLatestGeoEvent(loc.tripId, stop.id);
    const alreadyReached = lastEvent?.type === "REACHED";

    if (dist <= radius) {
      enteredAny = true;

      if (!alreadyReached) {
        const enterTime = stopDwellTimers.get(key);
        if (!enterTime) {
          // First entry into this geofence
          stopDwellTimers.set(key, Date.now());
        } else if (Date.now() - enterTime >= DWELL_REQUIRED_MS) {
          // Dwelled long enough → mark as REACHED
          await storage.logGeoEvent({ tripId: loc.tripId, stopId: stop.id, type: "REACHED" });
          stopDwellTimers.delete(key);

          // Rash driving check: did the bus overspeed while reaching this stop?
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
                details: {
                  driverName: "Driver",
                  currentSpeed: loc.speed,
                  speedLimit,
                  stopsOverspeeding: streak,
                  stopName: stop.name,
                },
              });
              driverOverspeedStreak.set(loc.driverId, 0); // reset streak
            }
          } else {
            // Travelling at safe speed → reset streak
            driverOverspeedStreak.set(loc.driverId, 0);
          }
        }
      }
    } else {
      // Outside geofence — clear dwell timer
      stopDwellTimers.delete(key);
    }
  }

  return alerts;
}

// ── Operational geofence ──────────────────────────────────────────────────────
export function checkOperationalGeofence(loc: ProcessedLocation): LocationAlert | null {
  const inside = isInsideOperationalArea(loc.lat, loc.lng);
  const key = loc.tripId;

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
        details: {
          confirmedFixes: existing.count,
          elapsedSeconds: Math.round(elapsedMs / 1000),
        },
      };
    }
  } else {
    outOfAreaCounters.delete(key);
  }

  return null;
}

// ── Speed calc helper ──────────────────────────────────────────────────────────
export function calculateSpeed(
  prev: ProcessedLocation | undefined,
  cur: { lat: number; lng: number; timestamp: number; speed?: number }
): number {
  if (cur.speed !== undefined && cur.speed !== null && cur.speed >= 0) return cur.speed;
  if (!prev) return 0;
  const dist = haversineKm(prev.lat, prev.lng, cur.lat, cur.lng);
  const timeDeltaHr = (cur.timestamp - prev.timestamp) / 3_600_000;
  return timeDeltaHr > 0 ? dist / timeDeltaHr : 0;
}
