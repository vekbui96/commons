import { lazy, type ComponentType, type LazyExoticComponent } from "react";
import type { RegisteredApp } from "@/registry/registry";

// One lazy component per app, created once so re-renders don't remount it.
// Shared by AppHost (#/apps/<id>) and page tabs.
const lazyCache = new Map<string, LazyExoticComponent<ComponentType>>();

export function lazyFor(app: RegisteredApp): LazyExoticComponent<ComponentType> | null {
  if (!app.load) return null;
  let component = lazyCache.get(app.manifest.id);
  if (!component) {
    component = lazy(app.load);
    lazyCache.set(app.manifest.id, component);
  }
  return component;
}
