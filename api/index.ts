/**
 * api/index.ts — Vercel serverless entry point
 *
 * Vercel routes all /api/* requests here. The Express app is created once
 * per warm Lambda instance (cold-start initialises routes + seeds the DB).
 *
 * WebSocket behaviour on Vercel:
 *   • Hobby plan  — WS connections time out quickly; clients fall back to
 *                   REST polling automatically (useWebSocket.ts).
 *   • Pro plan    — Fluid compute keeps the function alive; WS works fully.
 */

import type { IncomingMessage, ServerResponse } from "http";
import { createApp } from "../server/app";

// Cache the app instance across warm invocations (avoids re-seeding on
// every request while still working correctly on cold starts).
let appHandler: ((req: IncomingMessage, res: ServerResponse) => void) | null = null;

const initPromise = createApp().then(({ app }) => {
  appHandler = app as unknown as (req: IncomingMessage, res: ServerResponse) => void;
});

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (!appHandler) await initPromise;
  appHandler!(req, res);
}
