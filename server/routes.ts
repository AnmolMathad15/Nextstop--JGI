import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { setupWebSocket, getActiveLocations } from "./websocket";
import { insertUserSchema, insertBusSchema, insertRouteSchema, insertRouteStopSchema, insertScheduleSchema } from "@shared/schema";
import { z } from "zod";

// ─── GPS coordinates for Hubballi-Dharwad stops ───────────────────────────────
// Coordinates match the custom Mapbox style marker positions (busStopsData.ts GeoJSON).
// JCET College anchor: 15.394147, 75.118946 (Unkal, Hubballi)
const ROUTES_DATA = [
  {
    name: "Keshwapur Route",
    color: "#f97316", // orange
    stops: [
      { name: "Shakti Colony (JK School)", scheduledTime: "07:30", time1015am: "09:30", lat: 15.3512,   lng: 75.1421,   isMainStop: true },
      { name: "Sub Jail",                  scheduledTime: "07:32", time1015am: "09:32", lat: 15.353,    lng: 75.141 },
      { name: "Lamington School",          scheduledTime: "07:35", time1015am: "09:35", lat: 15.355,    lng: 75.1395 },
      { name: "Venkatesh Colony",          scheduledTime: "07:38", time1015am: "09:38", lat: 15.358,    lng: 75.138 },
      { name: "Madura Colony",             scheduledTime: "07:40", time1015am: "09:40", lat: 15.361,    lng: 75.136 },
      { name: "Keshwapur Circle",          scheduledTime: "07:45", time1015am: "09:45", lat: 15.354,    lng: 75.1402,   isMainStop: true },
      { name: "Old Bus Stand",             scheduledTime: "07:47", time1015am: "09:47", lat: 15.356,    lng: 75.141,    isMainStop: true },
      { name: "Arts College",              scheduledTime: "07:55", time1015am: "09:55", lat: 15.36,     lng: 75.13,     isMainStop: true },
      { name: "BVB College",               scheduledTime: "08:00", time1015am: "10:00", lat: 15.368,    lng: 75.122,    isMainStop: true },
      { name: "Unkal Cross",               scheduledTime: "08:03", time1015am: "10:03", lat: 15.375,    lng: 75.115,    isMainStop: true },
      { name: "Sai Nagar",                 scheduledTime: "08:10", time1015am: "10:10", lat: 15.3885,   lng: 75.1215 },
      { name: "JCET College",              scheduledTime: "08:15", time1015am: "10:15", lat: 15.39,     lng: 75.1234,   isMainStop: true },
    ],
  },
  {
    name: "PG Route",
    color: "#22c55e", // green
    stops: [
      { name: "Tolankeri",                 scheduledTime: "07:50", time1015am: "09:50", lat: 15.359245, lng: 75.104803, isMainStop: true },
      { name: "Chetana PU College",        scheduledTime: "07:53", time1015am: "09:53", lat: 15.36028,  lng: 75.109503 },
      { name: "Siddeshwar Park",           scheduledTime: "07:55", time1015am: "09:55", lat: 15.361428, lng: 75.115336 },
      { name: "Lingaraj Nagar",            scheduledTime: "08:00", time1015am: "10:00", lat: 15.364896, lng: 75.113774 },
      { name: "Adarsh College",            scheduledTime: "08:05", time1015am: "10:05", lat: 15.372129, lng: 75.112753, isMainStop: true },
      { name: "Siddappa Ajja Temple Lake", scheduledTime: "08:08", time1015am: "10:08", lat: 15.385,    lng: 75.119 },
      { name: "President Hotel",           scheduledTime: "08:10", time1015am: "10:10", lat: 15.381945, lng: 75.113235, isMainStop: true },
      { name: "Sai Nagar",                 scheduledTime: "08:12", time1015am: "10:12", lat: 15.382508, lng: 75.1178 },
      { name: "JCET College",              scheduledTime: "08:15", time1015am: "10:15", lat: 15.394207, lng: 75.119984, isMainStop: true },
    ],
  },
  {
    name: "Siddharoodh Math Route",
    color: "#ef4444", // red
    stops: [
      { name: "Nehru Nagar Water Tank",    scheduledTime: "07:30", time1015am: "09:30", lat: 15.352331, lng: 75.097832, isMainStop: true },
      { name: "Manjunath Nagar",           scheduledTime: "07:32", time1015am: "09:32", lat: 15.351665, lng: 75.102208 },
      { name: "Anand Nagar",               scheduledTime: "07:35", time1015am: "09:35", lat: 15.341191, lng: 75.106884 },
      { name: "Siddharoodh Math",          scheduledTime: "07:40", time1015am: "09:40", lat: 15.335785, lng: 75.121338, isMainStop: true },
      { name: "Muradeshwar Ceramics",      scheduledTime: "07:43", time1015am: "09:43", lat: 15.341502, lng: 75.118267 },
      { name: "Akshay Park Petrol Bunk",   scheduledTime: "07:45", time1015am: "09:45", lat: 15.350946, lng: 75.109608 },
      { name: "Ravi Nagar",                scheduledTime: "07:47", time1015am: "09:47", lat: 15.358,    lng: 75.125 },
      { name: "Tolankeri",                 scheduledTime: "07:50", time1015am: "09:50", lat: 15.359245, lng: 75.104803, isMainStop: true },
      { name: "Chetana PU College",        scheduledTime: "07:53", time1015am: "09:53", lat: 15.36028,  lng: 75.109503 },
      { name: "Siddeshwar Park",           scheduledTime: "07:55", time1015am: "09:55", lat: 15.361428, lng: 75.115336 },
      { name: "Lingaraj Nagar",            scheduledTime: "08:00", time1015am: "10:00", lat: 15.364896, lng: 75.113774 },
      { name: "Adarsh College",            scheduledTime: "08:05", time1015am: "10:05", lat: 15.372129, lng: 75.112753, isMainStop: true },
      { name: "Siddappa Ajja Temple Lake", scheduledTime: "08:08", time1015am: "10:08", lat: 15.385,    lng: 75.119 },
      { name: "President Hotel",           scheduledTime: "08:10", time1015am: "10:10", lat: 15.381945, lng: 75.113235, isMainStop: true },
      { name: "Sai Nagar",                 scheduledTime: "08:12", time1015am: "10:12", lat: 15.382508, lng: 75.1178 },
      { name: "JCET College",              scheduledTime: "08:15", time1015am: "10:15", lat: 15.394207, lng: 75.119984, isMainStop: true },
    ],
  },
  {
    name: "Gadag Road Route",
    color: "#8b5cf6", // purple
    stops: [
      { name: "Head Post Office",           scheduledTime: "07:45", time1015am: "09:45", lat: 15.352,    lng: 75.145,    isMainStop: true },
      { name: "Corporation",                scheduledTime: "07:47", time1015am: "09:47", lat: 15.354,    lng: 75.143 },
      { name: "Old Bus Stand",              scheduledTime: "07:50", time1015am: "09:50", lat: 15.356,    lng: 75.141,    isMainStop: true },
      { name: "Canara Hotel Hosur Circle",  scheduledTime: "07:52", time1015am: "09:52", lat: 15.358,    lng: 75.138 },
      { name: "KMC Stop",                   scheduledTime: "07:54", time1015am: "09:54", lat: 15.36,     lng: 75.135 },
      { name: "Gurudatta Bhavan",           scheduledTime: "07:55", time1015am: "09:55", lat: 15.362,    lng: 75.132 },
      { name: "Arts College",               scheduledTime: "07:57", time1015am: "09:57", lat: 15.364,    lng: 75.13,     isMainStop: true },
      { name: "BVB College",                scheduledTime: "08:00", time1015am: "10:00", lat: 15.368,    lng: 75.122,    isMainStop: true },
      { name: "Unkal Cross",                scheduledTime: "08:05", time1015am: "10:05", lat: 15.375,    lng: 75.115,    isMainStop: true },
      { name: "Siddappa Ajja Temple (old)", scheduledTime: "08:08", time1015am: "10:08", lat: 15.385,    lng: 75.119 },
      { name: "Sai Nagar",                  scheduledTime: "08:10", time1015am: "10:10", lat: 15.3885,   lng: 75.1215 },
      { name: "JCET College",               scheduledTime: "08:15", time1015am: "10:15", lat: 15.39,     lng: 75.1234,   isMainStop: true },
    ],
  },
  {
    name: "Dharwad Route",
    color: "#1e40af", // dark blue
    stops: [
      { name: "Sarvamangala Cross, Dharwad", scheduledTime: "07:20", time1015am: "09:20", lat: 15.46,      lng: 75.0,       isMainStop: true },
      { name: "Saptapur Bavi",               scheduledTime: "07:24", time1015am: "09:24", lat: 15.458,     lng: 75.005 },
      { name: "Dasankoppa Circle",            scheduledTime: "07:30", time1015am: "09:30", lat: 15.455,     lng: 75.01 },
      { name: "Jubilee Circle",               scheduledTime: "07:35", time1015am: "09:35", lat: 15.45,      lng: 75.015 },
      { name: "Court Circle",                 scheduledTime: "07:37", time1015am: "09:37", lat: 15.448,     lng: 75.018 },
      { name: "NTTF",                         scheduledTime: "07:40", time1015am: "09:40", lat: 15.445,     lng: 75.02 },
      { name: "Toll Naka",                    scheduledTime: "07:42", time1015am: "09:42", lat: 15.44,      lng: 75.025 },
      { name: "JSS College",                  scheduledTime: "07:45", time1015am: "09:45", lat: 15.435,     lng: 75.03,      isMainStop: true },
      { name: "Gandhi Nagar",                 scheduledTime: "07:47", time1015am: "09:47", lat: 15.43,      lng: 75.035 },
      { name: "SDM Dental College",           scheduledTime: "07:52", time1015am: "09:52", lat: 15.42,      lng: 75.045,     isMainStop: true },
      { name: "Rayapur RTO",                  scheduledTime: "07:57", time1015am: "09:57", lat: 15.41,      lng: 75.055 },
      { name: "Navanagar",                    scheduledTime: "08:00", time1015am: "10:00", lat: 15.3957011, lng: 75.0848824, isMainStop: true },
      { name: "APMC",                         scheduledTime: "08:05", time1015am: "10:05", lat: 15.393449,  lng: 75.093449 },
      { name: "Bhiridevarakoppa",             scheduledTime: "08:07", time1015am: "10:07", lat: 15.3867454, lng: 75.1061771 },
      { name: "President Hotel",              scheduledTime: "08:09", time1015am: "10:09", lat: 15.3819925, lng: 75.1133745, isMainStop: true },
      { name: "Sai Nagar",                    scheduledTime: "08:11", time1015am: "10:11", lat: 15.382647,  lng: 75.1178 },
      { name: "JCET College",                 scheduledTime: "08:15", time1015am: "10:15", lat: 15.3941731, lng: 75.1199687, isMainStop: true },
    ],
  },
  {
    name: "Navanagar Route",
    color: "#06b6d4", // cyan / neon-blue
    stops: [
      { name: "Navanagar",        scheduledTime: "08:00", time1015am: "10:00", lat: 15.3957011, lng: 75.0848824, isMainStop: true },
      { name: "APMC",             scheduledTime: "08:05", time1015am: "10:05", lat: 15.393449,  lng: 75.093449 },
      { name: "Bhiridevarakoppa", scheduledTime: "08:07", time1015am: "10:07", lat: 15.3867454, lng: 75.1061771 },
      { name: "President Hotel",  scheduledTime: "08:09", time1015am: "10:09", lat: 15.3819925, lng: 75.1133745, isMainStop: true },
      { name: "Sai Nagar",        scheduledTime: "08:11", time1015am: "10:11", lat: 15.382647,  lng: 75.1178 },
      { name: "JCET College",     scheduledTime: "08:15", time1015am: "10:15", lat: 15.3941731, lng: 75.1199687, isMainStop: true },
    ],
  },
];

