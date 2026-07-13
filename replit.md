# NextStop JGI — Smart Campus Bus Tracker

Real-time bus tracking platform for Jain College of Engineering and Technology (Hubballi-Dharwad campus). Six pre-seeded routes across the twin cities, live GPS tracking, ETA predictions, 10-stage intelligent notifications, and a full analytics dashboard.

---

## Tech stack

| Layer | Tech |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, Mapbox GL JS |
| Backend | Node.js, Express, WebSocket (`ws`) |
| Database | PostgreSQL via Drizzle ORM |
| Real-time | Native WebSocket (Replit / Railway) or REST polling fallback (Vercel) |
| Notifications | React-Toastify, 10-stage server-side engine |
| Maps | Mapbox GL JS with road-snapping via OSRM |

---

## Running locally / on Replit

```bash
npm install
npm run db:push   # initialise / migrate the database
npm run dev       # starts on port 5000
```

### Required environment variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `SESSION_SECRET` | Express-session signing secret |
| `VITE_MAPBOX_TOKEN` | Mapbox public token (build-time) |
| `VITE_MAPBOX_STYLE` | Mapbox style URL (build-time, optional) |
| `OSRM_BASE_URL` | OSRM server for road-snapping (optional) |

See `.env.example` for a full template.

---

## Deploying to Vercel

### 1 — Fork / connect the repo

Import the repository into your Vercel project.

### 2 — Database

Provision a PostgreSQL database.  Options:
- **Vercel Postgres** — `vercel storage create postgres` then link to the project
- **Neon** — https://neon.tech (free tier, serverless-optimised)
- **Supabase** — https://supabase.com (free tier)

After provisioning, run the schema migration once:

```bash
DATABASE_URL=<your-url> npm run db:push
```

### 3 — Environment variables (Vercel dashboard → Settings → Environment Variables)

```
DATABASE_URL          <your postgres URL>
SESSION_SECRET        <random 32-char string>
VITE_MAPBOX_TOKEN     pk.eyJ1...   (get from account.mapbox.com)
VITE_MAPBOX_STYLE     mapbox://styles/mapbox/streets-v12   (optional)
OSRM_BASE_URL         http://router.project-osrm.org       (optional)
```

> **Important:** `VITE_*` variables are baked in at build time. Set them before the first deploy.

### 4 — Build settings (auto-detected from `vercel.json`)

| Setting | Value |
|---|---|
| Build command | `npm run build:client` |
| Output directory | `dist/public` |
| Install command | `npm install` |
| Node version | 20.x |

### 5 — Deploy

```bash
vercel --prod
```

Or push to `main` if CI/CD is configured.

### Real-time on Vercel

| Vercel plan | Real-time behaviour |
|---|---|
| **Hobby** | WebSocket connections hit the 10 s serverless timeout. The client automatically falls back to 3-second HTTP polling (`/api/tracking/poll`). All features work; updates are near-real-time. |
| **Pro / Enterprise** | Fluid compute keeps the function alive. Full WebSocket support with live push notifications. |

---

## Project structure

```
client/          React SPA (Vite)
  src/
    pages/       StudentPage, DriverPage, AdminPage, LoginPage
    components/  BusMap (Mapbox GL), DriverDashboard, AdminDashboard, …
    hooks/       useWebSocket (WS + REST fallback), useNotifications, …
server/
  app.ts         Express factory (shared by Replit + Vercel)
  index.ts       HTTP server entry (Replit / Railway)
  routes.ts      All REST + WS API routes
  websocket.ts   WebSocket handler + notification engine
  locationService.ts  GPS validation, geofencing, speed smoothing
  etaService.ts  ETA calculation (rolling 60 s average speed)
  notificationService.ts  10-stage notification engine, spam protection
  storage.ts     Drizzle ORM queries + analytics
api/
  index.ts       Vercel serverless entry point
shared/
  schema.ts      Drizzle schema (all tables + types)
vercel.json      Vercel deployment config
```

---

## Demo credentials

| Role | Username | Password |
|---|---|---|
| Student | `2JH23CS001` | `student123` |
| Driver | `driver1` | `driver123` |
| Admin | `admin` | `admin123` |

---

## User preferences

- Keep WebSocket as primary real-time transport; REST polling is a fallback only.
- Notification engine must not regress to a lower-priority stage within 90 s.
- GPS validation: 120 km/h max speed, 250 m / 2 s jump limit, 50 m accuracy threshold.
