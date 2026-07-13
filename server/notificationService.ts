/**
 * notificationService.ts — 10-Stage Intelligent Notification Engine
 *
 * Implements Uber/Google Maps-style notification stages with:
 * - ETA-based triggers (10min / 5min / 2min away)
 * - Geofence-based triggers (1000m / 500m / 100m / 300m departure)
 * - Spam protection: deduplicated per (bus, stop, trip)
 * - Student targeting: only notify students subscribed to the relevant stop/route
 */

// ── Notification types ────────────────────────────────────────────────────────

export type NotificationType =
  | "APPROACHING_10MIN"   // Stage 1: 10 minutes away
  | "APPROACHING_5MIN"    // Stage 2: 5 minutes away
  | "APPROACHING_2MIN"    // Stage 3: 2 minutes away (also fired at 500m geofence)
  | "BUS_ARRIVING"        // Stage 4: bus entering stop (100m)
  | "BUS_DEPARTED"        // Stage 5: bus departed stop (300m exit)
  | "DELAYED"             // Stage 6: bus delayed beyond threshold
  | "ROUTE_CHANGED"       // Stage 7: route deviation detected
  | "OVERSPEED"           // Stage 8: driver overspeed warning
  | "TRIP_STARTED"        // Stage 9: trip began
  | "TRIP_COMPLETED";     // Stage 10: trip ended

export interface NotificationPayload {
  type: NotificationType;
  tripId: string;
  busId: string;
  routeId: number;
  stopId?: number;
  /** Estimated minutes until bus reaches the target stop */
  etaMinutes?: number;
  /** Human-readable names for the toast */
  busName?: string;
  routeName?: string;
  stopName?: string;
  currentSpeed?: number;      // km/h
  expectedArrival?: string;   // HH:MM format for display
}

// ── Spam protection ───────────────────────────────────────────────────────────

interface HistoryEntry {
  lastType: NotificationType;
  lastSentAt: number;
}

/**
 * Key: `${tripId}-${stopId ?? "general"}`
 * Tracks the last notification sent per (trip, stop) combination.
 */
const notificationHistory = new Map<string, HistoryEntry>();

/**
 * ETA-based stages in order of priority (most urgent first).
 * Used to avoid sending a lower-priority stage after a higher one was already sent.
 */
const ETA_STAGE_PRIORITY: Record<string, number> = {
  BUS_ARRIVING:      10,
  BUS_DEPARTED:       9,
  APPROACHING_2MIN:   8,
  APPROACHING_5MIN:   7,
  APPROACHING_10MIN:  6,
  DELAYED:            5,
  ROUTE_CHANGED:      4,
  OVERSPEED:          3,
  TRIP_STARTED:       2,
  TRIP_COMPLETED:     1,
};

const SAME_TYPE_COOLDOWN_MS = 90_000; // 90 seconds before resending the same type

/**
 * Returns true if this notification should be sent.
 *
 * Suppression rules:
 * 1. Same type sent within the cooldown window → suppress.
 * 2. A higher-priority type was already sent for this stop in this trip → suppress
 *    lower-priority types (avoids going "backward" e.g. 10min after 2min).
 * 3. Type changed → always send.
 */
export function shouldSendNotification(n: NotificationPayload): boolean {
  const key  = `${n.tripId}-${n.stopId ?? "general"}`;
  const hist = notificationHistory.get(key);

  if (!hist) return true; // first notification for this (trip, stop)

  const now        = Date.now();
  const elapsed    = now - hist.lastSentAt;
  const newPrio    = ETA_STAGE_PRIORITY[n.type] ?? 0;
  const lastPrio   = ETA_STAGE_PRIORITY[hist.lastType] ?? 0;

  // Type hasn't changed and we're inside the cooldown window → suppress
  if (hist.lastType === n.type && elapsed < SAME_TYPE_COOLDOWN_MS) return false;

  // Don't regress to a less urgent stage (e.g. 5min after 2min was already sent)
  if (newPrio < lastPrio) return false;

  return true;
}

/** Record a notification as sent in the history map. */
export function recordNotification(n: NotificationPayload): void {
  const key = `${n.tripId}-${n.stopId ?? "general"}`;
  notificationHistory.set(key, { lastType: n.type, lastSentAt: Date.now() });
}

/** Remove all history entries for a completed/ended trip. */
export function clearNotificationHistory(tripId: string): void {
  for (const key of Array.from(notificationHistory.keys())) {
    if (key.startsWith(`${tripId}-`)) notificationHistory.delete(key);
  }
}

// ── Stage selection ───────────────────────────────────────────────────────────

/**
 * Determine which ETA-based notification stage to trigger.
 *
 * @param etaMinutes        - ETA to the student's stop (from etaService)
 * @param distanceToStopKm  - haversine distance from bus to stop
 * @returns NotificationType to fire, or null if none applies
 */
export function getETANotificationStage(
  etaMinutes: number,
  distanceToStopKm: number,
): NotificationType | null {
  // Geofence-based (takes priority over ETA timer)
  if (distanceToStopKm <= 0.1) return "BUS_ARRIVING";    // 100 m
  if (distanceToStopKm <= 0.5) return "APPROACHING_2MIN"; // 500 m → force "2 min"

  // ETA-based
  if (etaMinutes <= 2)  return "APPROACHING_2MIN";
  if (etaMinutes <= 5)  return "APPROACHING_5MIN";
  if (etaMinutes <= 10) return "APPROACHING_10MIN";

  return null;
}

// ── Toast display helpers ─────────────────────────────────────────────────────

export type ToastColor = "blue" | "orange" | "green" | "red" | "gray";

/** Map notification type to the frontend toast color. */
export function getToastColor(type: NotificationType): ToastColor {
  switch (type) {
    case "APPROACHING_10MIN":
    case "APPROACHING_5MIN":
    case "APPROACHING_2MIN":
    case "TRIP_STARTED":
      return "blue";

    case "DELAYED":
      return "orange";

    case "BUS_ARRIVING":
    case "BUS_DEPARTED":
    case "TRIP_COMPLETED":
      return "green";

    case "OVERSPEED":
    case "ROUTE_CHANGED":
      return "red";

    default:
      return "gray";
  }
}

/** Human-readable title for each notification stage. */
export function getNotificationTitle(type: NotificationType): string {
  switch (type) {
    case "APPROACHING_10MIN":  return "Bus 10 Minutes Away";
    case "APPROACHING_5MIN":   return "Bus 5 Minutes Away";
    case "APPROACHING_2MIN":   return "Bus Almost Here";
    case "BUS_ARRIVING":       return "Bus Has Arrived";
    case "BUS_DEPARTED":       return "Bus Has Departed";
    case "DELAYED":            return "Bus Delayed";
    case "ROUTE_CHANGED":      return "Route Changed";
    case "OVERSPEED":          return "⚠️ Overspeed Alert";
    case "TRIP_STARTED":       return "Trip Started";
    case "TRIP_COMPLETED":     return "Trip Completed";
  }
}
