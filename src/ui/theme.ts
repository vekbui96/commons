/**
 * Light / dark / system theme. "system" removes data-theme so the CSS follows
 * prefers-color-scheme; "light" and "dark" set <html data-theme>. The choice is
 * kept in localStorage (wrapped in try/catch: private windows and blocked
 * storage must still render). index.html applies it before first paint.
 */
export type ThemePreference = "light" | "dark" | "system";

export const THEME_STORAGE_KEY = "commons-theme";

export function readTheme(): ThemePreference {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return value === "light" || value === "dark" ? value : "system";
  } catch {
    return "system";
  }
}

export function applyTheme(pref: ThemePreference, root: HTMLElement = document.documentElement): void {
  if (pref === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", pref);
}

export function saveTheme(pref: ThemePreference): void {
  applyTheme(pref);
  try {
    if (pref === "system") localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, pref);
  } catch {
    // Storage unavailable: the choice lasts for this page view only.
  }
}
