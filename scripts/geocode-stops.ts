/**
 * NextStop JGI — Geocoding Script
 *
 * Reads all route_stops with NULL lat/lng from the DB, queries Nominatim
 * for Hubli-Dharwad coordinates, and updates them in-place.
 *
 * Run once: npx tsx scripts/geocode-stops.ts
 *
 * Respects Nominatim's usage policy:
 *  - 1 request per second maximum
 *  - Descriptive User-Agent header with contact email
 *  - No bulk scraping
 */

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { eq, isNull, or } from "drizzle-orm";
import { routeStops } from "../shared/schema";

const NOMINATIM_BASE = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "NextStopJGI/1.0 (college-bus-tracker; contact@jcet.edu.in)";
const DELAY_MS = 1100; // ≥1s between requests
const MIN_IMPORTANCE = 0.3; // reject low-confidence results

// ── DB connection ─────────────────────────────────────────────────────────────
if (!process.env.DATABASE_URL) {
  console.error("❌  DATABASE_URL env var is not set.");
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db   = drizzle(pool);

// ── Nominatim query ───────────────────────────────────────────────────────────
interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
  importance: number;
}

async function geocode(stopName: string): Promise<{ lat: number; lng: number; displayName: string } | null> {
  const query = `${stopName}, Hubballi-Dharwad, Karnataka, India`;
  const url   = `${NOMINATIM_BASE}?q=${encodeURIComponent(query)}&format=json&limit=3&countrycodes=in`;

  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, "Accept-Language": "en" },
  });

  if (!res.ok) {
    console.warn(`  ⚠ HTTP ${res.status} for "${stopName}"`);
    return null;
  }

  const data: NominatimResult[] = await res.json();

  if (!data || data.length === 0) {
    console.warn(`  ⚠ No results for "${stopName}"`);
    return null;
  }

  // Pick the best result
  const best = data.sort((a, b) => b.importance - a.importance)[0];

  if (best.importance < MIN_IMPORTANCE) {
    console.warn(
      `  ⚠ Low confidence (${best.importance.toFixed(2)}) for "${stopName}" → "${best.display_name}"`
    );
    return null;
  }

  return {
    lat:         parseFloat(best.lat),
    lng:         parseFloat(best.lon),
    displayName: best.display_name,
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log("🗺  NextStop JGI — Geocoding route stops\n");

  // Find stops that have zero-ish or clearly placeholder coordinates
  // (We treat lat/lng of exactly 0 or coordinates outside Karnataka as needing geocoding)
  const allStops = await db.select().from(routeStops);

  // Filter: outside Karnataka bounding box [lat 11–19, lng 74–78]
  const needsGeocode = allStops.filter(s =>
    !s.lat || !s.lng ||
    s.lat === 0 || s.lng === 0 ||
    s.lat < 11 || s.lat > 19 ||
    s.lng < 74 || s.lng > 78
  );

  if (needsGeocode.length === 0) {
    console.log("✅  All stops already have valid coordinates. Nothing to do.");
    await pool.end();
    return;
  }

  console.log(`Found ${needsGeocode.length} stop(s) needing geocoding:\n`);

  const failed: { id: number; name: string }[] = [];
  let updated = 0;

  for (const stop of needsGeocode) {
    process.stdout.write(`  [${stop.id}] "${stop.name}" … `);

    const result = await geocode(stop.name);

    if (!result) {
      console.log("FAILED");
      failed.push({ id: stop.id, name: stop.name });
    } else {
      await db
        .update(routeStops)
        .set({ lat: result.lat, lng: result.lng })
        .where(eq(routeStops.id, stop.id));
      console.log(`OK → ${result.lat.toFixed(5)}, ${result.lng.toFixed(5)} (${result.displayName.slice(0, 60)}…)`);
      updated++;
    }

    // Respect 1 req/sec
    await new Promise(r => setTimeout(r, DELAY_MS));
  }

  console.log(`\n✅  Updated: ${updated}   ❌  Failed: ${failed.length}`);

  if (failed.length > 0) {
    console.log("\nFailed stops (manual correction needed):");
    failed.forEach(f => console.log(`  • [ID ${f.id}] ${f.name}`));
  }

  await pool.end();
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
