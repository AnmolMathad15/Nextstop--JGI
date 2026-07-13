/**
 * server/index.ts — Replit / Railway / Render entry point
 *
 * Starts the HTTP + WebSocket server. On Vercel, use api/index.ts instead.
 */

import { createApp } from "./app";
import { serveStatic } from "./static";

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}

(async () => {
  const { app, httpServer } = await createApp();

  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen({ port, host: "0.0.0.0", reusePort: 0 }, () => {
    log(`serving on port ${port}`);
  });
})();
