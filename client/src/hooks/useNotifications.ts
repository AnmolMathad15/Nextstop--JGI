/**
 * useNotifications — React hook for WebSocket-driven toast notifications.
 *
 * Listens for `notification` and `eta:update` socket events and fires
 * React-Toastify toasts with the correct colour for each stage.
 *
 * Color mapping (from spec):
 *   Blue   → upcoming / approaching
 *   Orange → delayed
 *   Green  → arrived / departed / completed
 *   Red    → emergency / overspeed / route changed
 */

import { useCallback } from "react";
import { toast, type ToastOptions } from "react-toastify";
import type { NotificationType, NotificationPayload } from "./useWebSocket";

// ── Toast colour helper ───────────────────────────────────────────────────────

type ToastType = "info" | "warning" | "success" | "error" | "default";

function toastTypeForNotification(type: NotificationType): ToastType {
  switch (type) {
    case "APPROACHING_10MIN":
    case "APPROACHING_5MIN":
    case "APPROACHING_2MIN":
    case "TRIP_STARTED":
      return "info";      // Blue

    case "DELAYED":
      return "warning";   // Orange

    case "BUS_ARRIVING":
    case "BUS_DEPARTED":
    case "TRIP_COMPLETED":
      return "success";   // Green

    case "OVERSPEED":
    case "ROUTE_CHANGED":
      return "error";     // Red

    default:
      return "default";
  }
}

function titleForType(type: NotificationType): string {
  switch (type) {
    case "APPROACHING_10MIN":  return "🚌 Bus 10 Minutes Away";
    case "APPROACHING_5MIN":   return "🚌 Bus 5 Minutes Away";
    case "APPROACHING_2MIN":   return "🚌 Bus Almost Here!";
    case "BUS_ARRIVING":       return "✅ Bus Has Arrived";
    case "BUS_DEPARTED":       return "🚌 Bus Has Departed";
    case "DELAYED":            return "⏰ Bus Delayed";
    case "ROUTE_CHANGED":      return "⚠️ Route Changed";
    case "OVERSPEED":          return "🚨 Overspeed Alert";
    case "TRIP_STARTED":       return "🟢 Trip Started";
    case "TRIP_COMPLETED":     return "🏁 Trip Completed";
    default:                   return "Bus Update";
  }
}

// ── Toast body builder ────────────────────────────────────────────────────────

function buildToastBody(n: NotificationPayload): string {
  const lines: string[] = [];

  if (n.busName)        lines.push(`Bus: ${n.busName}`);
  if (n.routeName)      lines.push(`Route: ${n.routeName}`);
  if (n.stopName)       lines.push(`Stop: ${n.stopName}`);
  if (n.etaMinutes != null && isFinite(n.etaMinutes))
    lines.push(`ETA: ${Math.round(n.etaMinutes)} min`);
  if (n.currentSpeed != null)
    lines.push(`Speed: ${n.currentSpeed.toFixed(0)} km/h`);
  if (n.expectedArrival)
    lines.push(`Expected: ${n.expectedArrival}`);

  return lines.join(" · ");
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useNotifications() {
  /**
   * Fire a Toastify toast for the given notification payload.
   * Call this from the WebSocket `notification` message handler.
   */
  const showNotification = useCallback((n: NotificationPayload) => {
    const title   = titleForType(n.type);
    const body    = buildToastBody(n);
    const type    = toastTypeForNotification(n.type);
    const message = body ? `${title}\n${body}` : title;

    const opts: ToastOptions = {
      toastId: `${n.tripId}-${n.stopId ?? "general"}-${n.type}`,
      autoClose: 6000,
      position: "top-right",
    };

    switch (type) {
      case "info":    toast.info(message, opts);    break;
      case "warning": toast.warning(message, opts); break;
      case "success": toast.success(message, opts); break;
      case "error":   toast.error(message, opts);   break;
      default:        toast(message, opts);          break;
    }
  }, []);

  return { showNotification };
}

// Re-export the types so consumers can import from one place
export type { NotificationType, NotificationPayload };
