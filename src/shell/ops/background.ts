import { setTabBadge } from "../tabBadges";
import type { TabBackground } from "@/tabs/types";
import { OPS_API_BASE, OPS_TAB_ID } from "./config";
import { loadOpsHub } from "./hubModule";

/**
 * The Ops chip badge while the Ops tab is NOT open (private build only; the
 * tab def's `background` imports this file, and the public build has no such
 * def). docs/ops-hub-contract.md, "Badge without mounting":
 *
 * - `fetchCount` at most every 5 minutes, only while the page is visible;
 *   stop on hidden, and on visible fetch once if the last count is older
 *   than 5 minutes.
 * - While the Ops panel has the hub mounted, its `ops-hub:count` events win
 *   and this poll stops (the element polls every 60 s itself).
 * - A failed count keeps the last badge (or none), silently.
 */

export const OPS_COUNT_INTERVAL_MS = 5 * 60_000;

interface Count {
  needsYou: number;
  stale: boolean;
}
type FetchCount = (opts: { apiBase: string; signal?: AbortSignal }) => Promise<Count>;

function fetchCountOf(mod: unknown): FetchCount | null {
  const f = (mod as { fetchCount?: unknown } | null)?.fetchCount;
  return typeof f === "function" ? (f as FetchCount) : null;
}

// ---- The panel's side: it says when the hub is mounted and what it counted.

let panelsMounted = 0;
let lastCountAt = Number.NEGATIVE_INFINITY;
const panelListeners = new Set<() => void>();

function notifyPanel(): void {
  panelListeners.forEach((l) => l());
}

/** The Ops panel calls this when the hub is mounted; call the result when it goes. */
export function opsPanelMounted(): () => void {
  panelsMounted++;
  notifyPanel();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    panelsMounted--;
    notifyPanel();
  };
}

/** The Ops panel reports each `ops-hub:count`; a fresh count delays the next poll. */
export function reportOpsCount(needsYou: number, now: number = Date.now()): void {
  lastCountAt = now;
  setTabBadge(OPS_TAB_ID, needsYou);
}

// ---- The poller.

export interface OpsCountOptions {
  load?: () => Promise<unknown>;
  doc?: Document;
  now?: () => number;
  intervalMs?: number;
}

export function startOpsCount({
  load = loadOpsHub,
  doc = document,
  now = Date.now,
  intervalMs = OPS_COUNT_INTERVAL_MS,
}: OpsCountOptions = {}): () => void {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let inFlight: AbortController | null = null;

  const active = () => !stopped && doc.visibilityState === "visible" && panelsMounted === 0;

  function clear() {
    clearTimeout(timer);
    timer = undefined;
  }

  function schedule() {
    clear();
    if (!active() || inFlight) return;
    const wait = Math.max(0, lastCountAt + intervalMs - now());
    timer = setTimeout(() => void poll(), wait);
  }

  async function poll() {
    timer = undefined;
    if (!active() || inFlight) return;
    lastCountAt = now();
    const abort = new AbortController();
    inFlight = abort;
    try {
      const fetchCount = fetchCountOf(await load());
      if (!fetchCount) throw new Error("the hub has no fetchCount");
      const { needsYou } = await fetchCount({ apiBase: OPS_API_BASE, signal: abort.signal });
      // The mounted panel's own count wins over one that landed late.
      if (!stopped && panelsMounted === 0) setTabBadge(OPS_TAB_ID, needsYou);
    } catch {
      // Keep the last badge, or none. No error UI.
    } finally {
      if (inFlight === abort) inFlight = null;
      schedule();
    }
  }

  const onChange = () => schedule();
  doc.addEventListener("visibilitychange", onChange);
  panelListeners.add(onChange);
  schedule();

  return () => {
    stopped = true;
    clear();
    inFlight?.abort();
    doc.removeEventListener("visibilitychange", onChange);
    panelListeners.delete(onChange);
  };
}

/** For tests. */
export function resetOpsCountState(): void {
  panelsMounted = 0;
  lastCountAt = Number.NEGATIVE_INFINITY;
}

const start: TabBackground = () => startOpsCount();
export default start;
