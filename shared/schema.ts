import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, real, pgEnum } from "drizzle-orm/pg-core";
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
});

export const routeStops = pgTable("route_stops", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  routeId: integer("route_id").notNull().references(() => routes.id),
  name: text("name").notNull(),
  lat: real("lat").notNull(),
  lng: real("lng").notNull(),
  scheduledTime: text("scheduled_time").notNull(),
  sequence: integer("sequence").notNull(),
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
  status: text("status").notNull().default("active"),
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
  type: text("type").notNull(), // ENTER, EXIT
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

export const insertGeoEventSchema = createInsertSchema(geoEvents).pick({
  tripId: true,
  stopId: true,
  type: true,
});

export const insertDriverStatsSchema = createInsertSchema(driverStats).pick({
  driverId: true,
  totalDistance: true,
  avgSpeed: true,
  overspeedCount: true,
  performanceScore: true,
});

export type GeoEvent = typeof geoEvents.$inferSelect;
export type DriverStats = typeof driverStats.$inferSelect;
export type InsertGeoEvent = z.infer<typeof insertGeoEventSchema>;
export type InsertDriverStats = z.infer<typeof insertDriverStatsSchema>;

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  role: true,
  name: true,
  phone: true,
});

export const insertRouteSchema = createInsertSchema(routes).pick({
  name: true,
  displayOrder: true,
  isActive: true,
});

export const insertRouteStopSchema = createInsertSchema(routeStops).pick({
  routeId: true,
  name: true,
  lat: true,
  lng: true,
  scheduledTime: true,
  sequence: true,
});

export const insertBusSchema = createInsertSchema(buses).pick({
  number: true,
  capacity: true,
  isActive: true,
});

export const insertDriverSchema = createInsertSchema(drivers).pick({
  userId: true,
  licenseNumber: true,
  assignedBusId: true,
});

export const insertStudentSchema = createInsertSchema(students).pick({
  userId: true,
  usn: true,
  preferredRouteId: true,
  preferredStop: true,
});

export const insertTripSchema = createInsertSchema(trips).pick({
  driverId: true,
  busId: true,
  routeId: true,
});

export const insertLiveLocationSchema = createInsertSchema(liveLocations).pick({
  tripId: true,
  lat: true,
  lng: true,
  speed: true,
  heading: true,
  accuracy: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type Route = typeof routes.$inferSelect;
export type RouteStop = typeof routeStops.$inferSelect;
export type Bus = typeof buses.$inferSelect;
export type Driver = typeof drivers.$inferSelect;
export type Student = typeof students.$inferSelect;
export type Trip = typeof trips.$inferSelect;
export type LiveLocation = typeof liveLocations.$inferSelect;
export type InsertRoute = z.infer<typeof insertRouteSchema>;
export type InsertRouteStop = z.infer<typeof insertRouteStopSchema>;
export type InsertBus = z.infer<typeof insertBusSchema>;
export type InsertDriver = z.infer<typeof insertDriverSchema>;
export type InsertStudent = z.infer<typeof insertStudentSchema>;
export type InsertTrip = z.infer<typeof insertTripSchema>;
export type InsertLiveLocation = z.infer<typeof insertLiveLocationSchema>;
