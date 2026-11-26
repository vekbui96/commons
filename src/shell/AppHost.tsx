import { Suspense, useMemo } from "react";
import { useLocation, useParams } from "react-router-dom";
import { findInternalApp } from "@/registry/registry";
import { useProfile } from "@/profiles/useProfile";
import { AppShell } from "@/ui";
import { lazyFor } from "./lazyApp";
import { backTarget } from "./navState";
import { NotFound } from "./NotFound";

export function AppHost() {
  const { id = "" } = useParams();
  const location = useLocation();
  const app = findInternalApp(id);
  const Component = useMemo(() => (app ? lazyFor(app) : null), [app]);

  const { isEnabled, label } = useProfile();

  if (!app || !Component) return <NotFound />;
  // In this build, but not in the visitor's profile (public build only).
  if (!isEnabled(app.manifest.id)) return <NotFound hint={`Not in your view; tap ${label} to switch.`} />;

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
