/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL pública do backend (ex.: https://api.seudominio.com). Vazio: usa /api no mesmo domínio, via Worker. */
  readonly VITE_API_URL?: string
}
interface ImportMeta { readonly env: ImportMetaEnv }
