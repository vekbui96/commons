import { availableTabs } from "@/tabs/registry";
import type { TabDefinition } from "@/tabs/types";

/**
 * Starts the background work of every tab on this site that has some (a
 * panel's `background`, private tabs only), once, at page load. The public
 * build has no such tab: private defs are cut from its bundle, and
 * availableTabs drops them anyway. A module that fails to import is skipped
 * quietly. Returns a function that stops everything (tests).
 */
export function startTabBackgrounds(tabs: readonly TabDefinition[] = availableTabs()): () => void {
  const stops: (() => void)[] = [];
  let stopped = false;
  for (const tab of tabs) {
    if (tab.kind !== "panel" || !tab.background) continue;
    tab
      .background()
      .then((mod) => {
        const stop = mod.default();
        if (stopped) stop();
        else stops.push(stop);
      })
      .catch(() => {});
  }
  return () => {
    stopped = true;
    stops.splice(0).forEach((stop) => stop());
  };
}
