/**
 * Where the ops hub micro-frontend lives on the private site (docs/ops-hub-contract.md).
 *
 * Paths only, always resolved against `location.origin`: the source is public,
 * so no host name is ever written here. On the private Commons (:8445) these
 * paths are served by the hub's own `tailscale serve` handlers, not by Commons.
 */

/** The tab's id (src/tabs/defs/ops.ts). The panel reports its badge under it. */
export const OPS_TAB_ID = "ops";

/** The hub's standalone page, the same build at a path on this origin. */
export const OPS_PAGE_PATH = "/ops/";

/** The stable loader (re-exports the hashed bundle). */
export const OPS_LOADER_PATH = "/ops/embed/v1.js";

/** The action server, passed to the element as `apiBase`. */
export const OPS_API_BASE = "/ops/api";

/** Answers 200 when the action server is up. */
export const OPS_HEALTH_PATH = "/ops/api/healthz";

/** Loading the loader and the health check together must finish within this. */
export const OPS_TIMEOUT_MS = 4000;

function origin(): string {
  return window.location.origin;
}

/**
 * The loader URL with a minute cache-buster: `tailscale serve` sends no cache
 * headers, so a new hub deploy shows up within a minute.
 */
export function loaderUrl(now: number = Date.now(), base: string = origin()): string {
  return new URL(`${OPS_LOADER_PATH}?t=${Math.floor(now / 60000)}`, base).href;
}

export function healthUrl(base: string = origin()): string {
  return new URL(OPS_HEALTH_PATH, base).href;
}

export function standaloneUrl(base: string = origin()): string {
  return new URL(OPS_PAGE_PATH, base).href;
}
