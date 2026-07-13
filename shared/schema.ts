import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, real, pgEnum, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const userRoleEnum = pgEnum("user_role", ["student", "driver", "admin"]);

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: userRoleEnum("role").notNull().default("student"),
  name: text("name"),
  phone: text("phone"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const routes = pgTable("routes", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull(),
  displayOrder: integer("display_order").default(0),
  isActive: boolean("is_active").default(true),
  speedLimit: integer("speed_limit").default(40), // km/h
  color: text("color").default("#3b82f6"), // hex color for map polyline
});

export const routeStops = pgTable("route_stops", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  routeId: integer("route_id").notNull().references(() => routes.id),
  name: text("name").notNull(),
  lat: real("lat").notNull(),
  lng: real("lng").notNull(),
  scheduledTime: text("scheduled_time").notNull(),
  time1015am: text("time_1015am"), // 10:15 AM batch scheduled time
  sequence: integer("sequence").notNull(),
  isMainStop: boolean("is_main_stop").default(false), // landmark/major stop
  physicalStopKey: text("physical_stop_key"), // dedup key for geocoding
  radius: real("radius").default(0.1), // geofence radius in km (100m)
});

export const buses = pgTable("buses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  number: text("number").notNull().unique(),
  capacity: integer("capacity").default(40),
  isActive: boolean("is_active").default(true),
});

export const drivers = pgTable("drivers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  licenseNumber: text("license_number"),
  assignedBusId: varchar("assigned_bus_id").references(() => buses.id),
});

export const students = pgTable("students", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  usn: text("usn").notNull().unique(),
  preferredRouteId: integer("preferred_route_id").references(() => routes.id),
  preferredStop: text("preferred_stop"),
});

export const trips = pgTable("trips", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  driverId: varchar("driver_id").notNull().references(() => drivers.id),
  busId: varchar("bus_id").notNull().references(() => buses.id),
  routeId: integer("route_id").notNull().references(() => routes.id),
  status: text("status").notNull().default("active"), // active, paused, completed
  startedAt: timestamp("started_at").defaultNow(),
  endedAt: timestamp("ended_at"),
});

export const liveLocations = pgTable("live_locations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tripId: varchar("trip_id").notNull().references(() => trips.id),
  lat: real("lat").notNull(),
  lng: real("lng").notNull(),
  speed: real("speed"),
  heading: real("heading"),
  accuracy: real("accuracy"),
  recordedAt: timestamp("recorded_at").defaultNow(),
});

export const geoEvents = pgTable("geo_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tripId: varchar("trip_id").notNull().references(() => trips.id),
  stopId: integer("stop_id").notNull().references(() => routeStops.id),
  type: text("type").notNull(), // ENTER, EXIT, REACHED
  timestamp: timestamp("timestamp").defaultNow(),
});

export const driverStats = pgTable("driver_stats", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  driverId: varchar("driver_id").notNull().references(() => drivers.id).unique(),
  totalDistance: real("total_distance").default(0),
  avgSpeed: real("avg_speed").default(0),
  overspeedCount: integer("overspeed_count").default(0),
  performanceScore: integer("performance_score").default(100),
  lastUpdate: timestamp("last_update").defaultNow(),
});

// ── Notification history (persisted for analytics + delivery tracking) ─────────
export const notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tripId: varchar("trip_id").references(() => trips.id),
  busId: varchar("bus_id").references(() => buses.id),
  routeId: integer("route_id").references(() => routes.id),
  stopId: integer("stop_id").references(() => routeStops.id),
  /** null = broadcast to all students on the route; set = targeted to one student */
  userId: varchar("user_id").references(() => users.id),
  notificationType: text("notification_type").notNull(),
  etaMinutes: real("eta_minutes"),
  busName: text("bus_name"),
  routeName: text("route_name"),
  stopName: text("stop_name"),
  currentSpeed: real("current_speed"),
  expectedArrival: text("expected_arrival"),
  sentAt: timestamp("sent_at").defaultNow(),
});

