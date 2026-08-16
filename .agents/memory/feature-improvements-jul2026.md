---
name: Feature improvements July 2026
description: 8 improvements added to NextStop JGI — routes from DB, offline detection, arrival gate, push notifications, map matching, analytics charts, lazy loading, scheduled timetable
---

## What was built

### 1. Routes & stops from database (RouteSelector.tsx)
- RouteSelector now fetches `/api/routes` and `/api/routes/:id` with fallback to `ROUTES_DATA` constants
- Admin can toggle routes active/inactive via `PATCH /api/routes/:id`
- Admin can add/delete stops via `POST /api/route-stops` and `DELETE /api/route-stops/:id`
- New "Routes" tab in AdminDashboard with expandable stop lists

### 2. Server-side bus offline detection (websocket.ts)
- `OFFLINE_THRESHOLD_MS` raised from 15s to 30s
- On timeout: broadcasts `bus:offline` (was `bus:paused`) AND creates a `GPS_OFFLINE` fleet alert in DB
- Fleet alert persists so admins see it in the dashboard even after reconnect

### 3. Accurate geofence arrival detection (locationService.ts)
- Added speed gate: arrival only confirmed when `loc.speed <= 8 km/h`
- Prevents drive-by false positives when bus passes close to a stop without stopping
- One-line change in checkGeofences dwell confirmation

### 4. Push notifications PWA (sw.js, routes.ts, StudentPage.tsx)
- VAPID keys stored as `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` env vars
- Service worker: `client/public/sw.js` handles push events + notification click
- PWA manifest: `client/public/manifest.json` + meta tags in index.html
- Endpoints: `GET /api/push/vapid-key`, `POST /api/push/subscribe`, `DELETE /api/push/subscribe`
- Student Settings tab has a real push toggle that subscribes/unsubscribes via SW

### 5. Mapbox Map Matching (mapMatching.ts)
- Upgraded from OSRM to Mapbox Map Matching API
- Uses `VITE_MAPBOX_TOKEN` (already present) — no new secrets needed
- 50m snap radius per point, confidence threshold 0.2, 3s timeout, silent fallback

### 6. Admin analytics dashboard (AdminDashboard.tsx)
- New "Analytics" tab with recharts charts
- KPI cards: avg trip duration, fleet avg speed, total notifications
- BarChart: notification type breakdown
- BarChart: driver performance scores
- List: top 5 most delayed stops
- Data from `/api/analytics/summary` — loads only when tab is active

### 7. Lazy-loading / bundle size (vite.config.ts, AdminPage, DriverPage, StudentPage)
- `manualChunks`: mapbox-gl → `mapbox-CJtK.js` (1.8MB, deferred), recharts → `recharts-6Jbq.js`
- BusMap lazy-loaded in all 3 pages (StudentPage, AdminPage, DriverPage) with Suspense spinners
- BusMap chunk: 32 kB (was bundled into the main 500 kB+ chunk)

### 8. Scheduled trip timetable (schedules table, StudentPage)
- New `schedules` table: id, routeId, label, departureTime, daysOfWeek, isActive
- New `pushSubscriptions` table: id, userId, endpoint, p256dh, auth
- Auto-seeded: 2 schedules per route (Morning Batch + 10:15 AM Batch) from existing stop times
- New "Schedule" tab in StudentPage BottomNavigation
- Shows timetable grouped by route, next departure highlighted, stop-by-stop times for selected route
- Endpoints: `GET /api/schedules?routeId=`, `POST`, `PATCH`, `DELETE /api/schedules/:id`

## Key constraints
- `seedDatabase` was restructured: main routes/users seed returns early if routes exist, but schedule seeding runs independently (checks `schedules` table separately)
- BottomNavigation student tabs: map, routes, schedule, alerts, settings (5 items)
- VAPID keys generated: stored in Replit env vars, must also be set in Vercel env vars for push to work in prod
- Mapbox token reused server-side as `process.env.VITE_MAPBOX_TOKEN` — already a Replit secret

## Authentication seed resilience

Demo users and their driver/student profiles are verified independently during startup rather than behind one admin-account existence check.

**Why:** A partially seeded database can contain the admin row while missing another demo account, making valid demo credentials fail.

**How to apply:** When adding seeded demo data, repair each account/profile independently and normalize usernames before lookup.
