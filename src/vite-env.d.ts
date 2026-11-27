/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Commons API base URL (no trailing slash). Unset = no backend. */
  readonly VITE_COMMONS_API?: string;
  /**
   * Public NFC tag gateway base (e.g. <origin>/public/v1), from the repo variable
   * NFC_GATEWAY in the Pages workflow. "" = no public tag route in this build.
   */
  readonly VITE_NFC_GATEWAY: string;
  /** The static backup copy of the public tags (used when the gateway is down). "" = none. */
  readonly VITE_NFC_FALLBACK: string;
  /** Build target, set by vite.config.ts from COMMONS_TARGET (build/target.ts). */
  readonly COMMONS_TARGET: "public" | "private";
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
