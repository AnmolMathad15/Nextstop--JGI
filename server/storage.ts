import { eq, desc, and } from "drizzle-orm";
import { db } from "./db";
import {
  users, routes, routeStops, buses, drivers, students, trips, liveLocations,
  type User, type InsertUser, type Route, type InsertRoute,
  type RouteStop, type InsertRouteStop, type Bus, type InsertBus,
  type Driver, type InsertDriver, type Student, type InsertStudent,
  type Trip, type InsertTrip, type LiveLocation, type InsertLiveLocation,
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
  
  appendLiveLocation(location: InsertLiveLocation): Promise<LiveLocation>;
  getLatestLocationForTrip(tripId: string): Promise<LiveLocation | undefined>;
  getLatestLocationsForRoute(routeId: number): Promise<LiveLocation[]>;
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
    return db.select().from(routeStops).where(eq(routeStops.routeId, routeId)).orderBy(routeStops.sequence);
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
    const [trip] = await db.select().from(trips)
      .where(and(eq(trips.driverId, driverId), eq(trips.status, "active")));
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
    const activeTrips = await db.select().from(trips)
      .where(and(eq(trips.routeId, routeId), eq(trips.status, "active")));
    
    const locations: LiveLocation[] = [];
    for (const trip of activeTrips) {
      const loc = await this.getLatestLocationForTrip(trip.id);
      if (loc) locations.push(loc);
    }
    return locations;
  }
}

export const storage = new DatabaseStorage();
