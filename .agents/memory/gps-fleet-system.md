---
name: GPS Fleet System Architecture
description: Key design decisions for the NextStop JGI GPS tracking and fleet alert system
---

# GPS Fleet System Architecture

## Core Pattern
`server/locationService.ts` is the modular processing engine — source-agnostic. Any GPS provider (mobile GPS, hardware GPS, manual) feeds through `validateLocation()`. WebSocket handlers just call these functions, never hardcode GPS logic.

## Validation Rules
- Max accuracy gate: 20m (mobile GPS only)
- Impossible jump: >200 km/h implied speed → drop
- Battery saver gate: <10m moved AND <3s elapsed → skip broadcast

## Geofencing
- Stop geofence radius: 0.1 km (100m) default, stored per-stop in `route_stops.radius`
- Dwell time required: 5 seconds inside before firing REACHED event
- Operational polygon: Hubli-Dharwad bounding box [74.88–75.30 lng, 15.28–15.53 lat]
- Out-of-area needs 3 consecutive bad fixes over 30s to avoid false positives

## Rash Driving
- Tracked via `driverOverspeedStreak` map (driverId → consecutive overspeed stop count)
- Alert fires at streak ≥ 3, then resets to 0

## Offline Detection
- Server: 15s timeout per tripId, broadcasts `bus:paused` to subscribers
- Client (BusMap): 15s timeout on last received update, shows "Driver Offline" banner
- Client (useWebSocket): scheduleOfflineDetection on every `bus:update`

## Fleet Alerts
- Stored in `fleet_alerts` DB table; severity: low/medium/high
- Types: OUT_OF_AREA, RASH_DRIVING, OVERSPEED, GPS_OFFLINE, DRIVER_OFFLINE, STOP_REACHED
- Broadcast to admin WS clients as `fleet:alert` messages
- REST: GET /api/alerts, PATCH /api/alerts/:id

## Trip Status
- `trips.status` values: active | paused | completed
- WebSocket: trip:pause → pauseTrip (DB) + clears offline timer + broadcasts bus:paused
- WebSocket: trip:resume → resumeTrip (DB) + broadcasts bus:resumed

**Why:** Modular design allows future integration of hardware GPS (Transight 4G, ESP32) without changing broadcast/analytics code.
