import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set. Did you forget to provision a database?");
}

// SSL is required by every major hosted PostgreSQL provider (Neon, Supabase,
// Vercel Postgres, Railway, Render, etc.).  In local / Replit dev the URL is
// plain postgres:// so we disable SSL there to avoid self-signed cert errors.
const requireSsl =
  process.env.DATABASE_URL.includes("neon.tech") ||
  process.env.DATABASE_URL.includes("supabase") ||
  process.env.DATABASE_URL.includes("railway") ||
  process.env.DATABASE_URL.includes("render") ||
  process.env.DATABASE_URL.includes("vercel-storage") ||
  process.env.DATABASE_URL.startsWith("postgres://") && process.env.NODE_ENV === "production";

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: requireSsl ? { rejectUnauthorized: false } : false,
  // Keep the pool small in serverless — each cold-start creates its own pool
  // instance and Vercel functions don't share memory between invocations.
  max: 3,
  idleTimeoutMillis: 10_000,
  connectionTimeoutMillis: 5_000,
});

pool.on("error", (err) => {
  console.error("Unexpected DB pool error:", err.message);
});

export const db = drizzle({ client: pool, schema });
