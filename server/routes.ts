import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { setupWebSocket, getActiveLocations } from "./websocket";
import { insertUserSchema, insertBusSchema, insertRouteSchema, insertRouteStopSchema } from "@shared/schema";
import { z } from "zod";

const ROUTES_DATA = [
  {
    name: "keshwapur route",
    stops: [
      { name: "Shakti Colony", scheduledTime: "07:00", lat: 15.3647, lng: 75.1240 },
      { name: "Sub jail", scheduledTime: "07:05", lat: 15.3660, lng: 75.1260 },
      { name: "lions School.", scheduledTime: "07:10", lat: 15.3675, lng: 75.1280 },
      { name: "Venkatesh Colony", scheduledTime: "07:15", lat: 15.3690, lng: 75.1300 },
      { name: "Madhura Colony", scheduledTime: "07:20", lat: 15.3710, lng: 75.1320 },
      { name: "keshwapur circle", scheduledTime: "07:25", lat: 15.3730, lng: 75.1340 },
      { name: "GopanKoppa", scheduledTime: "07:30", lat: 15.3750, lng: 75.1360 },
      { name: "JK School", scheduledTime: "07:35", lat: 15.3770, lng: 75.1380 },
      { name: "Sainagar last stop", scheduledTime: "07:40", lat: 15.3790, lng: 75.1400 },
      { name: "jcet college", scheduledTime: "07:50", lat: 15.3820, lng: 75.1450 },
    ],
  },
  {
    name: "Pg route",
    stops: [
      { name: "tolankeri", scheduledTime: "07:00", lat: 15.3500, lng: 75.1100 },
      { name: "akshay colony petrol pump", scheduledTime: "07:05", lat: 15.3520, lng: 75.1130 },
      { name: "pg (focusmart )", scheduledTime: "07:10", lat: 15.3540, lng: 75.1160 },
      { name: "siddeshwar park", scheduledTime: "07:15", lat: 15.3560, lng: 75.1190 },
      { name: "lingaraj nagar", scheduledTime: "07:20", lat: 15.3580, lng: 75.1220 },
      { name: "adarsh college", scheduledTime: "07:25", lat: 15.3600, lng: 75.1250 },
      { name: "unkal lake", scheduledTime: "07:30", lat: 15.3620, lng: 75.1280 },
      { name: "president hotel", scheduledTime: "07:35", lat: 15.3650, lng: 75.1320 },
      { name: "sainagar last stop", scheduledTime: "07:40", lat: 15.3680, lng: 75.1360 },
      { name: "Jcet college", scheduledTime: "07:50", lat: 15.3820, lng: 75.1450 },
    ],
  },
  {
    name: "siddaroodh math route",
    stops: [
      { name: "nehru nagar tank", scheduledTime: "06:50", lat: 15.3400, lng: 75.1000 },
      { name: "manjunath nagar cross", scheduledTime: "06:55", lat: 15.3420, lng: 75.1030 },
      { name: "anand nagar", scheduledTime: "07:00", lat: 15.3440, lng: 75.1060 },
      { name: "siddaroodh math", scheduledTime: "07:05", lat: 15.3460, lng: 75.1090 },
      { name: "murdeshwar ceramics", scheduledTime: "07:10", lat: 15.3480, lng: 75.1120 },
      { name: "akshay park petrol bunk", scheduledTime: "07:15", lat: 15.3500, lng: 75.1150 },
      { name: "ravi nagar", scheduledTime: "07:20", lat: 15.3520, lng: 75.1180 },
      { name: "siddeshwar park", scheduledTime: "07:25", lat: 15.3540, lng: 75.1210 },
      { name: "lingaraj nagar", scheduledTime: "07:30", lat: 15.3560, lng: 75.1240 },
      { name: "adrash college", scheduledTime: "07:35", lat: 15.3580, lng: 75.1270 },
      { name: "unkal lake", scheduledTime: "07:40", lat: 15.3600, lng: 75.1300 },
      { name: "president hotel", scheduledTime: "07:45", lat: 15.3630, lng: 75.1340 },
      { name: "sai nagar last stop", scheduledTime: "07:50", lat: 15.3660, lng: 75.1380 },
      { name: "jcet college", scheduledTime: "08:00", lat: 15.3820, lng: 75.1450 },
    ],
  },
  {
    name: "Gadag route(BVB route)",
    stops: [
      { name: "head post office", scheduledTime: "06:45", lat: 15.3300, lng: 75.0900 },
      { name: "corporation", scheduledTime: "06:50", lat: 15.3320, lng: 75.0930 },
      { name: "old busstand", scheduledTime: "06:55", lat: 15.3340, lng: 75.0960 },
      { name: "canara hotel hosur circle", scheduledTime: "07:00", lat: 15.3360, lng: 75.0990 },
      { name: "KMC stop", scheduledTime: "07:05", lat: 15.3380, lng: 75.1020 },
      { name: "Gurudatta Bhavan", scheduledTime: "07:10", lat: 15.3400, lng: 75.1050 },
      { name: "Arts College", scheduledTime: "07:15", lat: 15.3420, lng: 75.1080 },
      { name: "BVB college", scheduledTime: "07:20", lat: 15.3450, lng: 75.1120 },
      { name: "unkal cross", scheduledTime: "07:25", lat: 15.3480, lng: 75.1160 },
      { name: "siddappa ajja temple old", scheduledTime: "07:30", lat: 15.3510, lng: 75.1200 },
      { name: "president hotel", scheduledTime: "07:35", lat: 15.3550, lng: 75.1250 },
      { name: "sai nagar last stop", scheduledTime: "07:40", lat: 15.3590, lng: 75.1300 },
      { name: "JCET college", scheduledTime: "07:50", lat: 15.3820, lng: 75.1450 },
    ],
  },
  {
    name: "Dharwad route",
    stops: [
      { name: "Srinagar Dharwad", scheduledTime: "06:30", lat: 15.4500, lng: 75.0100 },
      { name: "saptapur well", scheduledTime: "06:35", lat: 15.4450, lng: 75.0200 },
      { name: "Dasanakoppa circle", scheduledTime: "06:40", lat: 15.4400, lng: 75.0300 },
      { name: "Jubilee circle", scheduledTime: "06:45", lat: 15.4350, lng: 75.0400 },
      { name: "NTTF", scheduledTime: "06:50", lat: 15.4300, lng: 75.0500 },
      { name: "Toll Naka", scheduledTime: "06:55", lat: 15.4250, lng: 75.0600 },
      { name: "JSS College", scheduledTime: "07:00", lat: 15.4200, lng: 75.0700 },
      { name: "Gandhinagar", scheduledTime: "07:05", lat: 15.4150, lng: 75.0800 },
      { name: "SDM Dental College", scheduledTime: "07:10", lat: 15.4100, lng: 75.0900 },
      { name: "Rayapur RTO", scheduledTime: "07:15", lat: 15.4050, lng: 75.1000 },
      { name: "navnagar", scheduledTime: "07:20", lat: 15.4000, lng: 75.1100 },
      { name: "APMC", scheduledTime: "07:25", lat: 15.3950, lng: 75.1150 },
      { name: "Bairidevarakoppa", scheduledTime: "07:30", lat: 15.3900, lng: 75.1200 },
      { name: "President Hotel", scheduledTime: "07:35", lat: 15.3850, lng: 75.1300 },
      { name: "Sai Nagar bus stop", scheduledTime: "07:40", lat: 15.3800, lng: 75.1400 },
      { name: "JCET college", scheduledTime: "07:50", lat: 15.3820, lng: 75.1450 },
    ],
  },
  {
    name: "Navangar route",
    stops: [
      { name: "navnagar", scheduledTime: "07:10", lat: 15.4000, lng: 75.1100 },
      { name: "APMC", scheduledTime: "07:15", lat: 15.3950, lng: 75.1150 },
      { name: "Bairi devarakappa", scheduledTime: "07:20", lat: 15.3900, lng: 75.1200 },
      { name: "President Hotel", scheduledTime: "07:25", lat: 15.3850, lng: 75.1300 },
      { name: "Sai Nagar last stop", scheduledTime: "07:30", lat: 15.3800, lng: 75.1400 },
      { name: "JCET college", scheduledTime: "07:40", lat: 15.3820, lng: 75.1450 },
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
        const route = await storage.createRoute({ name: routeData.name, displayOrder: i + 1, isActive: true });
        for (let j = 0; j < routeData.stops.length; j++) {
          const stop = routeData.stops[j];
          await storage.createRouteStop({
            routeId: route.id,
            name: stop.name,
            lat: stop.lat,
            lng: stop.lng,
            scheduledTime: stop.scheduledTime,
            sequence: j + 1,
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

      const studentUser = await storage.createUser({ username: "2JI20CS001", password: "student123", role: "student", name: "Rahul Kumar" });
      const routes = await storage.getRoutes();
      if (routes.length > 0) {
        await storage.createStudent({ userId: studentUser.id, usn: "2JI20CS001", preferredRouteId: routes[0].id, preferredStop: "keshwapur circle" });
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

  return httpServer;
}
