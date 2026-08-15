import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

const isReplit = !!process.env.REPL_ID;

export default defineConfig({
  plugins: [
    react(),
    // Replit-specific plugins — only loaded when running inside a Repl.
    // On Vercel/CI (no REPL_ID) these are skipped entirely so they don't
    // need to be present in node_modules.
    ...(isReplit
      ? [
          (await import("@replit/vite-plugin-runtime-error-modal")).default(),
          ...(process.env.NODE_ENV !== "production"
            ? [
                await import("@replit/vite-plugin-cartographer").then((m) => m.cartographer()),
                await import("@replit/vite-plugin-dev-banner").then((m) => m.devBanner()),
              ]
            : []),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@":       path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir:      path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    target:      "esnext",
    rollupOptions: {
      output: {
        manualChunks: {
          "mapbox":   ["mapbox-gl"],
          "recharts": ["recharts"],
        },
      },
    },
  },
  optimizeDeps: {
    // esbuild 0.28 no longer downlevels destructuring for the browser
    // targets Vite 6 derives from browserslist. Keep dependency pre-bundling
    // on modern syntax and leave Mapbox's already-browser-ready bundle alone.
    esbuildOptions: {
      target: "esnext",
    },
    exclude: ["mapbox-gl"],
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
