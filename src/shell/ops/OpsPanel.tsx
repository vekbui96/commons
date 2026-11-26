import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/ui";
import { opsPanelMounted, reportOpsCount } from "./background";
import { OPS_API_BASE, OPS_TIMEOUT_MS, healthUrl, standaloneUrl } from "./config";
import { loadOpsHub } from "./hubModule";
import "./ops.css";

/**
 * The Ops tab (private build only): the ops hub dashboard, loaded live from
 * the hub's own build on this origin (`/ops/embed/v1.js`) and mounted as its
 * `<ops-hub>` custom element. The hub isn't a Commons app and deploys on its
 * own; docs/ops-hub-contract.md is the contract. Its requests go to the hub's
 * action server (`/ops/api`), not the Commons API, so they are outside the
 * src/api/client.ts rule.
 */

export type OpsTheme = "light" | "dark" | "system";

interface MountOptions {
  apiBase: string;
  embedded: boolean;
  theme: OpsTheme;
  forcedColors: boolean;
  onError: (err: unknown) => void;
}

export interface OpsMountHandle {
  unmount(): void;
  setTheme(theme: OpsTheme, forcedColors?: boolean): void;
}

export interface OpsHubModule {
  mount(el: Element, opts: MountOptions): OpsMountHandle;
  unmount(el?: Element): void;
}

export function isOpsHubModule(mod: unknown): mod is OpsHubModule {
  const m = mod as Partial<OpsHubModule> | null;
  return !!m && typeof m.mount === "function" && typeof m.unmount === "function";
}

/** True when the action server answers. */
export async function opsHubHealthy(signal: AbortSignal): Promise<boolean> {
  try {
    const res = await fetch(healthUrl(), { cache: "no-store", credentials: "same-origin", signal });
    return res.ok;
  } catch {
    return false;
  }
}

/** The host page's theme, as the element understands it. */
export function currentTheme(root: HTMLElement = document.documentElement): OpsTheme {
  const t = root.getAttribute("data-theme");
  return t === "light" || t === "dark" ? t : "system";
}

function forcedColorsQuery(): MediaQueryList | null {
  return typeof window.matchMedia === "function" ? window.matchMedia("(forced-colors: active)") : null;
}

type Status = "loading" | "mounted" | "unreachable" | "crashed";

export interface OpsPanelViewProps {
  /** The loader seam (tests inject a fake hub). Default: the page's shared module (hubModule.ts). */
  load?: () => Promise<unknown>;
  /** The health check seam. */
  checkHealth?: (signal: AbortSignal) => Promise<boolean>;
  timeoutMs?: number;
}

export function OpsPanelView({
  load = loadOpsHub,
  checkHealth = opsHubHealthy,
  timeoutMs = OPS_TIMEOUT_MS,
}: OpsPanelViewProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<OpsMountHandle | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [attempt, setAttempt] = useState(0);

  // Load, check and mount. `cancelled` stops a mount after the tab is left
  // mid-load; the cleanup unmounts exactly what this run mounted (StrictMode
  // runs it twice: the first run never mounts, or is unmounted at once).
  useEffect(() => {
    let cancelled = false;
    let handle: OpsMountHandle | null = null;
    const abort = new AbortController();
    setStatus("loading");

    void (async () => {
      let mod: unknown;
      let healthy = false;
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        [mod, healthy] = await Promise.race([
          Promise.all([load(), checkHealth(abort.signal)]),
          new Promise<never>((_, reject) => {
            timer = setTimeout(() => reject(new Error("timed out")), timeoutMs);
          }),
        ]);
      } catch {
        healthy = false;
      } finally {
        clearTimeout(timer);
      }
      if (cancelled) return;
      const el = hostRef.current;
      if (!healthy || !isOpsHubModule(mod) || !el) {
        // Keep the last badge (the background count's, or none).
        setStatus("unreachable");
        return;
      }
      const crash = (err: unknown) => {
        if (cancelled) return;
        console.error("ops hub:", err);
        handle?.unmount();
        handle = null;
        handleRef.current = null;
        setStatus("crashed");
      };
      try {
        handle = mod.mount(el, {
          apiBase: OPS_API_BASE,
          embedded: true,
          theme: currentTheme(),
          forcedColors: forcedColorsQuery()?.matches ?? false,
          onError: crash,
        });
        handleRef.current = handle;
        setStatus("mounted");
      } catch (err) {
        crash(err);
      }
    })();

    return () => {
      cancelled = true;
      abort.abort();
      handle?.unmount();
      handle = null;
      handleRef.current = null;
    };
  }, [attempt, load, checkHealth, timeoutMs]);

  // While the hub is mounted its count events drive the badge; the
  // background poll (background.ts) stands down.
  useEffect(() => {
    if (status !== "mounted") return;
    return opsPanelMounted();
  }, [status]);

  // Theme passthrough: CSS custom properties already inherit into the shadow
  // DOM; setTheme covers what they can't reach.
  useEffect(() => {
    if (status !== "mounted") return;
    const root = document.documentElement;
    const query = forcedColorsQuery();
    const push = () => handleRef.current?.setTheme(currentTheme(root), query?.matches ?? false);
    const observer = new MutationObserver(push);
    observer.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    query?.addEventListener?.("change", push);
    return () => {
      observer.disconnect();
      query?.removeEventListener?.("change", push);
    };
  }, [status]);

  // The tab badge: "Needs you" items only, from the element's count event.
  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const onCount = (event: Event) => {
      const detail = (event as CustomEvent<{ needsYou?: unknown }>).detail;
      reportOpsCount(typeof detail?.needsYou === "number" ? detail.needsYou : 0);
    };
    el.addEventListener("ops-hub:count", onCount);
    return () => el.removeEventListener("ops-hub:count", onCount);
  }, []);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  return (
    <div className="ops-panel">
      {status === "loading" && <OpsSkeleton />}
      {status === "unreachable" && <OpsNotice message="The ops hub isn't answering." onRetry={retry} />}
      {status === "crashed" && <OpsNotice message="Something went wrong in this tab." onRetry={retry} />}
      <div ref={hostRef} className="ops-panel__host" hidden={status !== "mounted"} data-testid="ops-host" />
    </div>
  );
}

function OpsSkeleton() {
  return (
    <div className="ops-skeleton" role="status">
      <span className="visually-hidden">Loading Ops…</span>
      <div className="ops-skeleton__line ops-skeleton__line--title" aria-hidden="true" />
      <div className="ops-skeleton__row" aria-hidden="true" />
      <div className="ops-skeleton__row" aria-hidden="true" />
      <div className="ops-skeleton__row" aria-hidden="true" />
      <div className="ops-skeleton__line ops-skeleton__line--short" aria-hidden="true" />
    </div>
  );
}

export function OpsNotice({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="ops-notice">
      <p className="ops-notice__text">{message}</p>
      <div className="ops-notice__actions">
        <Button variant="secondary" onClick={onRetry}>
          Retry
        </Button>
        <a className="ops-notice__link" href={standaloneUrl()}>
          Open the standalone dashboard
        </a>
      </div>
    </div>
  );
}

export default function OpsPanel() {
  return <OpsPanelView />;
}
