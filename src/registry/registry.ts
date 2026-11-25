import type { ComponentType } from "react";
import { SITE_TARGET, type SiteTarget } from "@/site";
import type { AppManifest } from "./types";

/**
 * The app registry, discovered at build time. Adding an app means adding a
 * folder under src/apps/ with a manifest.ts (and an App.tsx for internal apps);
 * nothing here needs to change.
 */

type ComponentModule = { default: ComponentType };
type ComponentLoader = () => Promise<ComponentModule>;

// The "!../apps/__private_apps_excluded__/**" pattern is a placeholder: for the
// public build, build/target.ts swaps it for one negative pattern per private
// app folder, so private apps never enter the public bundle. Keep it in both globs.
const manifestModules = import.meta.glob<{ default: AppManifest }>(
  ["../apps/*/manifest.ts", "!../apps/__private_apps_excluded__/**"],
  { eager: true },
);
const componentLoaders = import.meta.glob<ComponentModule>([
  "../apps/*/App.tsx",
  "!../apps/__private_apps_excluded__/**",
]);

export interface RegisteredApp {
  /** Folder name under src/apps/. */
  folder: string;
  manifest: AppManifest;
  /** Lazy loader for internal apps' App.tsx; undefined for external apps. */
  load: ComponentLoader | undefined;
}

function folderOf(path: string): string {
  // "../apps/<folder>/manifest.ts"
  return path.split("/").at(-2) ?? path;
}

const loadersByFolder = new Map<string, ComponentLoader>(
  Object.entries(componentLoaders).map(([path, load]) => [folderOf(path), load]),
);

export const registry: readonly RegisteredApp[] = Object.entries(manifestModules)
  .map(([path, mod]) => {
    const folder = folderOf(path);
    return { folder, manifest: mod.default, load: loadersByFolder.get(folder) };
  })
  .sort((a, b) => a.manifest.name.localeCompare(b.manifest.name));

/**
 * Whether an app belongs on this site. The public site shows only public apps
 * (its bundle has no others anyway); the private, tailnet-only site shows all.
 */
export function isAvailable(app: RegisteredApp, target: SiteTarget = SITE_TARGET): boolean {
  return target === "private" || app.manifest.visibility === "public";
}

/** Apps shown on this site's homepage. */
export function listedApps(
  apps: readonly RegisteredApp[] = registry,
  target: SiteTarget = SITE_TARGET,
): RegisteredApp[] {
  return apps.filter((app) => isAvailable(app, target));
}

/** An internal app available on this site, by id, or undefined. */
export function findInternalApp(
  id: string,
  apps: readonly RegisteredApp[] = registry,
  target: SiteTarget = SITE_TARGET,
) {
  return apps.find(
    (app) =>
      app.manifest.id === id &&
      app.manifest.kind === "internal" &&
      isAvailable(app, target) &&
      app.load !== undefined,
  );
}

/** The route of an internal app, relative to the hash router. */
export function appPath(id: string): string {
  return `/apps/${id}`;
}
