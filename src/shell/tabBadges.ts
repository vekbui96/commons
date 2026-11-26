import { useSyncExternalStore } from "react";

/**
 * Counts shown on tab chips, keyed by tab id. A panel reports its own count
 * (the Ops panel: the hub's "Needs you" items); the carousel shows it, and
 * hides it at 0. In memory only: a count is the last one this page saw.
 */
type Badges = Readonly<Record<string, number>>;

let badges: Badges = {};
const listeners = new Set<() => void>();

export function setTabBadge(tabId: string, count: number): void {
  const next = Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
  if ((badges[tabId] ?? 0) === next) return;
  const copy = { ...badges };
  if (next === 0) delete copy[tabId];
  else copy[tabId] = next;
  badges = copy;
  listeners.forEach((l) => l());
}

/** The count a tab's chip shows now (0 when hidden). */
export function getTabBadge(tabId: string): number {
  return badges[tabId] ?? 0;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function snapshot(): Badges {
  return badges;
}

export function useTabBadges(): Badges {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

/** For tests. */
export function resetTabBadges(): void {
  badges = {};
  listeners.forEach((l) => l());
}
