/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Commons API base URL (no trailing slash). Unset = no backend. */
  readonly VITE_COMMONS_API?: string;
  /** Build target, set by vite.config.ts from COMMONS_TARGET (build/target.ts). */
  readonly COMMONS_TARGET: "public" | "private";
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
