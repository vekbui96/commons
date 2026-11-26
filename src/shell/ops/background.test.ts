import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getTabBadge, resetTabBadges } from "../tabBadges";
import {
  OPS_COUNT_INTERVAL_MS,
  opsPanelMounted,
  reportOpsCount,
  resetOpsCountState,
  startOpsCount,
} from "./background";
import { OPS_API_BASE, OPS_TAB_ID } from "./config";
import { loadOpsHub, resetOpsHubModule } from "./hubModule";

const MIN = 60_000;

let visibility: DocumentVisibilityState = "visible";
function setVisibility(v: DocumentVisibilityState) {
  visibility = v;
  document.dispatchEvent(new Event("visibilitychange"));
}

/** A fake hub module whose fetchCount answers from a queue (a number, or an Error to reject). */
function fakeHub(answers: (number | Error)[] = []) {
  const fetchCount = vi.fn(async (opts: { apiBase: string; signal?: AbortSignal }) => {
    void opts;
    const next = answers.length > 1 ? answers.shift()! : answers[0];
    if (next === undefined) return { needsYou: 0, stale: false };
    if (next instanceof Error) throw next;
    return { needsYou: next, stale: false };
  });
  const load = vi.fn(() => Promise.resolve({ fetchCount, mount() {}, unmount() {} }));
  return { fetchCount, load };
}

const badge = () => getTabBadge(OPS_TAB_ID);
let stop: (() => void) | undefined;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(10 * 60 * MIN);
  visibility = "visible";
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => visibility });
  resetTabBadges();
  resetOpsCountState();
  resetOpsHubModule();
});
afterEach(() => {
  stop?.();
  stop = undefined;
  vi.useRealTimers();
  // Restore jsdom's own getter.
  delete (document as { visibilityState?: unknown }).visibilityState;
});

