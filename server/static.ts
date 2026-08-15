import express, { type Express } from "express";
import fs from "fs";
import path from "path";

export function serveStatic(app: Express) {
  // __dirname is dist/ when bundled with esbuild (npm run build).
  // Fall back to process.cwd()/dist/public for environments where __dirname
  // resolves differently (e.g. ts-node, tsx in production mode).
  const candidates = [
    path.resolve(__dirname, "public"),
    path.resolve(process.cwd(), "dist", "public"),
  ];

  const distPath = candidates.find(p => fs.existsSync(p));

  if (!distPath) {
    throw new Error(
      `Could not find the build directory (tried: ${candidates.join(", ")}). ` +
      `Run "npm run build:client" first.`,
    );
  }

  app.use(express.static(distPath));

  // Fall through to index.html for client-side routing.
  app.use("/{*splat}", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
