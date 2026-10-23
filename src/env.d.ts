/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the DR4 epoch-data proxy (see proxy/). Unset: preview data only. */
  readonly VITE_DR4_PROXY?: string;
}
