---
name: Notification Engine Architecture
description: 10-stage intelligent notification engine added to NextStop JGI — how it works and key decisions.
---

# Notification Engine Architecture

## Rule
The notification pipeline flows: GPS → validateLocation → recordSpeedSample → computeRouteProgress → checkGeofences (multi-radius) → getETANotificationStage → shouldSendNotification → emitNotification (student-targeted WS broadcast + DB persist).

**Why:** Spec required Uber/Google Maps-style notifications that combine GPS position, route progress, average speed, stop geofences, ETA prediction, and spam protection — not just straight-line distance.

## How to apply
- ETA is computed from rolling 60s average speed (MIN 5 km/h, MAX 80 km/h valid range) in `server/etaService.ts`
- Route progress projects bus onto nearest route segment in `server/routeProgressService.ts`
- Multi-radius geofences: 1000m NEAR, 500m APPROACHING (forces 2-min notif), 100m ARRIVED (5s dwell), 300m DEPARTED in `server/locationService.ts`
- Spam protection in `server/notificationService.ts`: same type suppressed for 90s; can't regress to lower-priority stage
- Student targeting: students only get notifications for their preferredStopId (resolved on WS subscribe); general notifications (OVERSPEED, TRIP_STARTED) go to all on route
- Notifications persisted to `notifications` table (added to schema)

## GPS Validation thresholds (updated from original)
- Max speed: 120 km/h (was 200 km/h implied only)
- Jump: >250m in <2s rejected
- Accuracy: >50m rejected (was 20m)
- Heading: >90° change in <2s rejected

## New socket events (server → client)
`gps:update`, `route:update`, `eta:update`, `notification`, `trip:start`, `trip:end`, `driver:panic`
`bus:update` kept for backward-compat

## Analytics endpoints
`GET /api/analytics/delayed-stops|trip-duration|driver-punctuality|avg-speed|notification-stats|summary`
`GET /api/notifications` — persisted notification history
