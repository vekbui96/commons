import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

// The Commons API (vekbui96/commons-api, default port 8790). Dev convenience
// only: production calls go through src/api/client.ts with VITE_COMMONS_API.
const API_TARGET = process.env.VITE_SERVER_TARGET ?? "http://localhost:8790";

export default defineConfig(({ command, isPreview }) => ({
  // Production builds are served from https://vekbui96.github.io/commons/.
  // The default is baked in (not passed via env) so a build from any shell gets
  // it right; VITE_BASE still overrides it for other hosts.
  base: process.env.VITE_BASE ?? (command === "build" || isPreview ? "/commons/" : "/"),
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    port: Number(process.env.VITE_DEV_PORT ?? 5180),
    strictPort: true,
    proxy: {
      "/api": { target: API_TARGET, changeOrigin: true },
    },
  },
  build: {
    target: "es2022",
    sourcemap: true,
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    css: true,
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
}));
