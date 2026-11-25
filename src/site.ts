/**
 * Which Commons this bundle is: the public one on GitHub Pages, or the private
 * one served tailnet-only from server-pc. Fixed at build time by COMMONS_TARGET
 * (see build/target.ts). The public bundle contains no private app at all.
 */
export type SiteTarget = "public" | "private";

export const SITE_TARGET: SiteTarget = import.meta.env.COMMONS_TARGET === "private" ? "private" : "public";

export function isPrivateSite(target: SiteTarget = SITE_TARGET): boolean {
  return target === "private";
}
