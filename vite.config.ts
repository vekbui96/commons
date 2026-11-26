import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
import { excludePrivateApps, excludePrivateTabs, resolveTarget } from "./build/target";

// The Commons API (vekbui96/commons-api, default port 8790). Dev convenience
// only: production calls go through src/api/client.ts with VITE_COMMONS_API.
const API_TARGET = process.env.VITE_SERVER_TARGET ?? "http://localhost:8790";

// The Ops tab loads the ops hub from /ops/ on its own origin (docs/ops-hub-contract.md).
// Dev only, both optional: COMMONS_OPS_TARGET serves /ops/ (e.g. a local
// `npx serve` of the hub's dashboard/dist), COMMONS_OPS_API_TARGET /ops/api.
// Unset, the tab just says the hub isn't answering. Never a tailnet host here.
const OPS_TARGET = process.env.COMMONS_OPS_TARGET;
const OPS_API_TARGET = process.env.COMMONS_OPS_API_TARGET;

// COMMONS_TARGET=public|private (default public): see build/target.ts.
const TARGET = resolveTarget(process.env.COMMONS_TARGET);
const APPS_DIR = fileURLToPath(new URL("./src/apps", import.meta.url));
const TAB_DEFS_DIR = fileURLToPath(new URL("./src/tabs/defs", import.meta.url));

export default defineConfig(({ command, isPreview }) => ({
  // Public builds are served from https://vekbui96.github.io/commons/; the
  // private build from the root of its tailnet-only host. The default is baked
  // in (not passed via env) so a build from any shell gets it right; VITE_BASE
  // still overrides it for other hosts.
  base:
    process.env.VITE_BASE ?? (TARGET === "public" && (command === "build" || isPreview) ? "/commons/" : "/"),
  define: {
    "import.meta.env.COMMONS_TARGET": JSON.stringify(TARGET),
  },
  // Tests always see every app and tab (so every one is validated); builds and
  // the dev server for the public target never see private ones.
  plugins: [
    react(),
    ...(process.env.VITEST
      ? []
      : [excludePrivateApps(TARGET, APPS_DIR), excludePrivateTabs(TARGET, TAB_DEFS_DIR)]),
  ],
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
      // More specific first: /ops/api before /ops.
      ...(OPS_API_TARGET
        ? {
            "/ops/api": {
              target: OPS_API_TARGET,
              changeOrigin: true,
              rewrite: (p: string) => p.slice(8) || "/",
            },
          }
        : {}),
      ...(OPS_TARGET
        ? { "/ops": { target: OPS_TARGET, changeOrigin: true, rewrite: (p: string) => p.slice(4) || "/" } }
        : {}),
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
    include: ["src/**/*.{test,spec}.{ts,tsx}", "build/**/*.test.ts"],
  },
}));
