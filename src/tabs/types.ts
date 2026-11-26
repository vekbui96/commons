import type { ComponentType } from "react";
import type { AppVisibility } from "@/registry/types";
import type { TabIconName } from "./icons";

/**
 * A homepage tab: one chip in the carousel under the top bar.
 *
 * Each tab is one file, `src/tabs/defs/<id>.ts`, default-exporting a
 * definition made with `defineTab`. The registry discovers them; nothing else
 * needs to change to add one.
 */

/**
 * `public`: in both builds. `private`: only in the private, tailnet-only build;
 * the public build cuts the file out of the bundle (build/target.ts reads this
 * from the source, so keep it a plain string literal, and the only
 * `visibility:` in the file).
 */
export type TabVisibility = "public" | "private";

interface TabBase {
  /** Kebab-case, unique, equal to the file name. Used in the URL: `#/tab/<id>`. */
  id: string;
  /** Short label, shown on the selected chip and as the tooltip otherwise. */
  label: string;
  /** One of the inline SVG icons in src/tabs/icons.tsx. */
  icon: TabIconName;
  visibility: TabVisibility;
  /** Position in the carousel, low first. The lowest available selectable tab is the default. */
  order: number;
}

/** Lists the apps that match a filter. */
export interface AppsTab extends TabBase {
  kind: "apps";
  filter: {
    /** Only apps with this visibility (named appVisibility so the build reads the tab's own visibility). */
    appVisibility: AppVisibility;
  };
}

/** Opens a URL like an external app. Never "selected": choosing it follows the link. */
export interface LinkTab extends TabBase {
  kind: "link";
  /**
   * An absolute https URL (opens in a new tab), an in-site hash route such as
   * `#/apps/units`, or a same-origin path such as `/ops/` (same tab). Never a
   * tailnet hostname: the source is public.
   */
  url: string;
}

/** Renders one internal app inside the tab, without the app bar. */
export interface PageTab extends TabBase {
  kind: "page";
  /** Id of an internal app available wherever this tab is. */
  app: string;
}

/**
 * Renders a shell-level view inside the tab (not an app: it may use the
 * registry and src/profiles, which apps may not import). `load` is a dynamic
 * import, so the view is its own chunk, and a private tab's view never reaches
 * the public bundle (the def file, and with it the import, is cut out).
 */
export interface PanelTab extends TabBase {
  kind: "panel";
  load: () => Promise<{ default: ComponentType }>;
  /**
   * Optional work that runs from page load while the tab is closed (e.g. the
   * Ops chip badge). A dynamic import of a module whose default export starts
   * it and returns a stop function. Private tabs only (validate.ts), so it
   * never reaches the public bundle. Started by src/shell/tabBackgrounds.ts.
   */
  background?: () => Promise<{ default: TabBackground }>;
}

/** Starts a tab's background work; returns a function that stops it. */
export type TabBackground = () => () => void;

export type TabDefinition = AppsTab | LinkTab | PageTab | PanelTab;

/** Identity helper so definitions are type-checked where they are written. */
export function defineTab<T extends TabDefinition>(tab: T): T {
  return tab;
}
