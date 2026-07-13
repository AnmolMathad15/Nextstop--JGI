/**
 * server/app.ts — Express application factory
 *
 * Exports `createApp()` which builds and configures the Express app.
 * This module is imported by:
 *   • server/index.ts  — Replit / Railway / Render (starts an HTTP server)
 *   • api/index.ts     — Vercel serverless function handler
 *
 * WebSocket setup is attempted in both cases; on Vercel serverless the WS
 * server attaches to an un-bound HTTP server (connections come through the
 * Vercel infrastructure on Pro plans, or are handled via REST polling on
 * the Hobby plan — see /api/tracking/poll).
 */

import express, { type Request, type Response, type NextFunction } from "express";
import { createServer } from "http";
import { registerRoutes } from "./routes";

export async function createApp() {
  const app = express();
  const httpServer = createServer(app);

  // ── Body parsing ───────────────────────────────────────────────────────────
  app.use(
    express.json({
      verify: (req: any, _res, buf) => {
        req.rawBody = buf;
      },
    }),
  );
  app.use(express.urlencoded({ extended: false }));

  // ── Request logger (API routes only) ──────────────────────────────────────
  app.use((req, res, next) => {
    const start = Date.now();
    res.on("finish", () => {
      if (req.path.startsWith("/api")) {
        const duration = Date.now() - start;
        console.log(`${req.method} ${req.path} ${res.statusCode} in ${duration}ms`);
      }
    });
    next();
  });

  // ── CORS ───────────────────────────────────────────────────────────────────
  // Reflect the request origin so credentialed fetches (credentials:"include")
  // work correctly.  Browsers reject credentialed requests when ACAO is "*".
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin) res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
    if (req.method === "OPTIONS") return res.sendStatus(204);
    next();
  });

  // ── Routes + WebSocket ─────────────────────────────────────────────────────
  await registerRoutes(httpServer, app);

  // ── Global error handler ───────────────────────────────────────────────────
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status  = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
  });

  return { app, httpServer };
}
