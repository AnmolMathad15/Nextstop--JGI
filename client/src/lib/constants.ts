// ─────────────────────────────────────────────────────────────────────────────
// NextStop JGI — Client-side route constants
// Real GPS coordinates for Hubballi-Dharwad, Karnataka
// JCET College anchor: 15.394147, 75.118946 (Unkal, Hubballi)
// ─────────────────────────────────────────────────────────────────────────────

export const JCET_COLLEGE_COORDS = {
  lat: 15.394147,
  lng: 75.118946,
};

// Map default center — Hubballi city center
export const HUBLI_CENTER = { lat: 15.3648, lng: 75.1248 };

// Route colour mapping (matches server seed + custom map style)
export const ROUTE_COLORS: Record<string, string> = {
  "keshwapur route":       "#f97316", // orange
  "pg route":              "#22c55e", // green
  "siddharoodh math route":"#ef4444", // red
  "gadag road route":      "#8b5cf6", // purple
  "dharwad route":         "#1e40af", // dark blue
  "navanagar route":       "#06b6d4", // cyan / neon-blue
};

// Static snapshot of routes — used only as fallback when API is unavailable.
// The authoritative data always comes from /api/routes/:id.
export const ROUTES_DATA = [
  {
    id: 1,
    name: "Keshwapur Route",
    color: "#f97316",
    stops: [
      { name: "Shakti Colony (JK School)", scheduledTime: "07:30", lat: 15.3452, lng: 75.1342 },
      { name: "Sub Jail",                  scheduledTime: "07:32", lat: 15.3498, lng: 75.1306 },
      { name: "Lamington School",          scheduledTime: "07:35", lat: 15.3558, lng: 75.1272 },
      { name: "Venkatesh Colony",          scheduledTime: "07:38", lat: 15.3608, lng: 75.1255 },
      { name: "Madura Colony",             scheduledTime: "07:40", lat: 15.3632, lng: 75.1248 },
      { name: "Keshwapur Circle",          scheduledTime: "07:45", lat: 15.3588, lng: 75.1175 },
      { name: "Old Bus Stand",             scheduledTime: "07:47", lat: 15.3648, lng: 75.1250 },
      { name: "Arts College",              scheduledTime: "07:55", lat: 15.3652, lng: 75.1268 },
      { name: "BVB College",               scheduledTime: "08:00", lat: 15.3712, lng: 75.1285 },
      { name: "Unkal Cross",               scheduledTime: "08:03", lat: 15.3758, lng: 75.1292 },
      { name: "Sai Nagar",                 scheduledTime: "08:10", lat: 15.3895, lng: 75.1215 },
      { name: "JCET College",              scheduledTime: "08:15", lat: 15.3942, lng: 75.1189 },
    ],
  },
  {
    id: 2,
    name: "PG Route",
    color: "#22c55e",
    stops: [
      { name: "Tolankeri",                 scheduledTime: "07:50", lat: 15.3485, lng: 75.1008 },
      { name: "Chetana PU College",        scheduledTime: "07:53", lat: 15.3520, lng: 75.1042 },
      { name: "Siddeshwar Park",           scheduledTime: "07:55", lat: 15.3550, lng: 75.1068 },
      { name: "Lingaraj Nagar",            scheduledTime: "08:00", lat: 15.3582, lng: 75.1105 },
      { name: "Adarsh College",            scheduledTime: "08:05", lat: 15.3618, lng: 75.1158 },
      { name: "Siddappa Ajja Temple Lake", scheduledTime: "08:08", lat: 15.3792, lng: 75.1268 },
      { name: "President Hotel",           scheduledTime: "08:10", lat: 15.3835, lng: 75.1242 },
      { name: "Sai Nagar",                 scheduledTime: "08:12", lat: 15.3895, lng: 75.1215 },
      { name: "JCET College",              scheduledTime: "08:15", lat: 15.3942, lng: 75.1189 },
    ],
  },
  {
    id: 3,
    name: "Siddharoodh Math Route",
    color: "#ef4444",
    stops: [
      { name: "Nehru Nagar Water Tank",    scheduledTime: "07:30", lat: 15.3278, lng: 75.0770 },
      { name: "Manjunath Nagar",           scheduledTime: "07:32", lat: 15.3308, lng: 75.0802 },
      { name: "Anand Nagar",               scheduledTime: "07:35", lat: 15.3338, lng: 75.0838 },
      { name: "Siddharoodh Math",          scheduledTime: "07:40", lat: 15.3365, lng: 75.0870 },
      { name: "Muradeshwar Ceramics",      scheduledTime: "07:43", lat: 15.3392, lng: 75.0905 },
      { name: "Akshay Park Petrol Bunk",   scheduledTime: "07:45", lat: 15.3420, lng: 75.0938 },
      { name: "Ravi Nagar",                scheduledTime: "07:47", lat: 15.3450, lng: 75.0972 },
      { name: "Tolankeri",                 scheduledTime: "07:50", lat: 15.3485, lng: 75.1008 },
      { name: "Chetana PU College",        scheduledTime: "07:53", lat: 15.3520, lng: 75.1042 },
      { name: "Siddeshwar Park",           scheduledTime: "07:55", lat: 15.3550, lng: 75.1068 },
      { name: "Lingaraj Nagar",            scheduledTime: "08:00", lat: 15.3582, lng: 75.1105 },
      { name: "Adarsh College",            scheduledTime: "08:05", lat: 15.3618, lng: 75.1158 },
      { name: "Siddappa Ajja Temple Lake", scheduledTime: "08:08", lat: 15.3792, lng: 75.1268 },
      { name: "President Hotel",           scheduledTime: "08:10", lat: 15.3835, lng: 75.1242 },
      { name: "Sai Nagar",                 scheduledTime: "08:12", lat: 15.3895, lng: 75.1215 },
      { name: "JCET College",              scheduledTime: "08:15", lat: 15.3942, lng: 75.1189 },
    ],
  },
  {
    id: 4,
    name: "Gadag Road Route",
    color: "#8b5cf6",
    stops: [
      { name: "Head Post Office",          scheduledTime: "07:45", lat: 15.3625, lng: 75.1190 },
      { name: "Corporation",               scheduledTime: "07:47", lat: 15.3632, lng: 75.1208 },
      { name: "Old Bus Stand",             scheduledTime: "07:50", lat: 15.3648, lng: 75.1250 },
      { name: "Canara Hotel Hosur Circle", scheduledTime: "07:52", lat: 15.3660, lng: 75.1260 },
      { name: "KMC Stop",                  scheduledTime: "07:54", lat: 15.3678, lng: 75.1272 },
      { name: "Gurudatta Bhavan",          scheduledTime: "07:55", lat: 15.3692, lng: 75.1280 },
      { name: "Arts College",              scheduledTime: "07:57", lat: 15.3652, lng: 75.1268 },
      { name: "BVB College",               scheduledTime: "08:00", lat: 15.3712, lng: 75.1285 },
      { name: "Unkal Cross",               scheduledTime: "08:05", lat: 15.3758, lng: 75.1292 },
      { name: "Siddappa Ajja Temple (old)",scheduledTime: "08:08", lat: 15.3792, lng: 75.1268 },
      { name: "Sai Nagar",                 scheduledTime: "08:10", lat: 15.3895, lng: 75.1215 },
      { name: "JCET College",              scheduledTime: "08:15", lat: 15.3942, lng: 75.1189 },
    ],
  },
  {
    id: 5,
    name: "Dharwad Route",
    color: "#1e40af",
    stops: [
      { name: "Sarvamangala Cross, Dharwad",scheduledTime: "07:20", lat: 15.4583, lng: 75.0095 },
      { name: "Saptapur Bavi",              scheduledTime: "07:24", lat: 15.4548, lng: 75.0178 },
      { name: "Dasankoppa Circle",          scheduledTime: "07:30", lat: 15.4488, lng: 75.0372 },
      { name: "Jubilee Circle",             scheduledTime: "07:35", lat: 15.4462, lng: 75.0512 },
      { name: "Court Circle",               scheduledTime: "07:37", lat: 15.4438, lng: 75.0568 },
      { name: "NTTF",                       scheduledTime: "07:40", lat: 15.4372, lng: 75.0678 },
      { name: "Toll Naka",                  scheduledTime: "07:42", lat: 15.4318, lng: 75.0768 },
      { name: "JSS College",                scheduledTime: "07:45", lat: 15.4252, lng: 75.0872 },
      { name: "Gandhi Nagar",               scheduledTime: "07:47", lat: 15.4192, lng: 75.0938 },
      { name: "SDM Dental College",         scheduledTime: "07:52", lat: 15.4128, lng: 75.1015 },
      { name: "Rayapur RTO",                scheduledTime: "07:57", lat: 15.4062, lng: 75.1065 },
      { name: "Navanagar",                  scheduledTime: "08:00", lat: 15.3982, lng: 75.1098 },
      { name: "APMC",                       scheduledTime: "08:05", lat: 15.3942, lng: 75.1138 },
      { name: "Bhiridevarakoppa",           scheduledTime: "08:07", lat: 15.3908, lng: 75.1165 },
      { name: "President Hotel",            scheduledTime: "08:09", lat: 15.3835, lng: 75.1242 },
      { name: "Sai Nagar",                  scheduledTime: "08:11", lat: 15.3895, lng: 75.1215 },
      { name: "JCET College",               scheduledTime: "08:15", lat: 15.3942, lng: 75.1189 },
    ],
  },
  {
    id: 6,
    name: "Navanagar Route",
    color: "#06b6d4",
    stops: [
      { name: "Navanagar",        scheduledTime: "08:00", lat: 15.3982, lng: 75.1098 },
      { name: "APMC",             scheduledTime: "08:05", lat: 15.3942, lng: 75.1138 },
      { name: "Bhiridevarakoppa", scheduledTime: "08:07", lat: 15.3908, lng: 75.1165 },
      { name: "President Hotel",  scheduledTime: "08:09", lat: 15.3835, lng: 75.1242 },
      { name: "Sai Nagar",        scheduledTime: "08:11", lat: 15.3895, lng: 75.1215 },
      { name: "JCET College",     scheduledTime: "08:15", lat: 15.3942, lng: 75.1189 },
    ],
  },
];
