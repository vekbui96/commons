import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { Plugin } from "vite";

/**
 * The build target switch. One repo, two builds:
 *
 *   - public  (default): GitHub Pages at /commons/. Only `visibility: "public"`
 *     apps and tabs. Private ones are cut out of the bundle entirely, not just
 *     hidden.
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

/** Placeholder negation in src/tabs/registry.ts's glob; replaced for public builds. */
export const TAB_EXCLUDE_PLACEHOLDER = '"!./defs/__private_tabs_excluded__.ts"';

/**
 * Tab definition files (src/tabs/defs/<id>.ts) that are not plainly public, as
 * ids. Stricter than apps: the file must hold exactly one `visibility:` literal,
 * and it must be "public"; anything else counts as private (fail closed).
 */
export function privateTabIds(defsDir: string): string[] {
  if (!existsSync(defsDir)) return [];
  return readdirSync(defsDir, { withFileTypes: true })
    .filter(
      (entry) => entry.isFile() && /^[a-z0-9-]+\.ts$/.test(entry.name) && !entry.name.endsWith(".test.ts"),
    )
    .map((entry) => entry.name.slice(0, -3))
    .filter((id) => {
      const source = readFileSync(join(defsDir, `${id}.ts`), "utf8");
      const all = [...source.matchAll(/\bvisibility\s*:\s*["'](public|private)["']/g)];
      return !(all.length === 1 && all[0]![1] === "public");
    })
    .sort();
}

/**
 * A pre-transform that swaps a glob placeholder in one source file for negative
 * patterns, on the public target only. Vite then never sees the excluded files,
 * so nothing of theirs (module, component or chunk) reaches dist/.
 */
function globExclusion(options: {
  name: string;
  target: CommonsTarget;
  fileSuffix: string;
  placeholder: string;
  patterns: () => string[];
}): Plugin {
  return {
    name: options.name,
    enforce: "pre",
    transform(code, id) {
      if (options.target !== "public") return null;
      if (!id.replaceAll("\\", "/").endsWith(options.fileSuffix)) return null;
      if (!code.includes(options.placeholder)) {
        this.error(`${options.fileSuffix} lost its ${options.placeholder} glob placeholder`);
      }
      const patterns = options.patterns();
      if (patterns.length === 0) return null;
      const replacement = patterns.map((p) => JSON.stringify(p)).join(", ");
      return { code: code.split(options.placeholder).join(replacement), map: null };
    },
  };
}

/**
 * For the public target, rewrites the registry's import.meta.glob calls so every
 * private app folder is a negative pattern: Vite then never sees those files,
 * and no manifest, component or chunk of theirs reaches dist/.
 */
export function excludePrivateApps(target: CommonsTarget, appsDir: string): Plugin {
  return globExclusion({
    name: "commons:exclude-private-apps",
    target,
    fileSuffix: "/src/registry/registry.ts",
    placeholder: EXCLUDE_PLACEHOLDER,
    patterns: () => privateAppFolders(appsDir).map((f) => `!../apps/${f}/**`),
  });
}

/** The same for tab definitions: private tabs never reach the public bundle. */
export function excludePrivateTabs(target: CommonsTarget, defsDir: string): Plugin {
  return globExclusion({
    name: "commons:exclude-private-tabs",
    target,
    fileSuffix: "/src/tabs/registry.ts",
    placeholder: TAB_EXCLUDE_PLACEHOLDER,
    patterns: () => privateTabIds(defsDir).map((id) => `!./defs/${id}.ts`),
  });
}
