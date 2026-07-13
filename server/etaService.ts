/**
 * etaService.ts — Rolling-average ETA computation
 *
 * ETA = Remaining Route Distance / Average Moving Speed
 *
 * Average speed is computed from the previous 60 seconds of GPS samples.
 * Unrealistic speeds (<5 km/h or >80 km/h) are ignored; the rolling average
 * uses only valid "moving" readings so brief stops don't skew the prediction.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ETAResult {
  etaMinutes: number;         // estimated minutes to reach the target stop
  avgSpeedKmh: number;        // rolling average used for the calculation
  remainingDistanceKm: number;
  expectedArrivalISO: string; // ISO timestamp of predicted arrival
}

// ── Constants ─────────────────────────────────────────────────────────────────

const SPEED_WINDOW_MS   = 60_000; // 60-second sliding window
const MIN_MOVING_KMH    = 5;      // below → bus is stopped, exclude from avg
const MAX_REALISTIC_KMH = 80;     // above → GPS glitch, exclude from avg
const DEFAULT_SPEED_KMH = 20;     // fallback when no valid samples exist

// ── Per-trip speed history ────────────────────────────────────────────────────

interface SpeedSample {
  speedKmh: number;
  timestamp: number;
}

/** tripId → recent speed samples */
const speedHistory = new Map<string, SpeedSample[]>();

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Record a new GPS speed sample for a trip.
 * Call this every time a validated location update arrives.
 */
export function recordSpeedSample(tripId: string, speedKmh: number, timestamp: number): void {
  const history = speedHistory.get(tripId) ?? [];
  history.push({ speedKmh, timestamp });

  // Prune samples older than the window
  const cutoff = timestamp - SPEED_WINDOW_MS;
  const trimmed = history.filter(s => s.timestamp >= cutoff);
  speedHistory.set(tripId, trimmed);
}

/**
 * Return the rolling average moving speed for a trip (km/h).
 * Excludes stopped (<5 km/h) and unrealistic (>80 km/h) readings.
 */
export function getRollingAverageSpeed(tripId: string): number {
  const history = speedHistory.get(tripId) ?? [];
  const validSpeeds = history
    .map(s => s.speedKmh)
    .filter(s => s >= MIN_MOVING_KMH && s <= MAX_REALISTIC_KMH);

  if (validSpeeds.length === 0) return DEFAULT_SPEED_KMH;
  return validSpeeds.reduce((a, b) => a + b, 0) / validSpeeds.length;
}

/**
 * Calculate ETA to a stop given remaining route distance.
 *
 * @param tripId         - used to look up the rolling average speed
 * @param remainingKm    - remaining distance along the route to the target stop
 * @returns ETAResult with minutes, speed used, and ISO arrival timestamp
 */
export function calculateETA(tripId: string, remainingKm: number): ETAResult {
  const avgSpeedKmh = getRollingAverageSpeed(tripId);
  const etaMinutes  = avgSpeedKmh > 0 ? (remainingKm / avgSpeedKmh) * 60 : Infinity;

  const expectedArrival = new Date(Date.now() + etaMinutes * 60_000);

  return {
    etaMinutes,
    avgSpeedKmh,
    remainingDistanceKm: remainingKm,
    expectedArrivalISO: expectedArrival.toISOString(),
  };
}

/** Remove speed history when a trip ends or is paused. */
export function clearSpeedHistory(tripId: string): void {
  speedHistory.delete(tripId);
}
