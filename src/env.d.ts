/// <reference path="../.astro/types.d.ts" />

interface ImportMetaEnv {
  readonly ADMIN_TOKEN?: string;
  readonly IMPULSE_CRM_URL?: string;
  readonly IMPULSE_CRM_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}