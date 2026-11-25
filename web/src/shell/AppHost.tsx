import { Suspense, lazy, useMemo, type ComponentType, type LazyExoticComponent } from "react";
import { Link, useParams } from "react-router-dom";
import { findInternalApp, type RegisteredApp } from "@/registry/registry";
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
    <div className="app-page">
      <nav className="app-page__nav">
        <Link to="/" className="back-link">
          ← Commons
        </Link>
      </nav>
      <header className="app-page__header">
        <h1 className="app-page__title">{app.manifest.name}</h1>
        <p className="app-page__desc">{app.manifest.description}</p>
      </header>
      <main className="app-page__body">
        <Suspense fallback={<p className="loading">Loading…</p>}>
          <Component />
        </Suspense>
      </main>
    </div>
  );
}
