import type { AppTint } from "@/ui/tints";

/**
 * An app's manifest: the only thing the homepage needs to know about it.
 *
 * Each app lives in `src/apps/<id>/` with a `manifest.ts` default-exporting one
 * of these (via `defineApp`). Internal apps also have an `App.tsx` default-
 * exporting a component, which is lazy-loaded at `#/apps/<id>`.
 */

/** `internal`: a route inside Commons. `external`: a link to a site elsewhere. */
export type AppKind = "internal" | "external";

/**
 * `public`: in both builds, listed for everyone.
 * `private`: only in the private, tailnet-only build. The public build cuts it
 * out of the bundle (build/target.ts reads this field from the source, so keep
 * it a plain string literal).
 */
export type AppVisibility = "public" | "private";

interface ManifestBase {
  /** Kebab-case, unique, and equal to the app's folder name. */
  id: string;
  /** Short display name. */
  name: string;
  /** One line, shown under the name. */
  description: string;
  /** One or two characters (a letter or a symbol), shown in the tile's mark. */
  icon: string;
  /** Tile colour from the fixed set in src/ui/tints.ts (default "cobalt"). */
  tint?: AppTint;
  visibility: AppVisibility;
}

export interface InternalAppManifest extends ManifestBase {
  kind: "internal";
}

export interface ExternalAppManifest extends ManifestBase {
  kind: "external";
  /** Absolute https URL. */
  url: string;
}

export type AppManifest = InternalAppManifest | ExternalAppManifest;

/** Identity helper so manifests are type-checked where they are written. */
export function defineApp<T extends AppManifest>(manifest: T): T {
  return manifest;
}