describe("ops background count", () => {
  it("counts at load, then at most every 5 minutes, through /ops/api", async () => {
    const hub = fakeHub([2, 4]);
    stop = startOpsCount({ load: hub.load });
    await vi.advanceTimersByTimeAsync(0);
    expect(hub.fetchCount).toHaveBeenCalledTimes(1);
    expect(hub.fetchCount.mock.calls[0]![0].apiBase).toBe(OPS_API_BASE);
    expect(badge()).toBe(2);

    await vi.advanceTimersByTimeAsync(OPS_COUNT_INTERVAL_MS - 1);
    expect(hub.fetchCount).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(hub.fetchCount).toHaveBeenCalledTimes(2);
    expect(badge()).toBe(4);

    await vi.advanceTimersByTimeAsync(3 * OPS_COUNT_INTERVAL_MS);
    expect(hub.fetchCount).toHaveBeenCalledTimes(5);
    expect(OPS_COUNT_INTERVAL_MS).toBe(5 * MIN);
  });

  it("stops while hidden and, on visible, fetches once only if the last count is over 5 minutes old", async () => {
    const hub = fakeHub([1]);
    stop = startOpsCount({ load: hub.load });
    await vi.advanceTimersByTimeAsync(0);
    expect(hub.fetchCount).toHaveBeenCalledTimes(1);

    setVisibility("hidden");
    await vi.advanceTimersByTimeAsync(30 * MIN);
    expect(hub.fetchCount).toHaveBeenCalledTimes(1);

    setVisibility("visible");
    await vi.advanceTimersByTimeAsync(0);
    expect(hub.fetchCount).toHaveBeenCalledTimes(2);

    // Hidden and back within 5 minutes: no extra fetch; the next one keeps its slot.
    await vi.advanceTimersByTimeAsync(MIN);
    setVisibility("hidden");
    await vi.advanceTimersByTimeAsync(MIN);
    setVisibility("visible");
    await vi.advanceTimersByTimeAsync(0);
    expect(hub.fetchCount).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(3 * MIN);
    expect(hub.fetchCount).toHaveBeenCalledTimes(3);
  });

  it("does nothing while the page loads hidden", async () => {
    visibility = "hidden";
    const hub = fakeHub([1]);
    stop = startOpsCount({ load: hub.load });
    await vi.advanceTimersByTimeAsync(20 * MIN);
    expect(hub.load).not.toHaveBeenCalled();
    expect(badge()).toBe(0);
  });

  it("stands down while the Ops panel is mounted and its count events win", async () => {
    const hub = fakeHub([5]);
    stop = startOpsCount({ load: hub.load });
    await vi.advanceTimersByTimeAsync(0);
    expect(badge()).toBe(5);

    const release = opsPanelMounted();
    reportOpsCount(1);
    expect(badge()).toBe(1);
    await vi.advanceTimersByTimeAsync(30 * MIN);
    expect(hub.fetchCount).toHaveBeenCalledTimes(1);
    expect(badge()).toBe(1);

    // The panel's last count is fresh: leaving the tab waits 5 minutes from it.
    reportOpsCount(2);
    release();
    await vi.advanceTimersByTimeAsync(OPS_COUNT_INTERVAL_MS - 1);
    expect(hub.fetchCount).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(hub.fetchCount).toHaveBeenCalledTimes(2);
    expect(badge()).toBe(5);
  });

  it("drops a poll answer that lands after the panel mounted", async () => {
    let answer!: (v: { needsYou: number; stale: boolean }) => void;
    const fetchCount = vi.fn(() => new Promise<{ needsYou: number; stale: boolean }>((r) => (answer = r)));
    stop = startOpsCount({ load: () => Promise.resolve({ fetchCount }) });
    await vi.advanceTimersByTimeAsync(0);
    const release = opsPanelMounted();
    reportOpsCount(7);
    answer({ needsYou: 9, stale: false });
    await vi.advanceTimersByTimeAsync(0);
    expect(badge()).toBe(7);
    release();
  });

  it("keeps the last badge, silently, when a count is rejected or the import fails", async () => {
    const hub = fakeHub([3, new Error("503"), new Error("bad json"), 6]);
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    stop = startOpsCount({ load: hub.load });
    await vi.advanceTimersByTimeAsync(0);
    expect(badge()).toBe(3);
    await vi.advanceTimersByTimeAsync(OPS_COUNT_INTERVAL_MS);
    expect(badge()).toBe(3);
    await vi.advanceTimersByTimeAsync(OPS_COUNT_INTERVAL_MS);
    expect(badge()).toBe(3);
    await vi.advanceTimersByTimeAsync(OPS_COUNT_INTERVAL_MS);
    expect(badge()).toBe(6);
    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
  });

  it("shows no badge when the very first count fails", async () => {
    stop = startOpsCount({ load: () => Promise.reject(new Error("no loader")) });
    await vi.advanceTimersByTimeAsync(0);
    expect(badge()).toBe(0);
  });

  it("stop() clears the timer and aborts an in-flight count", async () => {
    let signal: AbortSignal | undefined;
    const fetchCount = vi.fn((opts: { signal?: AbortSignal }) => {
      signal = opts.signal;
      return new Promise<never>(() => {});
    });
    const halt = startOpsCount({ load: () => Promise.resolve({ fetchCount }) });
    await vi.advanceTimersByTimeAsync(0);
    halt();
    expect(signal?.aborted).toBe(true);
    await vi.advanceTimersByTimeAsync(60 * MIN);
    expect(fetchCount).toHaveBeenCalledTimes(1);
  });
});

describe("the shared hub module", () => {
  it("imports once for every caller, and again after a failure", async () => {
    const mod = {};
    const importer = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue(mod);
    await expect(loadOpsHub(importer)).rejects.toThrow("offline");
    const [a, b] = await Promise.all([loadOpsHub(importer), loadOpsHub(importer)]);
    expect(a).toBe(mod);
    expect(b).toBe(mod);
    expect(importer).toHaveBeenCalledTimes(2);
  });

  it("is what the poller uses by default, so the panel later reuses its import", async () => {
    const hub = fakeHub([1]);
    const importer = vi.fn(hub.load);
    // Warm the shared module the way the poller's default does.
    await loadOpsHub(importer);
    stop = startOpsCount();
    await vi.advanceTimersByTimeAsync(0);
    await loadOpsHub(importer);
    expect(importer).toHaveBeenCalledTimes(1);
    expect(hub.fetchCount).toHaveBeenCalledTimes(1);
  });
});
