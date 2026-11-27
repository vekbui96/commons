import { KEY_STORAGE_PREFIX } from "./config";

/**
 * The public tag link is `#/t/<id>?k=<key>`. The key is taken out of the
 * address bar at once (history.replaceState), kept in sessionStorage only so
 * a reload in the same tab still works, passed to the runner as a mount option
 * and never logged. The fragment never reaches the Pages server.
 */

const ROUTE = /^#\/t\/([a-z0-9]+(?:-[a-z0-9]+)*)(?:\?(.*))?$/;

export interface TagRoute {
  id: string;
  key: string | null;
}

/** The tag id and key in a `#/t/<id>?k=<key>` hash, or null when it isn't a tag link. */
export function parseTagHash(hash: string): TagRoute | null {
  const m = ROUTE.exec(hash);
  if (!m || m[1]!.length > 32) return null;
  const key = new URLSearchParams(m[2] ?? "").get("k");
  return { id: m[1]!, key: key || null };
}

function storage(win: Window): Storage | null {
  try {
    return win.sessionStorage;
  } catch {
    return null;
  }
}

/**
 * Takes the key for tag `id`: from the hash (then strips it from the address
 * bar and keeps it in sessionStorage), else from sessionStorage. Idempotent.
 */
export function takeTagKey(id: string, win: Window = window): string | null {
  const route = parseTagHash(win.location.hash);
  const store = storage(win);
  if (route && route.id === id && route.key) {
    try {
      store?.setItem(KEY_STORAGE_PREFIX + id, route.key);
    } catch {
      // storage full or blocked: the key still works for this page view
    }
    const url = new URL(win.location.href);
    url.hash = `#/t/${id}`;
    win.history.replaceState(win.history.state, "", url.href);
    return route.key;
  }
  try {
    return store?.getItem(KEY_STORAGE_PREFIX + id) ?? null;
  } catch {
    return null;
  }
}