const INITIAL_BUSES = [
  { number: "KA-25-A-1234" },
  { number: "KA-25-B-5678" },
  { number: "KA-25-C-9012" },
  { number: "KA-25-D-3456" },
  { number: "KA-25-E-7890" },
  { number: "KA-25-F-2345" },
];

async function seedDatabase() {
  try {
    const existingRoutes = await storage.getRoutes();
    if (existingRoutes.length === 0) {
      console.log("Seeding routes and stops...");
      for (let i = 0; i < ROUTES_DATA.length; i++) {
        const routeData = ROUTES_DATA[i];
        const route = await storage.createRoute({ name: routeData.name, displayOrder: i + 1, isActive: true, color: routeData.color });
        for (let j = 0; j < routeData.stops.length; j++) {
          const stop = routeData.stops[j];
          await storage.createRouteStop({
            routeId: route.id,
            name: stop.name,
            lat: stop.lat,
            lng: stop.lng,
            scheduledTime: stop.scheduledTime,
            time1015am: stop.time1015am ?? null,
            sequence: j + 1,
            isMainStop: stop.isMainStop ?? false,
          });
        }
      }
      console.log("Routes seeded successfully!");
    }

    const existingBuses = await storage.getBuses();
    if (existingBuses.length === 0) {
      console.log("Seeding buses...");
      for (const bus of INITIAL_BUSES) {
        await storage.createBus({ number: bus.number, capacity: 40, isActive: true });
      }
      console.log("Buses seeded successfully!");
    }

    // Ensure each demo account independently. A partially seeded database
    // should not make the driver or student account disappear just because
    // the admin account already existed.
    const existingAdmin = await storage.getUserByUsername("admin");
    const adminUser = existingAdmin ?? await storage.createUser({
      username: "admin", password: "admin123", role: "admin", name: "Admin User",
    });

    const existingDriverUser = await storage.getUserByUsername("driver1");
    const driverUser = existingDriverUser ?? await storage.createUser({
      username: "driver1", password: "driver123", role: "driver",
      name: "Ravi Patil", phone: "+91 9876543210",
    });
    const buses = await storage.getBuses();
    const existingDriver = await storage.getDriverByUserId(driverUser.id);
    if (!existingDriver && buses.length > 0) {
      await storage.createDriver({
        userId: driverUser.id,
        licenseNumber: "KA25-DL-12345",
        assignedBusId: buses[0].id,
      });
    }

    const existingStudentUser = await storage.getUserByUsername("2JH23CS001");
    const studentUser = existingStudentUser ?? await storage.createUser({
      username: "2JH23CS001", password: "student123", role: "student",
      name: "Rahul Kumar",
    });
    const routes = await storage.getRoutes();
    const existingStudent = await storage.getStudentByUserId(studentUser.id);
    if (!existingStudent && routes.length > 0) {
      await storage.createStudent({
        userId: studentUser.id,
        usn: "2JH23CS001",
        preferredRouteId: routes[0].id,
        preferredStop: "keshwapur circle",
      });
    }
    if (!existingAdmin || !existingDriverUser || !existingStudentUser) {
      console.log("Demo users verified.");
    }
    // Seed schedules (runs even if routes already existed)
    const existingSchedules = await storage.getSchedules();
    if (existingSchedules.length === 0) {
      const allRoutes = await storage.getRoutes();
      for (const route of allRoutes) {
        const stops = await storage.getRouteStops(route.id);
        if (stops.length === 0) continue;
        const morningTime = stops[0].scheduledTime;
        const lateTime    = stops[0].time1015am;
        await storage.createSchedule({ routeId: route.id, label: "Morning Batch",    departureTime: morningTime,    daysOfWeek: "mon-sat", isActive: true });
        if (lateTime) {
          await storage.createSchedule({ routeId: route.id, label: "10:15 AM Batch", departureTime: lateTime,       daysOfWeek: "mon-sat", isActive: true });
        }
      }
      console.log("Schedules seeded!");
    }
  } catch (error) {
    console.error("Seeding error:", error);
  }
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  setupWebSocket(httpServer);
  await seedDatabase();

  app.post("/api/auth/login", async (req, res) => {
    try {
      const username = typeof req.body.username === "string"
        ? req.body.username.trim()
        : "";
      const { password, role } = req.body;
      
      const user = await storage.getUserByUsername(username);
      if (!user || user.password !== password) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      
      if (user.role !== role) {
        return res.status(403).json({ error: `This account is not registered as ${role}` });
      }

      let additionalInfo: any = {};
      if (role === "driver") {
        const driver = await storage.getDriverByUserId(user.id);
        if (driver) {
          additionalInfo.driverId = driver.id;
          additionalInfo.assignedBusId = driver.assignedBusId;
        }
      } else if (role === "student") {
        const student = await storage.getStudentByUserId(user.id);
        if (student) {
          additionalInfo.studentId = student.id;
          additionalInfo.preferredRouteId = student.preferredRouteId;
          additionalInfo.preferredStop = student.preferredStop;
        }
      }

      res.json({
        user: { id: user.id, username: user.username, role: user.role, name: user.name },
        ...additionalInfo,
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ error: "Login failed" });
    }
  });

  app.get("/api/routes", async (_req, res) => {
    try {
      const routes = await storage.getRoutes();
      res.json(routes);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch routes" });
    }
  });

  app.get("/api/routes/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const route = await storage.getRoute(id);
      if (!route) {
        return res.status(404).json({ error: "Route not found" });
      }
      const stops = await storage.getRouteStops(id);
      res.json({ ...route, stops });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch route" });
    }
  });

  app.get("/api/buses", async (_req, res) => {
    try {
      const buses = await storage.getBuses();
      res.json(buses);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch buses" });
    }
  });

  app.post("/api/buses", async (req, res) => {
    try {
      const data = insertBusSchema.parse(req.body);
      const bus = await storage.createBus(data);
      res.json(bus);
    } catch (error) {
      res.status(400).json({ error: "Invalid bus data" });
    }
  });

  app.get("/api/drivers", async (_req, res) => {
    try {
      const drivers = await storage.getDrivers();
      res.json(drivers);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch drivers" });
    }
  });

  app.get("/api/students", async (_req, res) => {
    try {
      const students = await storage.getStudents();
      res.json(students);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch students" });
    }
  });

  app.get("/api/trips/active", async (_req, res) => {
    try {
      const trips = await storage.getActiveTrips();
      res.json(trips);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch active trips" });
    }
  });

  app.get("/api/tracking/live", async (_req, res) => {
    try {
      const locations = getActiveLocations();
      res.json(locations);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch live locations" });
    }
  });

  app.get("/api/tracking/routes/:routeId/live", async (req, res) => {
    try {
      const routeId = parseInt(req.params.routeId);
      const locations = getActiveLocations().filter(loc => loc.routeId === routeId);
      res.json(locations);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch route locations" });
    }
  });

  // Fleet alerts
  app.get("/api/alerts", async (req, res) => {
    try {
      const status = req.query.status as string | undefined;
      const alerts = await storage.getFleetAlerts(status);
      res.json(alerts);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch alerts" });
    }
  });

  app.patch("/api/alerts/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { status, adminNotes } = req.body;
      if (!status) return res.status(400).json({ error: "status is required" });
      const updated = await storage.updateFleetAlertStatus(id, status, adminNotes);
      if (!updated) return res.status(404).json({ error: "Alert not found" });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update alert" });
    }
  });

  // ── Polling endpoint (Vercel / serverless fallback) ──────────────────────────
  // Students on Vercel Hobby poll this every 3 s when WS is unavailable.
  // Returns the latest location for every active trip from the DB.
  app.get("/api/tracking/poll", async (_req, res) => {
    try {
      const trips     = await storage.getActiveTrips();
      const locations = (
        await Promise.all(trips.map(t => storage.getLatestLocationForTrip(t.id)))
      ).filter(Boolean);
      res.json(locations);
    } catch (error) {
      res.status(500).json({ error: "Failed to poll locations" });
    }
  });

  // ── REST driver actions (Vercel serverless replaces WebSocket messages) ───────

  /**
   * POST /api/driver/location
   * Driver sends GPS location via REST (Vercel polling mode).
   * Validates the fix, stores it in live_locations, and returns the
   * (possibly smoothed) speed.  WebSocket broadcast is deliberately
   * skipped here — students pick up the update on their next poll to
   * GET /api/tracking/poll.
   */
  app.post("/api/driver/location", async (req, res) => {
    try {
      const { tripId, routeId, busId, lat, lng, speed, heading, accuracy } = req.body;
      if (!tripId || !routeId || !busId || lat == null || lng == null) {
        return res.status(400).json({ error: "tripId, routeId, busId, lat, lng are required" });
      }

      const { validateLocation, recordGPSPoint, getSmoothedSpeed } =
        await import("./locationService");

      // Basic validation (heading/accuracy/speed bounds)
      const raw = {
        tripId, routeId, busId: String(busId), driverId: "",
        lat, lng, speed: speed ?? 0, heading: heading ?? 0,
        accuracy: accuracy ?? 5, timestamp: Date.now(),
        provider: "mobile_gps" as const,
      };
      const validated = validateLocation(raw);
      if (!validated.isValid) {
        return res.status(422).json({ error: validated.validationError });
      }

      // Feed the GPS buffer so smoothed speed is accurate
      recordGPSPoint(tripId, { lat, lng, speed: speed ?? 0, heading: heading ?? 0, timestamp: Date.now() });
      const smoothedSpeed = getSmoothedSpeed(tripId);

      await storage.appendLiveLocation({ tripId, lat, lng, speed: smoothedSpeed, heading, accuracy });

      res.json({ ok: true, speed: smoothedSpeed });
    } catch (error) {
      console.error("REST location error:", error);
      res.status(500).json({ error: "Failed to process location" });
    }
  });

  /** POST /api/driver/trip/start — REST equivalent of trip:start WS message */
  app.post("/api/driver/trip/start", async (req, res) => {
    try {
      const { driverId, busId, routeId } = req.body;
      if (!driverId || !busId || !routeId) {
        return res.status(400).json({ error: "driverId, busId, routeId are required" });
      }
      const existing = await storage.getActiveTripByDriver(driverId);
      if (existing) await storage.endTrip(existing.id);
      const trip = await storage.createTrip({ driverId, busId, routeId });
      res.json({ tripId: trip.id });
    } catch (error) {
      res.status(500).json({ error: "Failed to start trip" });
    }
  });

  /** POST /api/driver/trip/end */
  app.post("/api/driver/trip/end", async (req, res) => {
    try {
      const { tripId } = req.body;
      if (!tripId) return res.status(400).json({ error: "tripId is required" });
      const trip = await storage.endTrip(tripId);
      res.json({ ok: !!trip });
    } catch (error) {
      res.status(500).json({ error: "Failed to end trip" });
    }
  });

  /** POST /api/driver/trip/pause */
  app.post("/api/driver/trip/pause", async (req, res) => {
    try {
      const { tripId } = req.body;
      if (!tripId) return res.status(400).json({ error: "tripId is required" });
      await storage.pauseTrip(tripId);
      res.json({ ok: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to pause trip" });
    }
  });

  /** POST /api/driver/trip/resume */
  app.post("/api/driver/trip/resume", async (req, res) => {
    try {
      const { tripId } = req.body;
      if (!tripId) return res.status(400).json({ error: "tripId is required" });
      await storage.resumeTrip(tripId);
      res.json({ ok: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to resume trip" });
    }
  });

  // ── Notifications history ────────────────────────────────────────────────────

  app.get("/api/notifications", async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
      const notifs = await storage.getNotifications(limit);
      res.json(notifs);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch notifications" });
    }
  });

  // ── Analytics ────────────────────────────────────────────────────────────────

  /**
   * GET /api/analytics/delayed-stops
   * Returns the top 10 stops with the highest average delay (minutes late).
   */
  app.get("/api/analytics/delayed-stops", async (_req, res) => {
    try {
      const data = await storage.getAnalyticsMostDelayedStops();
      res.json(data);
    } catch (error) {
      console.error("Analytics delayed-stops error:", error);
      res.status(500).json({ error: "Failed to fetch delayed stops analytics" });
    }
  });

  /**
   * GET /api/analytics/trip-duration
   * Average trip duration across all completed trips.
   */
  app.get("/api/analytics/trip-duration", async (_req, res) => {
    try {
      const data = await storage.getAnalyticsAvgTripDuration();
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch trip duration analytics" });
    }
  });

  /**
   * GET /api/analytics/driver-punctuality
   * Per-driver overspeed count + performance score.
   */
  app.get("/api/analytics/driver-punctuality", async (_req, res) => {
    try {
      const data = await storage.getAnalyticsDriverPunctuality();
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch driver punctuality analytics" });
    }
  });

  /**
   * GET /api/analytics/avg-speed
   * Fleet-wide average speed derived from live_locations.
   */
  app.get("/api/analytics/avg-speed", async (_req, res) => {
    try {
      const data = await storage.getAnalyticsAvgSpeed();
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch avg speed analytics" });
    }
  });

  /**
   * GET /api/analytics/notification-stats
   * Total notifications sent + breakdown by type.
   */
  app.get("/api/analytics/notification-stats", async (_req, res) => {
    try {
      const data = await storage.getAnalyticsNotificationStats();
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch notification stats" });
    }
  });

  /**
   * GET /api/analytics/summary
   * All analytics combined in one response for dashboards.
   */
  app.get("/api/analytics/summary", async (_req, res) => {
    try {
      const [delayedStops, tripDuration, driverPunctuality, avgSpeed, notifStats] = await Promise.all([
        storage.getAnalyticsMostDelayedStops(),
        storage.getAnalyticsAvgTripDuration(),
        storage.getAnalyticsDriverPunctuality(),
        storage.getAnalyticsAvgSpeed(),
        storage.getAnalyticsNotificationStats(),
      ]);
      res.json({ delayedStops, tripDuration, driverPunctuality, avgSpeed, notifStats });
    } catch (error) {
      console.error("Analytics summary error:", error);
      res.status(500).json({ error: "Failed to fetch analytics summary" });
    }
  });

  // ── Route management (admin) ────────────────────────────────────────────────

  app.patch("/api/routes/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updated = await storage.updateRoute(id, req.body);
      if (!updated) return res.status(404).json({ error: "Route not found" });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update route" });
    }
  });

  app.post("/api/route-stops", async (req, res) => {
    try {
      const stop = insertRouteStopSchema.parse(req.body);
      const created = await storage.createRouteStop(stop);
      res.status(201).json(created);
    } catch (error) {
      res.status(400).json({ error: "Invalid stop data" });
    }
  });

  app.delete("/api/route-stops/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteRouteStop(id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete stop" });
    }
  });

  // ── Schedules ─────────────────────────────────────────────────────────────

  app.get("/api/schedules", async (req, res) => {
    try {
      const routeId = req.query.routeId ? parseInt(req.query.routeId as string) : undefined;
      const data = await storage.getSchedules(routeId);
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch schedules" });
    }
  });

  app.post("/api/schedules", async (req, res) => {
    try {
      const s = insertScheduleSchema.parse(req.body);
      const created = await storage.createSchedule(s);
      res.status(201).json(created);
    } catch (error) {
      res.status(400).json({ error: "Invalid schedule data" });
    }
  });

  app.patch("/api/schedules/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updated = await storage.updateSchedule(id, req.body);
      if (!updated) return res.status(404).json({ error: "Schedule not found" });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update schedule" });
    }
  });

  app.delete("/api/schedules/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteSchedule(id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete schedule" });
    }
  });

  // ── Push notifications ─────────────────────────────────────────────────────

  app.get("/api/push/vapid-key", (_req, res) => {
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    if (!publicKey) return res.status(503).json({ error: "Push not configured" });
    res.json({ publicKey });
  });

  app.post("/api/push/subscribe", async (req, res) => {
    try {
      const { userId, subscription } = req.body as {
        userId: string;
        subscription: { endpoint: string; keys: { p256dh: string; auth: string } };
      };
      if (!userId || !subscription?.endpoint) {
        return res.status(400).json({ error: "userId and subscription required" });
      }
      const saved = await storage.createPushSubscription({
        userId,
        endpoint: subscription.endpoint,
        p256dh:   subscription.keys.p256dh,
        auth:     subscription.keys.auth,
      });
      res.status(201).json({ id: saved.id });
    } catch (error) {
      res.status(500).json({ error: "Failed to save subscription" });
    }
  });

  app.delete("/api/push/subscribe", async (req, res) => {
    try {
      const { endpoint } = req.body as { endpoint: string };
      if (!endpoint) return res.status(400).json({ error: "endpoint required" });
      await storage.deletePushSubscription(endpoint);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to remove subscription" });
    }
  });

  return httpServer;
}
