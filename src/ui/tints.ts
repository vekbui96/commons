/**
 * The fixed set of app icon tints (blue family + neutrals). Each name has
 * --tint-<name>-bg / --tint-<name>-fg roles in src/styles/tokens.css, in light
 * and dark. Only the homepage icon tile (.ui-mark) uses them.
 */
export const APP_TINTS = ["cobalt", "indigo", "steel", "slate", "stone"] as const;

export type AppTint = (typeof APP_TINTS)[number];

export const DEFAULT_TINT: AppTint = "cobalt";

export function isAppTint(value: unknown): value is AppTint {
  return typeof value === "string" && (APP_TINTS as readonly string[]).includes(value);
}
