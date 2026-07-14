import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@shared/schema";

// ── Lazy pool ─────────────────────────────────────────────────────────────────
// We do NOT throw at module-load time if DATABASE_URL is absent.
// Doing so crashes the Vercel function during module initialisation and Vercel
// surfaces it as a generic FUNCTION_INVOCATION_FAILED (no body, no logs).
// Instead we fail at connection time, which lets api/index.ts catch the error
// and return a proper 503 with a human-readable message.
//
// SSL is required by every major hosted PostgreSQL provider (Neon, Supabase,
// Vercel Postgres, Railway, Render).  We detect the provider from the URL so
// local / Replit dev (plain postgres://localhost) stays SSL-free.

function makePool(): pg.Pool {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set.  Add it to your Vercel project's Environment Variables " +
        "(Project → Settings → Environment Variables) and redeploy.",
    );
  }

  const requireSsl =
    url.includes("neon.tech") ||
    url.includes("supabase") ||
    url.includes("railway.app") ||
    url.includes("render.com") ||
    url.includes("vercel-storage.com") ||
    (process.env.NODE_ENV === "production" && !url.includes("localhost"));

  const pool = new pg.Pool({
    connectionString: url,
    ssl: requireSsl ? { rejectUnauthorized: false } : false,
    // Small pool: each Vercel cold-start gets its own pool instance and
    // functions don't share memory across invocations.
    max: 3,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 5_000,
  });

  pool.on("error", (err) => {
    console.error("[db] Unexpected pool error:", err.message);
  });

  return pool;
}

export const pool = makePool();
export const db = drizzle({ client: pool, schema });
