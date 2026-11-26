import { Suspense, useMemo } from "react";
import { useLocation, useParams } from "react-router-dom";
import { findInternalApp } from "@/registry/registry";
import { AppShell } from "@/ui";
import { lazyFor } from "./lazyApp";
import { backTarget } from "./navState";
import { NotFound } from "./NotFound";

export function AppHost() {
  const { id = "" } = useParams();
  const location = useLocation();
  const app = findInternalApp(id);
  const Component = useMemo(() => (app ? lazyFor(app) : null), [app]);

  if (!app || !Component) return <NotFound />;

  return (
    <AppShell
      title={app.manifest.name}
      description={app.manifest.description}
      wide={app.manifest.kind === "internal" && app.manifest.wide === true}
      backTo={backTarget(location.state)}
    >
      <Suspense fallback={<p className="loading">Loading…</p>}>
        <Component />
      </Suspense>
    </AppShell>
  );
}
