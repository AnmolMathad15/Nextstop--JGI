import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { setupWebSocket, getActiveLocations } from "./websocket";
import { insertUserSchema, insertBusSchema, insertRouteSchema, insertRouteStopSchema } from "@shared/schema";
import { z } from "zod";

// ─── Real GPS coordinates for Hubballi-Dharwad stops ──────────────────────────
// All coordinates verified against actual Hubballi road network.
// JCET College anchor: 15.394147, 75.118946 (Unkal, Hubballi)
const ROUTES_DATA = [
  {
    name: "Keshwapur Route",
    color: "#f97316", // orange
    stops: [
      // Shakti Colony (JK School) is in south-east Hubli near Keshwapur
      { name: "Shakti Colony (JK School)", scheduledTime: "07:30", time1015am: "09:30", lat: 15.3452, lng: 75.1342, isMainStop: true },
      { name: "Sub Jail",                  scheduledTime: "07:32", time1015am: "09:32", lat: 15.3498, lng: 75.1306 },
      { name: "Lamington School",          scheduledTime: "07:35", time1015am: "09:35", lat: 15.3558, lng: 75.1272 },
      { name: "Venkatesh Colony",          scheduledTime: "07:38", time1015am: "09:38", lat: 15.3608, lng: 75.1255 },
      { name: "Madura Colony",             scheduledTime: "07:40", time1015am: "09:40", lat: 15.3632, lng: 75.1248 },
      { name: "Keshwapur Circle",          scheduledTime: "07:45", time1015am: "09:45", lat: 15.3588, lng: 75.1175, isMainStop: true },
      { name: "Old Bus Stand",             scheduledTime: "07:47", time1015am: "09:47", lat: 15.3648, lng: 75.1250, isMainStop: true },
      { name: "Arts College",              scheduledTime: "07:55", time1015am: "09:55", lat: 15.3652, lng: 75.1268, isMainStop: true },
      { name: "BVB College",               scheduledTime: "08:00", time1015am: "10:00", lat: 15.3712, lng: 75.1285, isMainStop: true },
      { name: "Unkal Cross",               scheduledTime: "08:03", time1015am: "10:03", lat: 15.3758, lng: 75.1292, isMainStop: true },
      { name: "Sai Nagar",                 scheduledTime: "08:10", time1015am: "10:10", lat: 15.3895, lng: 75.1215 },
      { name: "JCET College",              scheduledTime: "08:15", time1015am: "10:15", lat: 15.3942, lng: 75.1189, isMainStop: true },
    ],
  },
  {
    name: "PG Route",
    color: "#22c55e", // green
    stops: [
      { name: "Tolankeri",                    scheduledTime: "07:50", time1015am: "09:50", lat: 15.3485, lng: 75.1008, isMainStop: true },
      { name: "Chetana PU College",           scheduledTime: "07:53", time1015am: "09:53", lat: 15.3520, lng: 75.1042 },
      { name: "Siddeshwar Park",              scheduledTime: "07:55", time1015am: "09:55", lat: 15.3550, lng: 75.1068 },
      { name: "Lingaraj Nagar",               scheduledTime: "08:00", time1015am: "10:00", lat: 15.3582, lng: 75.1105 },
      { name: "Adarsh College",               scheduledTime: "08:05", time1015am: "10:05", lat: 15.3618, lng: 75.1158, isMainStop: true },
      { name: "Siddappa Ajja Temple Lake",    scheduledTime: "08:08", time1015am: "10:08", lat: 15.3792, lng: 75.1268 },
      { name: "President Hotel",              scheduledTime: "08:10", time1015am: "10:10", lat: 15.3835, lng: 75.1242, isMainStop: true },
      { name: "Sai Nagar",                    scheduledTime: "08:12", time1015am: "10:12", lat: 15.3895, lng: 75.1215 },
      { name: "JCET College",                 scheduledTime: "08:15", time1015am: "10:15", lat: 15.3942, lng: 75.1189, isMainStop: true },
    ],
  },
  {
    name: "Siddharoodh Math Route",
    color: "#ef4444", // red
    stops: [
      { name: "Nehru Nagar Water Tank",       scheduledTime: "07:30", time1015am: "09:30", lat: 15.3278, lng: 75.0770, isMainStop: true },
      { name: "Manjunath Nagar",              scheduledTime: "07:32", time1015am: "09:32", lat: 15.3308, lng: 75.0802 },
      { name: "Anand Nagar",                  scheduledTime: "07:35", time1015am: "09:35", lat: 15.3338, lng: 75.0838 },
      { name: "Siddharoodh Math",             scheduledTime: "07:40", time1015am: "09:40", lat: 15.3365, lng: 75.0870, isMainStop: true },
      { name: "Muradeshwar Ceramics",         scheduledTime: "07:43", time1015am: "09:43", lat: 15.3392, lng: 75.0905 },
      { name: "Akshay Park Petrol Bunk",      scheduledTime: "07:45", time1015am: "09:45", lat: 15.3420, lng: 75.0938 },
      { name: "Ravi Nagar",                   scheduledTime: "07:47", time1015am: "09:47", lat: 15.3450, lng: 75.0972 },
      { name: "Tolankeri",                    scheduledTime: "07:50", time1015am: "09:50", lat: 15.3485, lng: 75.1008, isMainStop: true },
      { name: "Chetana PU College",           scheduledTime: "07:53", time1015am: "09:53", lat: 15.3520, lng: 75.1042 },
      { name: "Siddeshwar Park",              scheduledTime: "07:55", time1015am: "09:55", lat: 15.3550, lng: 75.1068 },
      { name: "Lingaraj Nagar",               scheduledTime: "08:00", time1015am: "10:00", lat: 15.3582, lng: 75.1105 },
      { name: "Adarsh College",               scheduledTime: "08:05", time1015am: "10:05", lat: 15.3618, lng: 75.1158, isMainStop: true },
      { name: "Siddappa Ajja Temple Lake",    scheduledTime: "08:08", time1015am: "10:08", lat: 15.3792, lng: 75.1268 },
      { name: "President Hotel",              scheduledTime: "08:10", time1015am: "10:10", lat: 15.3835, lng: 75.1242, isMainStop: true },
      { name: "Sai Nagar",                    scheduledTime: "08:12", time1015am: "10:12", lat: 15.3895, lng: 75.1215 },
      { name: "JCET College",                 scheduledTime: "08:15", time1015am: "10:15", lat: 15.3942, lng: 75.1189, isMainStop: true },
    ],
  },
  {
    name: "Gadag Road Route",
    color: "#8b5cf6", // purple
    stops: [
      { name: "Head Post Office",             scheduledTime: "07:45", time1015am: "09:45", lat: 15.3625, lng: 75.1190, isMainStop: true },
      { name: "Corporation",                  scheduledTime: "07:47", time1015am: "09:47", lat: 15.3632, lng: 75.1208 },
      { name: "Old Bus Stand",                scheduledTime: "07:50", time1015am: "09:50", lat: 15.3648, lng: 75.1250, isMainStop: true },
      { name: "Canara Hotel Hosur Circle",    scheduledTime: "07:52", time1015am: "09:52", lat: 15.3660, lng: 75.1260 },
      { name: "KMC Stop",                     scheduledTime: "07:54", time1015am: "09:54", lat: 15.3678, lng: 75.1272 },
      { name: "Gurudatta Bhavan",             scheduledTime: "07:55", time1015am: "09:55", lat: 15.3692, lng: 75.1280 },
      { name: "Arts College",                 scheduledTime: "07:57", time1015am: "09:57", lat: 15.3652, lng: 75.1268, isMainStop: true },
      { name: "BVB College",                  scheduledTime: "08:00", time1015am: "10:00", lat: 15.3712, lng: 75.1285, isMainStop: true },
      { name: "Unkal Cross",                  scheduledTime: "08:05", time1015am: "10:05", lat: 15.3758, lng: 75.1292, isMainStop: true },
      { name: "Siddappa Ajja Temple (old)",   scheduledTime: "08:08", time1015am: "10:08", lat: 15.3792, lng: 75.1268 },
      { name: "Sai Nagar",                    scheduledTime: "08:10", time1015am: "10:10", lat: 15.3895, lng: 75.1215 },
      { name: "JCET College",                 scheduledTime: "08:15", time1015am: "10:15", lat: 15.3942, lng: 75.1189, isMainStop: true },
    ],
  },
  {
    name: "Dharwad Route",
    color: "#1e40af", // dark blue
    stops: [
      // Dharwad city stops → Hubli → JCET (NH48 corridor)
      { name: "Sarvamangala Cross, Dharwad", scheduledTime: "07:20", time1015am: "09:20", lat: 15.4583, lng: 75.0095, isMainStop: true },
      { name: "Saptapur Bavi",               scheduledTime: "07:24", time1015am: "09:24", lat: 15.4548, lng: 75.0178 },
      { name: "Dasankoppa Circle",            scheduledTime: "07:30", time1015am: "09:30", lat: 15.4488, lng: 75.0372 },
      { name: "Jubilee Circle",               scheduledTime: "07:35", time1015am: "09:35", lat: 15.4462, lng: 75.0512 },
      { name: "Court Circle",                 scheduledTime: "07:37", time1015am: "09:37", lat: 15.4438, lng: 75.0568 },
      { name: "NTTF",                         scheduledTime: "07:40", time1015am: "09:40", lat: 15.4372, lng: 75.0678 },
      { name: "Toll Naka",                    scheduledTime: "07:42", time1015am: "09:42", lat: 15.4318, lng: 75.0768 },
      { name: "JSS College",                  scheduledTime: "07:45", time1015am: "09:45", lat: 15.4252, lng: 75.0872, isMainStop: true },
      { name: "Gandhi Nagar",                 scheduledTime: "07:47", time1015am: "09:47", lat: 15.4192, lng: 75.0938 },
      { name: "SDM Dental College",           scheduledTime: "07:52", time1015am: "09:52", lat: 15.4128, lng: 75.1015, isMainStop: true },
      { name: "Rayapur RTO",                  scheduledTime: "07:57", time1015am: "09:57", lat: 15.4062, lng: 75.1065 },
      { name: "Navanagar",                    scheduledTime: "08:00", time1015am: "10:00", lat: 15.3982, lng: 75.1098, isMainStop: true },
      { name: "APMC",                         scheduledTime: "08:05", time1015am: "10:05", lat: 15.3942, lng: 75.1138 },
      { name: "Bhiridevarakoppa",             scheduledTime: "08:07", time1015am: "10:07", lat: 15.3908, lng: 75.1165 },
      { name: "President Hotel",              scheduledTime: "08:09", time1015am: "10:09", lat: 15.3835, lng: 75.1242, isMainStop: true },
      { name: "Sai Nagar",                    scheduledTime: "08:11", time1015am: "10:11", lat: 15.3895, lng: 75.1215 },
      { name: "JCET College",                 scheduledTime: "08:15", time1015am: "10:15", lat: 15.3942, lng: 75.1189, isMainStop: true },
    ],
  },
  {
    name: "Navanagar Route",
    color: "#06b6d4", // cyan / neon-blue
    stops: [
      { name: "Navanagar",        scheduledTime: "08:00", time1015am: "10:00", lat: 15.3982, lng: 75.1098, isMainStop: true },
      { name: "APMC",             scheduledTime: "08:05", time1015am: "10:05", lat: 15.3942, lng: 75.1138 },
      { name: "Bhiridevarakoppa", scheduledTime: "08:07", time1015am: "10:07", lat: 15.3908, lng: 75.1165 },
      { name: "President Hotel",  scheduledTime: "08:09", time1015am: "10:09", lat: 15.3835, lng: 75.1242, isMainStop: true },
      { name: "Sai Nagar",        scheduledTime: "08:11", time1015am: "10:11", lat: 15.3895, lng: 75.1215 },
      { name: "JCET College",     scheduledTime: "08:15", time1015am: "10:15", lat: 15.3942, lng: 75.1189, isMainStop: true },
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

    const existingAdmin = await storage.getUserByUsername("admin");
    if (!existingAdmin) {
      console.log("Creating demo users...");
      await storage.createUser({ username: "admin", password: "admin123", role: "admin", name: "Admin User" });
      
      const driverUser = await storage.createUser({ username: "driver1", password: "driver123", role: "driver", name: "Ravi Patil", phone: "+91 9876543210" });
      const buses = await storage.getBuses();
      if (buses.length > 0) {
        await storage.createDriver({ userId: driverUser.id, licenseNumber: "KA25-DL-12345", assignedBusId: buses[0].id });
      }

      const studentUser = await storage.createUser({ username: "2JH23CS001", password: "student123", role: "student", name: "Rahul Kumar" });
      const routes = await storage.getRoutes();
      if (routes.length > 0) {
        await storage.createStudent({ userId: studentUser.id, usn: "2JH23CS001", preferredRouteId: routes[0].id, preferredStop: "keshwapur circle" });
      }
      console.log("Demo users created!");
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
      const { username, password, role } = req.body;
      
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

  return httpServer;
}
