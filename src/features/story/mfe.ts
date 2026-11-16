// O Mission Fire Engine (stars-beyond/mission-fire-engine): a simulação da missão que o modo história narra.
// O motor roda no backend do Atlas (brain/atlas/mission, servido pela API Go em /api/missions). De onde vêm as missões:
//   - padrão: a API do Atlas simula na hora (GET /api/missions/presets, POST /api/missions/simulations);
//   - se a API não tiver o motor (backend antigo, 404) ou ele não responder (503, queda): public/story/, as mesmas
//     missões calculadas pelo motor e publicadas com o site (scripts/story-snapshots.py; missions.json traz o commit
//     do motor e a data). A página diz qual das duas está em uso.
import { API_BASE, apiUrl } from '../../api/client'
import { localizeMission, localizeResult } from './engineText'

export class MfeError extends Error {}

async function call<T>(path: string, json: unknown | undefined, timeoutMs: number): Promise<T> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const r = await fetch(apiUrl(path), {
      method: json !== undefined ? 'POST' : 'GET',
      headers: json !== undefined ? { 'content-type': 'application/json' } : undefined,
      body: json !== undefined ? JSON.stringify(json) : undefined,
      signal: ctrl.signal,
    })
    const isJson = (r.headers.get('content-type') ?? '').includes('json')
    const data = isJson ? await r.json().catch(() => null) : null
    if (!r.ok) throw new MfeError(typeof data?.error === 'string' ? data.error : `The Atlas API responded with ${r.status}.`)
    if (data === null) throw new MfeError('The Atlas API did not answer with data.')
    return data as T
  } catch (e) {
    if (e instanceof MfeError) throw e
    if ((e as Error).name === 'AbortError') throw new MfeError('The mission engine took too long to answer.')
    throw new MfeError('Could not reach the Atlas API.')
  } finally {
    clearTimeout(timer)
  }
}

// ---- tipos: só o que o modo história lê da resposta do motor (cópia parcial de frontend/src/types.ts do MFE)

export type Tier = 'medido' | 'delimitado' | 'parcial' | 'sem_evidencia'
export type Severity = 'info' | 'atencao' | 'critico'
export type LabMaterial = 'pmma' | 'algodao' | 'retardante'
export type MlDomain = 'ok' | 'borda' | 'gravidade' | 'o2' | 'pressao' | 'fluxo'

export interface MissionConfig {
  label: string; profile: string
  spacecraft: { crew: number; ventilation_cm_s: number; component: { name: string; operational_limit_k: number; material: LabMaterial } & Record<string, unknown> } & Record<string, unknown>
  [k: string]: unknown
}

export interface MissionEvent {
  id: string; day: number; kind: string; severity: Severity; title: string; description: string; classification: string
}

export interface Series {
  habitat: string[]; t_day: number[]; r_au: number[]; x_au: number[]; y_au: number[]
  earth_x: number[]; earth_y: number[]; dest_x: number[]; dest_y: number[]
  solar_flux_w_m2: number[]; gravity_g: number[]; component_k: number[]; margin_k: number[]
  pressure_kpa: number[]; oxygen_pct: number[]; ventilation_cm_s: number[]; phase: string[]; evidence_tier: Tier[]
  // modelo treinado (Atlas-MachineL): null onde a condição sai do domínio de treino; ausentes sem a tabela
  ml_spread_mm_s?: (number | null)[]; ml_spread_sd_mm_s?: (number | null)[]; ml_spread_ratio?: (number | null)[]; ml_domain?: MlDomain[]
}

export interface Summary {
  hours_over_limit: number; hours_outside_tabulated: number; evidence_share: Record<Tier, number>
  ml_spread_max_ratio?: number | null; ml_spread_max_day?: number | null; hours_ml_in_domain?: number | null
}

export interface SimResult {
  simulation_id: string; label: string
  profile: { id: string; name: string; description: string; destination: string | null; transit_days: number; surface_days: number }
  series: Series; events: MissionEvent[]; summary: Summary; config: MissionConfig
}

export interface Presets {
  scenarios: Record<string, { name: string; description: string; config: MissionConfig }>
  materials: Record<LabMaterial, string>
}

// as missões publicadas com o site: índice com a origem e um arquivo por missão
interface Snapshots {
  source: string; engine_commit: string; engine_commit_date: string; generated_at: string
  missions: Record<string, { name: string; description: string; file: string }>
}
async function file<T>(path: string): Promise<T> {
  const r = await fetch(`/story/${path}`).catch(() => null)
  if (!r?.ok || !(r.headers.get('content-type') ?? '').includes('json')) throw new MfeError('The precomputed missions could not be loaded.')
  return r.json() as Promise<T>
}

export interface Mission { id: string; name: string; description: string }
// live: o motor na API do Atlas calcula agora; snapshot: calculado pelo motor neste commit e publicado com o site
export type MissionSource = { kind: 'live'; url: string } | { kind: 'snapshot'; commit: string; commitDate: string; generatedAt: string }
export interface MissionList { missions: Mission[]; source: MissionSource; open: (id: string) => Promise<SimResult> }

async function fromSnapshots(): Promise<MissionList> {
  const idx = await file<Snapshots>('missions.json')
  return {
    missions: Object.entries(idx.missions).map(([id, s]) => localizeMission({ id, name: s.name, description: s.description })),
    source: { kind: 'snapshot', commit: idx.engine_commit, commitDate: idx.engine_commit_date, generatedAt: idx.generated_at },
    open: async (id) => localizeResult(await file<SimResult>(idx.missions[id].file)),
  }
}

export async function loadMissions(): Promise<MissionList> {
  let p: Presets
  try {
    p = await call<Presets>('/missions/presets', undefined, 15_000)
  } catch {
    return fromSnapshots()
  }
  return {
    missions: Object.entries(p.scenarios).map(([id, s]) => localizeMission({ id, name: s.name, description: s.description })),
    source: { kind: 'live', url: API_BASE },
    // se a simulação falhar agora, a mesma missão publicada com o site; sem ela, o erro do motor
    open: async (id) => {
      try {
        return localizeResult(await call<SimResult>('/missions/simulations', structuredClone(p.scenarios[id].config), 60_000))
      } catch (err) {
        const snap = await fromSnapshots().catch(() => null)
        if (snap?.missions.some((m) => m.id === id)) return snap.open(id)
        throw err
      }
    },
  }
}
