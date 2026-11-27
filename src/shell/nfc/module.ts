/**
 * The <nfc-controls> loader module (embed/v1.js), imported once per page per
 * URL path and shared (the early start in main.tsx and the route use the same
 * import). A failed import is forgotten, so the next caller tries again.
 * Contract: docs/nfc-controls-contract.md, "Mount API".
 */

export type NfcTheme = "light" | "dark" | "system";

export interface NfcMountOptions {
  mode: "runner" | "editor";
  source: "public" | "private";
  tagId?: string;
  tagKey?: string;
  apiBase: string;
  sessionUrl?: string;
  fallbackUrl?: string;
  embedded: boolean;
  theme: NfcTheme;
  forcedColors: boolean;
  onError: (err: unknown) => void;
}

export interface NfcMountHandle {
  unmount(): void;
  setTheme(theme: NfcTheme, forcedColors?: boolean): void;
}

export interface NfcModule {
  mount(el: Element, opts: NfcMountOptions): NfcMountHandle;
  unmount(el?: Element): void;
  preload?(opts: { tagId: string; tagKey: string; apiBase: string }): void;
}

export function isNfcModule(mod: unknown): mod is NfcModule {
  const m = mod as Partial<NfcModule> | null;
  return !!m && typeof m.mount === "function" && typeof m.unmount === "function";
}

const shared = new Map<string, Promise<unknown>>();

/** Imports the loader at `path` (same origin, minute cache-buster). */
export function loadNfc(
  path: string,
  importer: (url: string) => Promise<unknown> = (url) => import(/* @vite-ignore */ url),
  url: () => string = () =>
    new URL(`${path}?t=${Math.floor(Date.now() / 60000)}`, window.location.origin).href,
): Promise<unknown> {
  let attempt = shared.get(path);
  if (!attempt) {
    attempt = importer(url());
    shared.set(path, attempt);
    const mine = attempt;
    mine.catch(() => {
      if (shared.get(path) === mine) shared.delete(path);
    });
  }
  return attempt;
}

/** For tests. */
export function resetNfcModules(): void {
  shared.clear();
}

/** The host page's theme, as the element understands it. */
export function currentTheme(root: HTMLElement = document.documentElement): NfcTheme {
  const t = root.getAttribute("data-theme");
  return t === "light" || t === "dark" ? t : "system";
}

export function forcedColorsQuery(): MediaQueryList | null {
  return typeof window.matchMedia === "function" ? window.matchMedia("(forced-colors: active)") : null;
}