// Fleet alert center
export const fleetAlerts = pgTable("fleet_alerts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tripId: varchar("trip_id").references(() => trips.id),
  busId: varchar("bus_id").references(() => buses.id),
  driverId: varchar("driver_id").references(() => drivers.id),
  alertType: text("alert_type").notNull(),
  // OUT_OF_AREA | RASH_DRIVING | OVERSPEED | GPS_OFFLINE | DRIVER_OFFLINE | STOP_REACHED
  severity: text("severity").notNull().default("medium"), // low | medium | high
  lat: real("lat"),
  lng: real("lng"),
  details: text("details"), // JSON string with extra context
  status: text("status").notNull().default("active"), // active | acknowledged | resolved
  adminNotes: text("admin_notes"),
  timestamp: timestamp("timestamp").defaultNow(),
});

// ── Insert schemas ────────────────────────────────────────────────
export const insertNotificationSchema = createInsertSchema(notifications).pick({
  tripId: true, busId: true, routeId: true, stopId: true, userId: true,
  notificationType: true, etaMinutes: true, busName: true, routeName: true,
  stopName: true, currentSpeed: true, expectedArrival: true,
});
export const insertGeoEventSchema = createInsertSchema(geoEvents).pick({
  tripId: true, stopId: true, type: true,
});
export const insertDriverStatsSchema = createInsertSchema(driverStats).pick({
  driverId: true, totalDistance: true, avgSpeed: true, overspeedCount: true, performanceScore: true,
});
export const insertFleetAlertSchema = createInsertSchema(fleetAlerts).pick({
  tripId: true, busId: true, driverId: true,
  alertType: true, severity: true, lat: true, lng: true, details: true,
});
export const insertUserSchema = createInsertSchema(users).pick({
  username: true, password: true, role: true, name: true, phone: true,
});
export const insertRouteSchema = createInsertSchema(routes).pick({
  name: true, displayOrder: true, isActive: true, speedLimit: true, color: true,
});
export const insertRouteStopSchema = createInsertSchema(routeStops).pick({
  routeId: true, name: true, lat: true, lng: true, scheduledTime: true,
  time1015am: true, sequence: true, isMainStop: true, physicalStopKey: true, radius: true,
});
export const insertBusSchema = createInsertSchema(buses).pick({
  number: true, capacity: true, isActive: true,
});
export const insertDriverSchema = createInsertSchema(drivers).pick({
  userId: true, licenseNumber: true, assignedBusId: true,
});
export const insertStudentSchema = createInsertSchema(students).pick({
  userId: true, usn: true, preferredRouteId: true, preferredStop: true,
});
export const insertTripSchema = createInsertSchema(trips).pick({
  driverId: true, busId: true, routeId: true,
});
export const insertLiveLocationSchema = createInsertSchema(liveLocations).pick({
  tripId: true, lat: true, lng: true, speed: true, heading: true, accuracy: true,
});

// ── Types ─────────────────────────────────────────────────────────
export type GeoEvent      = typeof geoEvents.$inferSelect;
export type DriverStats   = typeof driverStats.$inferSelect;
export type FleetAlert    = typeof fleetAlerts.$inferSelect;
export type Notification  = typeof notifications.$inferSelect;
export type InsertGeoEvent       = z.infer<typeof insertGeoEventSchema>;
export type InsertDriverStats    = z.infer<typeof insertDriverStatsSchema>;
export type InsertFleetAlert     = z.infer<typeof insertFleetAlertSchema>;
export type InsertNotification   = z.infer<typeof insertNotificationSchema>;
export type InsertUser         = z.infer<typeof insertUserSchema>;
export type User               = typeof users.$inferSelect;
export type Route              = typeof routes.$inferSelect;
export type RouteStop          = typeof routeStops.$inferSelect;
export type Bus                = typeof buses.$inferSelect;
export type Driver             = typeof drivers.$inferSelect;
export type Student            = typeof students.$inferSelect;
export type Trip               = typeof trips.$inferSelect;
export type LiveLocation       = typeof liveLocations.$inferSelect;
export type InsertRoute        = z.infer<typeof insertRouteSchema>;
export type InsertRouteStop    = z.infer<typeof insertRouteStopSchema>;
export type InsertBus          = z.infer<typeof insertBusSchema>;
export type InsertDriver       = z.infer<typeof insertDriverSchema>;
export type InsertStudent      = z.infer<typeof insertStudentSchema>;
export type InsertTrip         = z.infer<typeof insertTripSchema>;
export type InsertLiveLocation = z.infer<typeof insertLiveLocationSchema>;
