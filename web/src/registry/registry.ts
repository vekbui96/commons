import type { ComponentType } from "react";
import type { AppManifest } from "./types";

/**
 * The app registry, discovered at build time. Adding an app means adding a
 * folder under src/apps/ with a manifest.ts (and an App.tsx for internal apps);
 * nothing here needs to change.
 */

type ComponentModule = { default: ComponentType };
type ComponentLoader = () => Promise<ComponentModule>;

const manifestModules = import.meta.glob<{ default: AppManifest }>("../apps/*/manifest.ts", {
  eager: true,
});
const componentLoaders = import.meta.glob<ComponentModule>("../apps/*/App.tsx");

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

/** Apps shown on the homepage. Private apps stay hidden until there is auth. */
export function listedApps(apps: readonly RegisteredApp[] = registry): RegisteredApp[] {
  return apps.filter((app) => app.manifest.visibility === "public");
}

/** An internal, public app by id, or undefined. */
export function findInternalApp(id: string, apps: readonly RegisteredApp[] = registry) {
  return apps.find(
    (app) =>
      app.manifest.id === id &&
      app.manifest.kind === "internal" &&
      app.manifest.visibility === "public" &&
      app.load !== undefined,
  );
}

/** The route of an internal app, relative to the hash router. */
export function appPath(id: string): string {
  return `/apps/${id}`;
}
