/**
 * NextStop JGI — Route & Stop Seed Data
 * Source: "NextStop JGI – Bus Routes & Timings" timetable (8:15 AM & 10:15 AM batches)
 *
 * `physicalStopKey` is a normalized identifier shared by stops that are the
 * SAME real-world location across different routes (e.g. "Sai Nagar" appears
 * on all 6 routes). Use this key to geocode each physical place ONCE and
 * reuse the resulting lat/lng across every route that passes through it —
 * avoids duplicate Nominatim calls and duplicate/overlapping map markers.
 *
 * `sequenceOrder` is 1-indexed and defines stop order along the route for
 * drawing the Polyline and for the bottom-sheet stop list.
 *
 * NOTE: In the source image, Gadag Road Route (8:15 AM batch), stop #12
 * "JCET College" was printed as "10:15 am", which breaks the time sequence
 * (stop #11 is 8:10 am). This has been corrected to "8:15 am" below to match
 * the pattern of every other route. Verify against your original source
 * before treating this as final.
 */

export interface RouteStopSeed {
  stopName: string;
  physicalStopKey: string;
  sequenceOrder: number;
  time815amBatch: string;
  time1015amBatch: string;
  isMainStop?: boolean; // mark true for major/well-known landmarks; used for marker sizing
}

export interface RouteSeed {
  routeName: string;
  routeSlug: string;
  notes?: string;
  stops: RouteStopSeed[];
}

// Simple slugifier used to derive physicalStopKey consistently.
// (Kept inline here for portability — feel free to import your own util instead.)
const key = (name: string) =>
  name
    .toLowerCase()
    .replace(/\(.*?\)/g, "") // drop parenthetical notes like "(JK School)"
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

