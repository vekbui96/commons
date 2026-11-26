import { describe, expect, it, vi } from "vitest";
import { tabRegistry, availableTabs } from "@/tabs/registry";
import { defineTab } from "@/tabs/types";
import { startTabBackgrounds } from "./tabBackgrounds";

function panel(id: string, background?: () => Promise<{ default: () => () => void }>) {
  return defineTab({
    id,
    label: id,
    icon: "people",
    kind: "panel",
    load: () => Promise.resolve({ default: () => null }),
    order: 1,
    visibility: "private",
    ...(background ? { background } : {}),
  });
}

describe("startTabBackgrounds", () => {
  it("starts each tab's background once and stops it", async () => {
    const stopOne = vi.fn();
    const start = vi.fn(() => stopOne);
    const stop = startTabBackgrounds([panel("a", () => Promise.resolve({ default: start })), panel("b")]);
    await vi.waitFor(() => expect(start).toHaveBeenCalledTimes(1));
    stop();
    expect(stopOne).toHaveBeenCalledTimes(1);
  });

  it("skips a module that fails to import, and stops one that arrives after stop()", async () => {
    let arrive!: (m: { default: () => () => void }) => void;
    const late = new Promise<{ default: () => () => void }>((r) => (arrive = r));
    const stopLate = vi.fn();
    const stop = startTabBackgrounds([
      panel("bad", () => Promise.reject(new Error("offline"))),
      panel("late", () => late),
    ]);
    stop();
    arrive({ default: () => stopLate });
    await vi.waitFor(() => expect(stopLate).toHaveBeenCalledTimes(1));
  });

  it("starts nothing on the public site", () => {
    const tabs = availableTabs(tabRegistry, "public");
    const spies = tabs.map((t) => (t.kind === "panel" && t.background ? vi.spyOn(t, "background") : null));
    startTabBackgrounds(tabs)();
    expect(spies.filter(Boolean)).toEqual([]);
  });
});
