// A configuração do simulador 3D (lab3d): materiais, gases e constantes físicas que a API publica em /sim/config.
// Quem busca é o app, com o endereço da API dele, e entrega ao iframe do simulador por postMessage (LabStage.tsx):
// em produção a API fica em outra origem, e a página do simulador só aceita endereço de configuração da própria
// origem (public/lab3d/model.js, FL.ready). Aqui ficam o pedido, feito uma vez por página, e o que o simulador
// respondeu sobre a configuração que está usando, para a interface poder mostrar.
import { useSyncExternalStore } from 'react'
import { apiUrl } from '../api'

// O simulador espera 5 s pela configuração antes de seguir com a embutida (bridge.js, WAIT_MS); o pedido desiste antes.
const TIMEOUT_MS = 4000
let cache: Promise<unknown> | null = null

/** A configuração publicada pela API, como veio (o simulador confere campo a campo). Uma falha não fica em cache. */
export function loadSimConfig(): Promise<unknown> {
  if (cache) return cache
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), TIMEOUT_MS)
  const p: Promise<unknown> = fetch(apiUrl('/sim/config'), { signal: ctl.signal })
    .then(async (res) => {
      if (!res.ok) throw new Error(`the Atlas API responded with ${res.status}`)
      if (!(res.headers.get('content-type') ?? '').includes('json')) throw new Error('the Atlas API did not answer with JSON')
      const data: unknown = await res.json()
      if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('the Atlas API did not answer with a configuration object')
      return data
    })
    .catch((e) => { throw new Error(e?.name === 'AbortError' ? `no answer from the Atlas API within ${TIMEOUT_MS / 1000} s` : String(e?.message || e)) })
    .finally(() => clearTimeout(timer))
  cache = p
  p.catch(() => { if (cache === p) cache = null })
  return p
}

// from: 'api' = a configuração entregue pelo app; 'embedded' = a embutida no simulador; 'url' = lida pela própria
// página do simulador (só quando ela é aberta com ?config=). reason: por que ficou a embutida.
// source: o nome que a configuração dá a si mesma. problems: o que a validação do simulador recusou (em português).
export interface LabConfig {
  from: 'api' | 'embedded' | 'url'
  reason: 'timeout' | 'unavailable' | 'invalid' | null
  source: string
  problems: string[]
}

/** Lê o campo `config` da mensagem de pronto do simulador; null se ele não disser de onde veio a configuração. */
export function labConfigOf(raw: unknown): LabConfig | null {
  const c = raw as { from?: unknown; reason?: unknown; source?: unknown; problems?: unknown } | null
  if (!c || typeof c !== 'object') return null
  if (c.from !== 'api' && c.from !== 'embedded' && c.from !== 'url') return null
  return {
    from: c.from,
    reason: c.reason === 'timeout' || c.reason === 'unavailable' || c.reason === 'invalid' ? c.reason : null,
    source: typeof c.source === 'string' ? c.source : '',
    problems: Array.isArray(c.problems) ? c.problems.filter((x): x is string => typeof x === 'string') : [],
  }
}

// A configuração em uso pelo simulador aberto no palco (null enquanto ele não está pronto). Fica fora do contexto,
// como o estado da chama (state/labState.ts): só quem mostra isso se inscreve.
let current: LabConfig | null = null
const subs = new Set<() => void>()
export const setLabConfig = (v: LabConfig | null) => { current = v; subs.forEach((f) => f()) }
export const useLabConfig = () => useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f) } }, () => current)
