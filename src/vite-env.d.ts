/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Commons API base URL (no trailing slash). Unset = no backend. */
  readonly VITE_COMMONS_API?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
