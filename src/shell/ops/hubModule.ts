import { loaderUrl } from "./config";

/**
 * The hub's loader module (`/ops/embed/v1.js`), imported once per page and
 * shared by the Ops panel and the background count (background.ts), so
 * opening the tab after the badge poll never imports it twice. A failed
 * import is forgotten, so the next caller tries again.
 */

/** Imports the hub's loader. No host is written anywhere: the URL comes from location.origin. */
export function importOpsHub(): Promise<unknown> {
  return import(/* @vite-ignore */ loaderUrl());
}

let shared: Promise<unknown> | null = null;

export function loadOpsHub(importer: () => Promise<unknown> = importOpsHub): Promise<unknown> {
  if (!shared) {
    const attempt = importer();
    shared = attempt;
    attempt.catch(() => {
      if (shared === attempt) shared = null;
    });
  }
  return shared;
}

/** For tests. */
export function resetOpsHubModule(): void {
  shared = null;
}
