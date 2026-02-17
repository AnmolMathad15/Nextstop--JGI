# JCET College Bus Tracking System

## Overview
A real-time college bus tracking application built for JCET College. It allows students, drivers, and admins to manage and track bus routes with live GPS locations.

## Tech Stack
- **Frontend**: React 18, Vite, TailwindCSS v3, Radix UI, Wouter (routing), Leaflet (maps)
- **Backend**: Express.js, TypeScript, tsx
- **Database**: PostgreSQL with Drizzle ORM
- **Real-time**: WebSocket (ws) for live location updates

## Project Structure
- `client/` - React frontend (entry: `client/src/main.tsx`)
- `server/` - Express backend (entry: `server/index.ts`)
- `shared/` - Shared schema definitions (`shared/schema.ts`)
- `attached_assets/` - Static assets

## Key Files
- `server/db.ts` - Database connection (pg driver + Drizzle)
- `server/routes.ts` - API routes + database seeding
- `server/storage.ts` - Data access layer
- `server/websocket.ts` - WebSocket for live tracking
- `shared/schema.ts` - Drizzle schema (users, routes, buses, drivers, students, trips, live_locations)
- `vite.config.ts` - Vite configuration with path aliases (@, @shared, @assets)
- `drizzle.config.ts` - Drizzle Kit configuration

## Scripts
- `npm run dev` - Start development server (tsx)
- `npm run db:push` - Push schema to database
- `npm run build` - Production build

## Database
- Uses Replit's built-in PostgreSQL
- Schema managed via Drizzle ORM with `drizzle-kit push`
- Seed data includes 6 bus routes, 6 buses, and demo users (admin/driver/student)

## Demo Credentials
- Admin: admin / admin123
- Driver: driver1 / driver123
- Student: 2JH23CS001 / student123
