import { Suspense, lazy, useMemo, type ComponentType, type LazyExoticComponent } from "react";
import { useParams } from "react-router-dom";
import { findInternalApp, type RegisteredApp } from "@/registry/registry";
import { AppShell } from "@/ui";
import { NotFound } from "./NotFound";

// One lazy component per app, created once so re-renders don't remount it.
const lazyCache = new Map<string, LazyExoticComponent<ComponentType>>();

function lazyFor(app: RegisteredApp) {
  let component = lazyCache.get(app.manifest.id);
  if (!component) {
    component = lazy(app.load!);
    lazyCache.set(app.manifest.id, component);
  }
  return component;
}

export function AppHost() {
  const { id = "" } = useParams();
  const app = findInternalApp(id);
  const Component = useMemo(() => (app ? lazyFor(app) : null), [app]);

  if (!app || !Component) return <NotFound />;

  return (
    <AppShell
      title={app.manifest.name}
      description={app.manifest.description}
      wide={app.manifest.kind === "internal" && app.manifest.wide === true}
    >
      <Suspense fallback={<p className="loading">Loading…</p>}>
        <Component />
      </Suspense>
    </AppShell>
  );
}
