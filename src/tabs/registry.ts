import { SITE_TARGET, type SiteTarget } from "@/site";
import { listedApps, type RegisteredApp } from "@/registry/registry";
import type { AppsTab, LinkTab, PageTab, PanelTab, TabDefinition } from "./types";

/**
 * The tab registry, discovered at build time like the app registry. Adding a
 * tab means adding `src/tabs/defs/<id>.ts`; nothing here needs to change.
 */

// "!./defs/__private_tabs_excluded__.ts" is a placeholder: for the public
// build, build/target.ts swaps it for one negative pattern per private tab
// file, so private tabs never enter the public bundle. Keep it.
const tabModules = import.meta.glob<{ default: TabDefinition }>(
  ["./defs/*.ts", "!./defs/*.test.ts", "!./defs/__private_tabs_excluded__.ts"],
  { eager: true },
);

export interface RegisteredTab {
  /** File name under src/tabs/defs/, without ".ts". */
  file: string;
  tab: TabDefinition;
}

export const tabRegistry: readonly RegisteredTab[] = Object.entries(tabModules).map(([path, mod]) => ({
  file: path.split("/").at(-1)!.replace(/\.ts$/, ""),
  tab: mod.default,
}));

/** Tabs a user can select (an apps list, a page or a panel). Link tabs only open their URL. */
export type SelectableTab = AppsTab | PageTab | PanelTab;

export function isSelectable(tab: TabDefinition): tab is SelectableTab {
  return tab.kind === "apps" || tab.kind === "page" || tab.kind === "panel";
}

/** Tabs on this site, in carousel order (order, then label). */
export function availableTabs(
  tabs: readonly RegisteredTab[] = tabRegistry,
  target: SiteTarget = SITE_TARGET,
): TabDefinition[] {
  return tabs
    .map(({ tab }) => tab)
    .filter((tab) => target === "private" || tab.visibility === "public")
    .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label));
}

/** The tab `#/` shows: the first selectable tab in carousel order. */
export function defaultTab(tabs: readonly TabDefinition[]): SelectableTab | undefined {
  return tabs.find(isSelectable);
}

/** The selectable tab for a URL id; unknown, unavailable or link ids fall back to the default. */
export function resolveTab(
  id: string | undefined,
  tabs: readonly TabDefinition[],
): SelectableTab | undefined {
  const match = tabs.find((tab) => tab.id === id);
  return match && isSelectable(match) ? match : defaultTab(tabs);
}

/** The hash-router path of a tab: `/` for the default tab, `/tab/<id>` otherwise. */
export function tabPath(id: string, tabs: readonly TabDefinition[]): string {
  return defaultTab(tabs)?.id === id ? "/" : `/tab/${id}`;
}

/** The apps an apps tab lists, from this site's apps. */
export function appsForTab(tab: AppsTab, apps: readonly RegisteredApp[] = listedApps()): RegisteredApp[] {
  return apps.filter((app) => app.manifest.visibility === tab.filter.appVisibility);
}

/** How a link tab opens: https in a new browser tab, in-site routes in this one. */
export function linkTarget(tab: LinkTab): { href: string; newTab: boolean } {
  return { href: tab.url, newTab: /^https:\/\//.test(tab.url) };
}
