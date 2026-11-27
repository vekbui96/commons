/**
 * NFC controls, public side (docs/nfc-controls-contract.md). Safe for the
 * public bundle: the paths here are public ones only. Private paths live in
 * privateConfig.ts, imported only by the private tab.
 *
 * The public runner (#/t/<id>?k=<key>) exists only in the public build, and
 * only when VITE_NFC_GATEWAY is set at build time (a repo *variable*, never in
 * src/). Its value is the gateway's exact public origin + /public/v1, the one
 * tailnet-named host scripts/check-dist.mjs allows in the public bundle.
 */

/** The public gateway base (no trailing slash), or "" when this build has no runner. */
export const NFC_GATEWAY: string = (import.meta.env.VITE_NFC_GATEWAY ?? "").trim().replace(/\/+$/, "");

/** The static backup copy of the public tags (used only when the gateway is down), or "". */
export const NFC_FALLBACK: string = (import.meta.env.VITE_NFC_FALLBACK ?? "").trim();

/** The runner's loader on this repo's sibling Pages site (same origin as the public Commons). */
export const NFC_PUBLIC_LOADER_PATH = "/nfc-controls/embed/v1.js";

/** Loading the public loader must finish within this (a cold load on cellular). */
export const NFC_PUBLIC_TIMEOUT_MS = 10000;

/** Where a tag's key is kept for a reload in the same tab: sessionStorage[`nfc.key.<id>`]. */
export const KEY_STORAGE_PREFIX = "nfc.key.";

/**
 * A loader URL with a minute cache-buster (Pages and tailscale serve both
 * cache the stable loader name; the bundle it points at is content-hashed).
 */
export function loaderUrl(
  path: string,
  now: number = Date.now(),
  base: string = window.location.origin,
): string {
  return new URL(`${path}?t=${Math.floor(now / 60000)}`, base).href;
}
