---
name: WebSocket message types
description: Complete list of WebSocket message types for NextStop JGI
---

# WebSocket Message Types

## Client → Server
| type | payload | description |
|------|---------|-------------|
| `auth` | `{role, userId, driverId}` | authenticate connection |
| `subscribe` | `{routeId?}` | subscribe to route (omit for all routes as admin) |
| `location:update` | `{routeId, busId, lat, lng, speed?, heading?, accuracy?}` | driver GPS update |
| `trip:start` | `{driverId, busId, routeId}` | start trip (driver only) |
| `trip:end` | `{tripId}` | end trip (driver only) |
| `trip:pause` | `{tripId}` | pause trip (driver only) |
| `trip:resume` | `{tripId}` | resume trip (driver only) |

## Server → Client
| type | payload | description |
|------|---------|-------------|
| `auth:success` | `{role}` | auth confirmed |
| `locations:init` | `{locations[]}` | initial snapshot on subscribe |
| `bus:update` | `{location}` | live location broadcast |
| `bus:offline` | `{tripId, routeId}` | trip ended → remove marker |
| `bus:paused` | `{tripId, routeId}` | driver paused or 15s offline |
| `bus:resumed` | `{tripId, routeId}` | driver resumed |
| `trip:started` | `{tripId}` | sent to driver after trip created |
| `trip:ended` | `{tripId}` | sent to driver after trip ended |
| `trip:paused` | `{tripId}` | sent to driver after pause confirmed |
| `trip:resumed` | `{tripId}` | sent to driver after resume confirmed |
| `fleet:alert` | `{alert}` | safety alert to admin clients |
| `location:ack` | — | ACK for driver location update |
| `error` | `{message}` | error message |
