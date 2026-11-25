import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { Plugin } from "vite";

/**
 * The build target switch. One repo, two builds:
 *
 *   - public  (default): GitHub Pages at /commons/. Only `visibility: "public"`
 *     apps. Private apps are cut out of the bundle entirely, not just hidden.
 *   - private: served tailnet-only from server-pc at /. Every app; the API is
 *     the same origin under /api.
 *
 * Chosen with COMMONS_TARGET=public|private at build (or dev) time.
 */
export type CommonsTarget = "public" | "private";

export function resolveTarget(raw: string | undefined): CommonsTarget {
  const value = raw?.trim().toLowerCase() ?? "";
  if (value === "" || value === "public") return "public";
  if (value === "private") return "private";
  throw new Error(`COMMONS_TARGET must be "public" or "private" (got ${JSON.stringify(raw)})`);
}

/** Reads a manifest's visibility from its source text (validated against the loaded manifest in a test). */
export function visibilityFromSource(source: string): "public" | "private" | undefined {
  const match = /\bvisibility\s*:\s*["'](public|private)["']/.exec(source);
  return match?.[1] as "public" | "private" | undefined;
}

/** Folders under src/apps/ whose manifest is not plainly public. Unknown counts as private (fail closed). */
export function privateAppFolders(appsDir: string): string[] {
  if (!existsSync(appsDir)) return [];
  return readdirSync(appsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((folder) => {
      const file = join(appsDir, folder, "manifest.ts");
      if (!existsSync(file)) return false;
      return visibilityFromSource(readFileSync(file, "utf8")) !== "public";
    })
    .sort();
}

/** Placeholder negation in src/registry/registry.ts's globs; replaced for public builds. */
export const EXCLUDE_PLACEHOLDER = '"!../apps/__private_apps_excluded__/**"';

/**
 * For the public target, rewrites the registry's import.meta.glob calls so every
 * private app folder is a negative pattern: Vite then never sees those files,
 * and no manifest, component or chunk of theirs reaches dist/.
 */
export function excludePrivateApps(target: CommonsTarget, appsDir: string): Plugin {
  return {
    name: "commons:exclude-private-apps",
    enforce: "pre",
    transform(code, id) {
      if (target !== "public") return null;
      if (!id.replaceAll("\\", "/").endsWith("/src/registry/registry.ts")) return null;
      if (!code.includes(EXCLUDE_PLACEHOLDER)) {
        this.error(`registry.ts lost its ${EXCLUDE_PLACEHOLDER} glob placeholder`);
      }
      const folders = privateAppFolders(appsDir);
      if (folders.length === 0) return null;
      const patterns = folders.map((f) => JSON.stringify(`!../apps/${f}/**`)).join(", ");
      return { code: code.split(EXCLUDE_PLACEHOLDER).join(patterns), map: null };
    },
  };
}
