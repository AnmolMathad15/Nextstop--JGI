/**
 * api/index.ts — Vercel serverless entry point
 *
 * All /api/* requests are routed here by vercel.json.
 * The Express app is initialised once per warm Lambda instance.
 */

import type { IncomingMessage, ServerResponse } from "http";
import { createApp } from "../server/app";

type Handler = (req: IncomingMessage, res: ServerResponse) => void;

let appHandler: Handler | null = null;
let initError: Error | null = null;

// Initialise eagerly so the first real request doesn't pay the full cold-start
// cost.  We capture any failure so we can return a proper 503 instead of
// hanging or crashing the invocation silently.
const initPromise = createApp()
  .then(({ app }) => {
    appHandler = app as unknown as Handler;
  })
  .catch((err: Error) => {
    initError = err;
    console.error("[api/index] Initialisation failed:", err.message);
  });

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  // Wait for init (no-op on warm invocations)
  await initPromise;

  if (initError || !appHandler) {
    res.writeHead(503, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        error: "Service unavailable — server failed to initialise.",
        detail: initError?.message ?? "unknown",
      }),
    );
    return;
  }

  appHandler(req, res);
}
