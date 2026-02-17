/// <reference types="vite/client" />

declare const __APP_VERSION__: string;
declare const __BUILD_TIME__: string;

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_AUTH_MODE: 'stub' | 'logto';
  readonly VITE_ENV_NAME: string;
  readonly VITE_LOGTO_ENDPOINT: string;
  readonly VITE_LOGTO_APP_ID: string;
  readonly VITE_LOGTO_API_RESOURCE: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
