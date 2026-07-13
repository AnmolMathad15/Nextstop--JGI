import { eq, desc, and, sql as drizzleSql, avg, count } from "drizzle-orm";
import { db } from "./db";
import {
  users, routes, routeStops, buses, drivers, students, trips, liveLocations,
  geoEvents, driverStats, fleetAlerts, notifications,
  type User, type InsertUser, type Route, type InsertRoute,
  type RouteStop, type InsertRouteStop, type Bus, type InsertBus,
  type Driver, type InsertDriver, type Student, type InsertStudent,
  type Trip, type InsertTrip, type LiveLocation, type InsertLiveLocation,
  type GeoEvent, type InsertGeoEvent, type DriverStats, type InsertDriverStats,
  type FleetAlert, type InsertFleetAlert, type Notification, type InsertNotification,
} from "@shared/schema";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  getRoutes(): Promise<Route[]>;
  getRoute(id: number): Promise<Route | undefined>;
  createRoute(route: InsertRoute): Promise<Route>;
  getRouteStops(routeId: number): Promise<RouteStop[]>;
  createRouteStop(stop: InsertRouteStop): Promise<RouteStop>;

  getBuses(): Promise<Bus[]>;
  getBus(id: string): Promise<Bus | undefined>;
  createBus(bus: InsertBus): Promise<Bus>;
  updateBus(id: string, data: Partial<InsertBus>): Promise<Bus | undefined>;
  deleteBus(id: string): Promise<void>;

  getDrivers(): Promise<(Driver & { user: User | null })[]>;
  getDriver(id: string): Promise<Driver | undefined>;
  getDriverByUserId(userId: string): Promise<Driver | undefined>;
  createDriver(driver: InsertDriver): Promise<Driver>;

  getStudents(): Promise<(Student & { user: User | null })[]>;
  getStudent(id: string): Promise<Student | undefined>;
  getStudentByUserId(userId: string): Promise<Student | undefined>;
  createStudent(student: InsertStudent): Promise<Student>;

  getActiveTrips(): Promise<Trip[]>;
  getTrip(id: string): Promise<Trip | undefined>;
  getActiveTripByDriver(driverId: string): Promise<Trip | undefined>;
  createTrip(trip: InsertTrip): Promise<Trip>;
  endTrip(tripId: string): Promise<Trip | undefined>;
  pauseTrip(tripId: string): Promise<Trip | undefined>;
  resumeTrip(tripId: string): Promise<Trip | undefined>;

  appendLiveLocation(location: InsertLiveLocation): Promise<LiveLocation>;
  getLatestLocationForTrip(tripId: string): Promise<LiveLocation | undefined>;
  getLatestLocationsForRoute(routeId: number): Promise<LiveLocation[]>;

  // Geo events
  logGeoEvent(event: InsertGeoEvent): Promise<GeoEvent>;
  getLatestGeoEvent(tripId: string, stopId: number): Promise<GeoEvent | undefined>;

  // Driver stats
  updateDriverStats(driverId: string, stats: Partial<InsertDriverStats>): Promise<DriverStats>;
  getDriverStats(driverId: string): Promise<DriverStats | undefined>;

  // Fleet alerts
  createFleetAlert(alert: InsertFleetAlert): Promise<FleetAlert>;
  getFleetAlerts(status?: string): Promise<FleetAlert[]>;
  updateFleetAlertStatus(id: string, status: string, adminNotes?: string): Promise<FleetAlert | undefined>;

  // Notifications
  createNotification(n: InsertNotification): Promise<Notification>;
  getNotifications(limit?: number): Promise<Notification[]>;

  // Analytics
  getAnalyticsMostDelayedStops(): Promise<{ stopName: string; routeId: number; avgDelayMin: number; count: number }[]>;
  getAnalyticsAvgTripDuration(): Promise<{ avgMinutes: number; totalTrips: number }>;
  getAnalyticsDriverPunctuality(): Promise<{ driverId: string; overspeedCount: number; performanceScore: number; totalDistance: number }[]>;
  getAnalyticsAvgSpeed(): Promise<{ avgSpeedKmh: number }>;
  getAnalyticsNotificationStats(): Promise<{ totalSent: number; byType: { type: string; count: number }[] }>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async getRoutes(): Promise<Route[]> {
    return db.select().from(routes).orderBy(routes.displayOrder);
  }

  async getRoute(id: number): Promise<Route | undefined> {
    const [route] = await db.select().from(routes).where(eq(routes.id, id));
    return route;
  }

  async createRoute(route: InsertRoute): Promise<Route> {
    const [created] = await db.insert(routes).values(route).returning();
    return created;
  }

  async getRouteStops(routeId: number): Promise<RouteStop[]> {
    return db.select().from(routeStops)
      .where(eq(routeStops.routeId, routeId))
      .orderBy(routeStops.sequence);
  }

  async createRouteStop(stop: InsertRouteStop): Promise<RouteStop> {
    const [created] = await db.insert(routeStops).values(stop).returning();
    return created;
  }

  async getBuses(): Promise<Bus[]> {
    return db.select().from(buses);
  }

  async getBus(id: string): Promise<Bus | undefined> {
    const [bus] = await db.select().from(buses).where(eq(buses.id, id));
    return bus;
  }

  async createBus(bus: InsertBus): Promise<Bus> {
    const [created] = await db.insert(buses).values(bus).returning();
    return created;
  }

  async updateBus(id: string, data: Partial<InsertBus>): Promise<Bus | undefined> {
    const [updated] = await db.update(buses).set(data).where(eq(buses.id, id)).returning();
    return updated;
  }

  async deleteBus(id: string): Promise<void> {
    await db.delete(buses).where(eq(buses.id, id));
  }

  async getDrivers(): Promise<(Driver & { user: User | null })[]> {
    const result = await db.select().from(drivers).leftJoin(users, eq(drivers.userId, users.id));
    return result.map(r => ({ ...r.drivers, user: r.users }));
  }

  async getDriver(id: string): Promise<Driver | undefined> {
    const [driver] = await db.select().from(drivers).where(eq(drivers.id, id));
    return driver;
  }

  async getDriverByUserId(userId: string): Promise<Driver | undefined> {
    const [driver] = await db.select().from(drivers).where(eq(drivers.userId, userId));
    return driver;
  }

  async createDriver(driver: InsertDriver): Promise<Driver> {
    const [created] = await db.insert(drivers).values(driver).returning();
    return created;
  }

  async getStudents(): Promise<(Student & { user: User | null })[]> {
    const result = await db.select().from(students).leftJoin(users, eq(students.userId, users.id));
    return result.map(r => ({ ...r.students, user: r.users }));
  }

  async getStudent(id: string): Promise<Student | undefined> {
    const [student] = await db.select().from(students).where(eq(students.id, id));
    return student;
  }

  async getStudentByUserId(userId: string): Promise<Student | undefined> {
    const [student] = await db.select().from(students).where(eq(students.userId, userId));
    return student;
  }

  async createStudent(student: InsertStudent): Promise<Student> {
    const [created] = await db.insert(students).values(student).returning();
    return created;
  }

  async getActiveTrips(): Promise<Trip[]> {
    return db.select().from(trips).where(eq(trips.status, "active"));
  }

  async getTrip(id: string): Promise<Trip | undefined> {
    const [trip] = await db.select().from(trips).where(eq(trips.id, id));
    return trip;
  }

  async getActiveTripByDriver(driverId: string): Promise<Trip | undefined> {
    const [trip] = await db.select().from(trips).where(
      and(eq(trips.driverId, driverId), eq(trips.status, "active"))
    );
    return trip;
  }

  async createTrip(trip: InsertTrip): Promise<Trip> {
    const [created] = await db.insert(trips).values(trip).returning();
    return created;
  }

  async endTrip(tripId: string): Promise<Trip | undefined> {
    const [ended] = await db.update(trips)
      .set({ status: "completed", endedAt: new Date() })
      .where(eq(trips.id, tripId))
      .returning();
    return ended;
  }

  async pauseTrip(tripId: string): Promise<Trip | undefined> {
    const [paused] = await db.update(trips)
      .set({ status: "paused" })
      .where(eq(trips.id, tripId))
      .returning();
    return paused;
  }

  async resumeTrip(tripId: string): Promise<Trip | undefined> {
    const [resumed] = await db.update(trips)
      .set({ status: "active" })
      .where(eq(trips.id, tripId))
      .returning();
    return resumed;
  }

  async appendLiveLocation(location: InsertLiveLocation): Promise<LiveLocation> {
    const [created] = await db.insert(liveLocations).values(location).returning();
    return created;
  }

  async getLatestLocationForTrip(tripId: string): Promise<LiveLocation | undefined> {
    const [location] = await db.select().from(liveLocations)
      .where(eq(liveLocations.tripId, tripId))
      .orderBy(desc(liveLocations.recordedAt))
      .limit(1);
    return location;
  }

  async getLatestLocationsForRoute(routeId: number): Promise<LiveLocation[]> {
    const activeTrips = await db.select().from(trips).where(
      and(eq(trips.routeId, routeId), eq(trips.status, "active"))
    );
    const locations: LiveLocation[] = [];
    for (const trip of activeTrips) {
      const loc = await this.getLatestLocationForTrip(trip.id);
      if (loc) locations.push(loc);
    }
    return locations;
  }

  async logGeoEvent(event: InsertGeoEvent): Promise<GeoEvent> {
    const [created] = await db.insert(geoEvents).values(event).returning();
    return created;
  }

  async getLatestGeoEvent(tripId: string, stopId: number): Promise<GeoEvent | undefined> {
    const [event] = await db.select().from(geoEvents)
      .where(and(eq(geoEvents.tripId, tripId), eq(geoEvents.stopId, stopId)))
      .orderBy(desc(geoEvents.timestamp))
      .limit(1);
    return event;
  }

  async updateDriverStats(driverId: string, stats: Partial<InsertDriverStats>): Promise<DriverStats> {
    const [existing] = await db.select().from(driverStats).where(eq(driverStats.driverId, driverId));
    if (existing) {
      const [updated] = await db.update(driverStats)
        .set({ ...stats, lastUpdate: new Date() })
        .where(eq(driverStats.driverId, driverId))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(driverStats).values({
        driverId,
        totalDistance: stats.totalDistance || 0,
        avgSpeed: stats.avgSpeed || 0,
        overspeedCount: stats.overspeedCount || 0,
        performanceScore: stats.performanceScore || 100,
      }).returning();
      return created;
    }
  }

  async getDriverStats(driverId: string): Promise<DriverStats | undefined> {
    const [stats] = await db.select().from(driverStats).where(eq(driverStats.driverId, driverId));
    return stats;
  }

  // ── Fleet alerts ──────────────────────────────────────────────────────────

  async createFleetAlert(alert: InsertFleetAlert): Promise<FleetAlert> {
    const [created] = await db.insert(fleetAlerts).values(alert).returning();
    return created;
  }

  async getFleetAlerts(status?: string): Promise<FleetAlert[]> {
    if (status) {
      return db.select().from(fleetAlerts)
        .where(eq(fleetAlerts.status, status))
        .orderBy(desc(fleetAlerts.timestamp));
    }
    return db.select().from(fleetAlerts).orderBy(desc(fleetAlerts.timestamp));
  }

  async updateFleetAlertStatus(id: string, status: string, adminNotes?: string): Promise<FleetAlert | undefined> {
    const [updated] = await db.update(fleetAlerts)
      .set({ status, ...(adminNotes !== undefined ? { adminNotes } : {}) })
      .where(eq(fleetAlerts.id, id))
      .returning();
    return updated;
  }

  // ── Notifications ─────────────────────────────────────────────────────────

  async createNotification(n: InsertNotification): Promise<Notification> {
    const [created] = await db.insert(notifications).values(n).returning();
    return created;
  }

  async getNotifications(limit = 100): Promise<Notification[]> {
    return db.select().from(notifications)
      .orderBy(desc(notifications.sentAt))
      .limit(limit);
  }

  // ── Analytics ──────────────────────────────────────────────────────────────

  /**
   * Most delayed stops: compares scheduledTime on routeStops with actual
   * arrival recorded in geoEvents (REACHED). Returns top 10.
   */
  async getAnalyticsMostDelayedStops(): Promise<{
    stopName: string; routeId: number; avgDelayMin: number; count: number;
  }[]> {
    // We compute delay as (actual arrival − scheduled time) in minutes.
    // scheduledTime is stored as "HH:MM" string; we convert it to minutes-since-midnight.
    const rows = await db.execute(drizzleSql`
      SELECT
        rs.name                                                        AS "stopName",
        rs.route_id                                                    AS "routeId",
        COUNT(ge.id)::int                                              AS "count",
        AVG(
          EXTRACT(EPOCH FROM ge.timestamp) / 60
          - (
              SPLIT_PART(rs.scheduled_time, ':', 1)::int * 60
              + SPLIT_PART(rs.scheduled_time, ':', 2)::int
              -- Offset by midnight of the geo-event day so comparison is same-day
              + EXTRACT(EPOCH FROM DATE_TRUNC('day', ge.timestamp)) / 60
            )
        )::float                                                       AS "avgDelayMin"
      FROM geo_events ge
      JOIN route_stops rs ON rs.id = ge.stop_id
      WHERE ge.type = 'REACHED'
        AND rs.scheduled_time IS NOT NULL
      GROUP BY rs.id, rs.name, rs.route_id
      ORDER BY "avgDelayMin" DESC
      LIMIT 10
    `);
    return rows.rows as { stopName: string; routeId: number; avgDelayMin: number; count: number }[];
  }

  /** Average trip duration across all completed trips (minutes). */
  async getAnalyticsAvgTripDuration(): Promise<{ avgMinutes: number; totalTrips: number }> {
    const result = await db.execute(drizzleSql`
      SELECT
        AVG(EXTRACT(EPOCH FROM (ended_at - started_at)) / 60)::float AS "avgMinutes",
        COUNT(*)::int                                                  AS "totalTrips"
      FROM trips
      WHERE status = 'completed' AND ended_at IS NOT NULL AND started_at IS NOT NULL
    `);
    const r = (result.rows?.[0] as { avgMinutes: number; totalTrips: number } | undefined)
      ?? { avgMinutes: 0, totalTrips: 0 };
    return r;
  }

  /** Driver punctuality: overspeed count + performance score for each driver. */
  async getAnalyticsDriverPunctuality(): Promise<{
    driverId: string; overspeedCount: number; performanceScore: number; totalDistance: number;
  }[]> {
    return db.select({
      driverId:         driverStats.driverId,
      overspeedCount:   driverStats.overspeedCount,
      performanceScore: driverStats.performanceScore,
      totalDistance:    driverStats.totalDistance,
    }).from(driverStats).orderBy(desc(driverStats.performanceScore)) as Promise<{
      driverId: string; overspeedCount: number; performanceScore: number; totalDistance: number;
    }[]>;
  }

  /** Average bus speed from the live_locations table. */
  async getAnalyticsAvgSpeed(): Promise<{ avgSpeedKmh: number }> {
    const result = await db.execute(drizzleSql`
      SELECT AVG(speed)::float AS "avgSpeedKmh"
      FROM live_locations
      WHERE speed IS NOT NULL AND speed > 0
    `);
    const r = (result.rows?.[0] as { avgSpeedKmh: number } | undefined) ?? { avgSpeedKmh: 0 };
    return r;
  }

  /** Notification delivery statistics: total sent and breakdown by type. */
  async getAnalyticsNotificationStats(): Promise<{
    totalSent: number; byType: { type: string; count: number }[];
  }> {
    const rows = await db.execute(drizzleSql`
      SELECT notification_type AS type, COUNT(*)::int AS count
      FROM notifications
      GROUP BY notification_type
      ORDER BY count DESC
    `);
    const byType = (rows.rows as { type: string; count: number }[]);
    const totalSent = byType.reduce((s, r) => s + r.count, 0);
    return { totalSent, byType };
  }
}

export const storage = new DatabaseStorage();