export const routeSeedData: RouteSeed[] = [
  {
    routeName: "Keshwapur Route",
    routeSlug: "keshwapur",
    stops: [
      { stopName: "Shakti Colony (JK School)", physicalStopKey: key("Shakti Colony JK School"), sequenceOrder: 1, time815amBatch: "7:30 am", time1015amBatch: "9:30 am" },
      { stopName: "Sub Jail", physicalStopKey: key("Sub Jail"), sequenceOrder: 2, time815amBatch: "7:32 am", time1015amBatch: "9:32 am" },
      { stopName: "Lamington School", physicalStopKey: key("Lamington School"), sequenceOrder: 3, time815amBatch: "7:35 am", time1015amBatch: "9:35 am" },
      { stopName: "Venkatesh Colony", physicalStopKey: key("Venkatesh Colony"), sequenceOrder: 4, time815amBatch: "7:38 am", time1015amBatch: "9:38 am" },
      { stopName: "Madura Colony", physicalStopKey: key("Madura Colony"), sequenceOrder: 5, time815amBatch: "7:40 am", time1015amBatch: "9:40 am" },
      { stopName: "Keshwapur Circle", physicalStopKey: key("Keshwapur Circle"), sequenceOrder: 6, time815amBatch: "7:45 am", time1015amBatch: "9:45 am", isMainStop: true },
      { stopName: "Old Bus Stand", physicalStopKey: key("Old Bus Stand"), sequenceOrder: 7, time815amBatch: "7:47 am", time1015amBatch: "9:47 am", isMainStop: true },
      { stopName: "Arts College", physicalStopKey: key("Arts College"), sequenceOrder: 8, time815amBatch: "7:55 am", time1015amBatch: "9:55 am", isMainStop: true },
      { stopName: "BVB College", physicalStopKey: key("BVB College"), sequenceOrder: 9, time815amBatch: "8:00 am", time1015amBatch: "10:00 am", isMainStop: true },
      { stopName: "Unkal Cross", physicalStopKey: key("Unkal Cross"), sequenceOrder: 10, time815amBatch: "8:03 am", time1015amBatch: "10:03 am", isMainStop: true },
      { stopName: "Sai Nagar", physicalStopKey: key("Sai Nagar"), sequenceOrder: 11, time815amBatch: "8:10 am", time1015amBatch: "10:10 am" },
      { stopName: "JCET College", physicalStopKey: key("JCET College"), sequenceOrder: 12, time815amBatch: "8:15 am", time1015amBatch: "10:15 am", isMainStop: true },
    ],
  },
  {
    routeName: "PG Route",
    routeSlug: "pg-route",
    notes: "From Tolankeri onwards",
    stops: [
      { stopName: "Tolankeri", physicalStopKey: key("Tolankeri"), sequenceOrder: 1, time815amBatch: "7:50 am", time1015amBatch: "9:50 am", isMainStop: true },
      { stopName: "Chetana PU College", physicalStopKey: key("Chetana PU College"), sequenceOrder: 2, time815amBatch: "7:53 am", time1015amBatch: "9:53 am" },
      { stopName: "Siddeshwar Park", physicalStopKey: key("Siddeshwar Park"), sequenceOrder: 3, time815amBatch: "7:55 am", time1015amBatch: "9:55 am" },
      { stopName: "Lingaraj Nagar", physicalStopKey: key("Lingaraj Nagar"), sequenceOrder: 4, time815amBatch: "8:00 am", time1015amBatch: "10:00 am" },
      { stopName: "Adarsh College", physicalStopKey: key("Adarsh College"), sequenceOrder: 5, time815amBatch: "8:05 am", time1015amBatch: "10:05 am" },
      { stopName: "Siddappa Ajja Temple Lake", physicalStopKey: key("Siddappa Ajja Temple"), sequenceOrder: 6, time815amBatch: "8:08 am", time1015amBatch: "10:08 am" },
      { stopName: "President Hotel", physicalStopKey: key("President Hotel"), sequenceOrder: 7, time815amBatch: "8:10 am", time1015amBatch: "10:10 am", isMainStop: true },
      { stopName: "Sai Nagar", physicalStopKey: key("Sai Nagar"), sequenceOrder: 8, time815amBatch: "8:12 am", time1015amBatch: "10:12 am" },
      { stopName: "JCET College", physicalStopKey: key("JCET College"), sequenceOrder: 9, time815amBatch: "8:15 am", time1015amBatch: "10:15 am", isMainStop: true },
    ],
  },
  {
    routeName: "Siddharoodh Math Route",
    routeSlug: "siddharoodh-math",
    stops: [
      { stopName: "Nehru Nagar Water Tank", physicalStopKey: key("Nehru Nagar Water Tank"), sequenceOrder: 1, time815amBatch: "7:30 am", time1015amBatch: "9:30 am" },
      { stopName: "Manjunath Nagar", physicalStopKey: key("Manjunath Nagar"), sequenceOrder: 2, time815amBatch: "7:32 am", time1015amBatch: "9:32 am" },
      { stopName: "Anand Nagar", physicalStopKey: key("Anand Nagar"), sequenceOrder: 3, time815amBatch: "7:35 am", time1015amBatch: "9:35 am" },
      { stopName: "Siddharoodh Math", physicalStopKey: key("Siddharoodh Math"), sequenceOrder: 4, time815amBatch: "7:40 am", time1015amBatch: "9:40 am", isMainStop: true },
      { stopName: "Muradeshwar Ceramics", physicalStopKey: key("Muradeshwar Ceramics"), sequenceOrder: 5, time815amBatch: "7:43 am", time1015amBatch: "9:43 am" },
      { stopName: "Akshay Park Petrol Bunk", physicalStopKey: key("Akshay Park Petrol Bunk"), sequenceOrder: 6, time815amBatch: "7:45 am", time1015amBatch: "9:45 am" },
      { stopName: "Ravi Nagar", physicalStopKey: key("Ravi Nagar"), sequenceOrder: 7, time815amBatch: "7:47 am", time1015amBatch: "9:47 am" },
      { stopName: "Tolankeri", physicalStopKey: key("Tolankeri"), sequenceOrder: 8, time815amBatch: "7:50 am", time1015amBatch: "9:50 am", isMainStop: true },
      { stopName: "Chetana PU College", physicalStopKey: key("Chetana PU College"), sequenceOrder: 9, time815amBatch: "7:53 am", time1015amBatch: "9:53 am" },
      { stopName: "Siddeshwar Park", physicalStopKey: key("Siddeshwar Park"), sequenceOrder: 10, time815amBatch: "7:55 am", time1015amBatch: "9:55 am" },
      { stopName: "Lingaraj Nagar", physicalStopKey: key("Lingaraj Nagar"), sequenceOrder: 11, time815amBatch: "8:00 am", time1015amBatch: "10:00 am" },
      { stopName: "Adarsh College", physicalStopKey: key("Adarsh College"), sequenceOrder: 12, time815amBatch: "8:05 am", time1015amBatch: "10:05 am" },
      { stopName: "Siddappa Ajja Temple Lake", physicalStopKey: key("Siddappa Ajja Temple"), sequenceOrder: 13, time815amBatch: "8:08 am", time1015amBatch: "10:08 am" },
      { stopName: "President Hotel", physicalStopKey: key("President Hotel"), sequenceOrder: 14, time815amBatch: "8:10 am", time1015amBatch: "10:10 am", isMainStop: true },
      { stopName: "Sai Nagar", physicalStopKey: key("Sai Nagar"), sequenceOrder: 15, time815amBatch: "8:12 am", time1015amBatch: "10:12 am" },
      { stopName: "JCET College", physicalStopKey: key("JCET College"), sequenceOrder: 16, time815amBatch: "8:15 am", time1015amBatch: "10:15 am", isMainStop: true },
    ],
  },
  {
    routeName: "Gadag Road Route",
    routeSlug: "gadag-road",
    notes: 'Also referred to as "BVB Route". Stop #12 time corrected from source typo "10:15 am" -> "8:15 am" for the 8:15 AM batch — verify against original.',
    stops: [
      { stopName: "Head Post Office", physicalStopKey: key("Head Post Office"), sequenceOrder: 1, time815amBatch: "7:45 am", time1015amBatch: "9:45 am" },
      { stopName: "Corporation", physicalStopKey: key("Corporation"), sequenceOrder: 2, time815amBatch: "7:47 am", time1015amBatch: "9:47 am" },
      { stopName: "Old Bus Stand", physicalStopKey: key("Old Bus Stand"), sequenceOrder: 3, time815amBatch: "7:50 am", time1015amBatch: "9:50 am", isMainStop: true },
      { stopName: "Canara Hotel Hosur Circle", physicalStopKey: key("Canara Hotel Hosur Circle"), sequenceOrder: 4, time815amBatch: "7:52 am", time1015amBatch: "9:52 am" },
      { stopName: "KMC Stop", physicalStopKey: key("KMC Stop"), sequenceOrder: 5, time815amBatch: "7:54 am", time1015amBatch: "9:54 am" },
      { stopName: "Gurudatta Bhavan", physicalStopKey: key("Gurudatta Bhavan"), sequenceOrder: 6, time815amBatch: "7:55 am", time1015amBatch: "9:55 am" },
      { stopName: "Arts College", physicalStopKey: key("Arts College"), sequenceOrder: 7, time815amBatch: "7:57 am", time1015amBatch: "9:57 am", isMainStop: true },
      { stopName: "BVB College", physicalStopKey: key("BVB College"), sequenceOrder: 8, time815amBatch: "8:00 am", time1015amBatch: "10:00 am", isMainStop: true },
      { stopName: "Unkal Cross", physicalStopKey: key("Unkal Cross"), sequenceOrder: 9, time815amBatch: "8:05 am", time1015amBatch: "10:05 am", isMainStop: true },
      { stopName: "Siddappa Ajja Temple (old)", physicalStopKey: key("Siddappa Ajja Temple"), sequenceOrder: 10, time815amBatch: "8:08 am", time1015amBatch: "10:08 am" },
      { stopName: "Sai Nagar", physicalStopKey: key("Sai Nagar"), sequenceOrder: 11, time815amBatch: "8:10 am", time1015amBatch: "10:10 am" },
      { stopName: "JCET College", physicalStopKey: key("JCET College"), sequenceOrder: 12, time815amBatch: "8:15 am", time1015amBatch: "10:15 am", isMainStop: true },
    ],
  },
  {
    routeName: "Dharwad Route",
    routeSlug: "dharwad",
    stops: [
      { stopName: "Sarvamangala Cross, Dharwad", physicalStopKey: key("Sarvamangala Cross Dharwad"), sequenceOrder: 1, time815amBatch: "7:20 am", time1015amBatch: "9:20 am", isMainStop: true },
      { stopName: "Saptapur Bavi", physicalStopKey: key("Saptapur Bavi"), sequenceOrder: 2, time815amBatch: "7:24 am", time1015amBatch: "9:24 am" },
      { stopName: "Dasankoppa Circle", physicalStopKey: key("Dasankoppa Circle"), sequenceOrder: 3, time815amBatch: "7:30 am", time1015amBatch: "9:30 am" },
      { stopName: "Jubilee Circle", physicalStopKey: key("Jubilee Circle"), sequenceOrder: 4, time815amBatch: "7:35 am", time1015amBatch: "9:35 am" },
      { stopName: "Court Circle", physicalStopKey: key("Court Circle"), sequenceOrder: 5, time815amBatch: "7:37 am", time1015amBatch: "9:37 am" },
      { stopName: "NTTF", physicalStopKey: key("NTTF"), sequenceOrder: 6, time815amBatch: "7:40 am", time1015amBatch: "9:40 am" },
      { stopName: "Toll Naka", physicalStopKey: key("Toll Naka"), sequenceOrder: 7, time815amBatch: "7:42 am", time1015amBatch: "9:42 am" },
      { stopName: "JSS College", physicalStopKey: key("JSS College"), sequenceOrder: 8, time815amBatch: "7:45 am", time1015amBatch: "9:45 am" },
      { stopName: "Gandhi Nagar", physicalStopKey: key("Gandhi Nagar"), sequenceOrder: 9, time815amBatch: "7:47 am", time1015amBatch: "9:47 am" },
      { stopName: "SDM Dental College", physicalStopKey: key("SDM Dental College"), sequenceOrder: 10, time815amBatch: "7:52 am", time1015amBatch: "9:52 am", isMainStop: true },
      { stopName: "Rayapur RTO", physicalStopKey: key("Rayapur RTO"), sequenceOrder: 11, time815amBatch: "7:57 am", time1015amBatch: "9:57 am" },
      { stopName: "Navanagar", physicalStopKey: key("Navanagar"), sequenceOrder: 12, time815amBatch: "8:00 am", time1015amBatch: "10:00 am", isMainStop: true },
      { stopName: "APMC", physicalStopKey: key("APMC"), sequenceOrder: 13, time815amBatch: "8:05 am", time1015amBatch: "10:05 am" },
      { stopName: "Bhiridevarakoppa", physicalStopKey: key("Bhiridevarakoppa"), sequenceOrder: 14, time815amBatch: "8:07 am", time1015amBatch: "10:07 am" },
      { stopName: "President Hotel", physicalStopKey: key("President Hotel"), sequenceOrder: 15, time815amBatch: "8:09 am", time1015amBatch: "10:09 am", isMainStop: true },
      { stopName: "Sai Nagar", physicalStopKey: key("Sai Nagar"), sequenceOrder: 16, time815amBatch: "8:11 am", time1015amBatch: "10:11 am" },
      { stopName: "JCET College", physicalStopKey: key("JCET College"), sequenceOrder: 17, time815amBatch: "8:15 am", time1015amBatch: "10:15 am", isMainStop: true },
    ],
  },
  {
    routeName: "Navanagar Route",
    routeSlug: "navanagar",
    notes: "From Navanagar onwards",
    stops: [
      { stopName: "Navanagar", physicalStopKey: key("Navanagar"), sequenceOrder: 1, time815amBatch: "8:00 am", time1015amBatch: "10:00 am", isMainStop: true },
      { stopName: "APMC", physicalStopKey: key("APMC"), sequenceOrder: 2, time815amBatch: "8:05 am", time1015amBatch: "10:05 am" },
      { stopName: "Bhiridevarakoppa", physicalStopKey: key("Bhiridevarakoppa"), sequenceOrder: 3, time815amBatch: "8:07 am", time1015amBatch: "10:07 am" },
      { stopName: "President Hotel", physicalStopKey: key("President Hotel"), sequenceOrder: 4, time815amBatch: "8:09 am", time1015amBatch: "10:09 am", isMainStop: true },
      { stopName: "Sai Nagar", physicalStopKey: key("Sai Nagar"), sequenceOrder: 5, time815amBatch: "8:11 am", time1015amBatch: "10:11 am" },
      { stopName: "JCET College", physicalStopKey: key("JCET College"), sequenceOrder: 6, time815amBatch: "8:15 am", time1015amBatch: "10:15 am", isMainStop: true },
    ],
  },
];

/**
 * Derives a deduplicated list of unique physical stops across ALL routes.
 * Feed this into the one-time geocoding script — geocode each entry once,
 * then join back to routeSeedData by physicalStopKey when writing to the
 * `stops` table (route_stops join table pattern recommended).
 */
export function getUniquePhysicalStops(): { physicalStopKey: string; sampleName: string }[] {
  const seen = new Map<string, string>();
  for (const route of routeSeedData) {
    for (const stop of route.stops) {
      if (!seen.has(stop.physicalStopKey)) {
        seen.set(stop.physicalStopKey, stop.stopName);
      }
    }
  }
  return Array.from(seen.entries()).map(([physicalStopKey, sampleName]) => ({
    physicalStopKey,
    sampleName,
  }));
}
