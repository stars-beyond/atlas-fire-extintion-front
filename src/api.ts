// Cliente da API do Atlas e os tipos que ela devolve.

export type Family = 'solido' | 'gota' | 'gas' | 'todas'
export type Tier = 'medido' | 'delimitado' | 'parcial' | 'sem_evidencia'

export interface Scenario { o2: number; pressure_atm: number; gravity: number; family: Family; material: string; habitat?: string }
export interface Habitat { id: string; name: string; o2: number; pressure_atm: number; gravity: number; note: string; target: boolean }

export interface Test {
  id: string; inv: string; label: string; family: string; fuel: string | null; material: string | null
  o2: number | null; p: number | null; g: number; flow: number | null; co2: number | null; he: number | null
  outcome: string; assumed: boolean
}
export interface InvStats {
  n_tests: number; n_plot: number; o2: [number, number] | null; pressure_atm: [number, number] | null
  flow_cm_s: [number, number] | null; gravity: number[]; fuels: string[]; outcomes: Record<string, number>
  has_o2: boolean; has_pressure: boolean; has_outcome: boolean; has_flow: boolean; varies: string[]; constant: string[]
  measurements: string[]; pressure_assumed: boolean; declared?: { o2?: [number, number]; pressure_atm?: [number, number] }
}
export interface Investigation {
  id: string; acronym: string; name: string; title: string; kind: string; area: string; hardware: string
  hardware_family: string; family: string; role: string; priority: number; priority_why: string
  start_year: number | null; end_year: number | null; total_gb: number; n_publications: number; n_files: number; stats: InvStats
}
export interface InvDetail {
  investigation: Investigation; objective: string; approach: string; hypothesis: string; impacts: string; doi: string
  publications: { title: string; authors: string; doi: string }[]
  documents: { file: string; title: string; category: string; chunks: number; pages: number | null }[]
}
export interface Neighbor {
  test: { id: string; investigation_id: string; label: string; family: string; fuel: string | null; o2: number; pressure_atm: number; gravity: number; outcome: string; outcome_raw: string | null; assumed: string[]; source_file: string; source_row: number }
  investigation: string; distance: number; d_o2_pp: number; d_pressure_pct: number; d_gravity: number; inside: boolean
}
export interface Empirical {
  total: number; known: number; burned: number; extinguished: number; disrupted: number; no_ignition: number; unknown: number
  rate: number | null; headline: string; caveat: string; by_investigation: { id: string; name: string; total: number; known: number; burned: number }[]
}
export interface Verdict {
  tier: Tier; label: string; headline: string; explanation: string; same_g: number; zero_g: number; one_g: number
  outcomes: Record<string, number>; nearest: Neighbor[]; scenario: Scenario; empirical: Empirical | null
}
export interface MatrixCell { family: string; tier: Tier; label: string; n: number }
export interface Ranked {
  id: string; name: string; family: string; role: string; score: number
  parts: { proximidade: number; relevancia: number; dados: number; enunciado: number }; reason: string
}
export interface Citation { n: number; ref: string; kind: string; title: string; where: string; investigation_id?: string; test_id?: string; url?: string; text: string; note?: string; warnings?: string[] }
export interface Answer {
  answer: string; citations: Citation[]; scenario: Scenario; scenario_changed: boolean; understood: string[]
  verdict: Verdict; ranking: Ranked[]; mode: 'rag' | 'si' | 'extrativo'; conversation_id?: string; provider: string; model: string
  sources: Record<string, number>; abstained: boolean; warning?: string; took_ms: number
}
export interface NextTest { o2: number; pressure_atm: number; gravity: number; platform: string; gain: number; closes: string[]; why: string }
export interface Prediction {
  model_id: string; k_mm2_s: number; baseline_k_mm2_s: number; delta_pct: number; in_range: boolean
  out_of_range: string[]; level: string; note: string; model: { n: number; r2_cv: number; range: Record<string, [number, number]> }
}
export interface Insight { id: string; title: string; finding: string; source: string; data: any }
export interface Meta {
  ingest: { at: string; investigations: number; tests: number; chunks: number; documents: Record<string, number>; embed_model: string; catalog_sources: Record<string, number> }
  counts: { investigations: number; tests: number; plot: number; chunks: number }
  llm: { provider: string; model: string }
  qdrant: { enabled: boolean; collections?: string[] }
  rag: { enabled: boolean; ready: boolean; chunks: number; detail?: string }
  habitats: Habitat[]
  tolerances: { o2: number; pressure: number; gravity: number }
  weights: Record<string, number>
}
export interface VarDef { key: string; label: string; unit?: string; column: string; n: number }
export interface Dataset { id: string; label: string; investigation: string; psi: string; rows: number; files: string[]; numeric: VarDef[]; categorical: VarDef[] }
export interface DataRecord { id: string; label: string; inv: string; num: Record<string, number | null>; cat: Record<string, string | null>; source_file: string; source_row: number; assumed: string[] }
export interface GNode { id: string; type: 'cenario' | 'teste' | 'investigacao' | 'material' | 'gravidade' | 'desfecho'; label: string; detail?: string; test_id?: string; family?: string; inside?: boolean }
export interface GEdge { source: string; target: string; type: string; label?: string }
export interface FlamPoint {
  state: 'queimou' | 'apagou_pouco_ar' | 'apagou_vento' | 'vento_nao_apagou' | 'apagou_sozinha' | 'nao_sustentou'
  o2: number; flow_cm_s: number | null; source: string; o2_range?: [number, number]; flow_range?: [number, number]
}
export interface FlamTest {
  test: string; atlas_id: string; pi: string; material: string; form: string; geometry: string | null
  o2_initial: number | null; o2_final: number | null; end: string; end_label: string; observation: string | null
  report_page: number | null; limit: { flow_cm_s: number; flow_min?: number; flow_max?: number; pot?: number; source: string; below_resolution?: boolean } | null
  points: FlamPoint[]; flags: string[] | null; reviewed: string | null
}
export interface AuditItem {
  test: string; table_row: number | null; field: string; table: number | string | null; report: number | string | null
  kind: string; severity: 'alta' | 'média' | 'baixa'; note: string; report_page?: number | null
}
export interface Flammability {
  available: boolean; investigation: string; name: string; method: string
  report: { title: string; number: string; url: string; section: string }
  summary: { tests: number; found: number; with_observation: number; with_end: number; reviewed: number; audit: number; ends: Record<string, number>; points: Record<string, number> }
  forms: { form: string; n: number }[]; tests: FlamTest[]; audit: AuditItem[]; boundaries: Boundary[] | null
}
export interface Boundary {
  form: string; band_o2: number; curve: { flow_cm_s: number; o2: number }[]
  published: { equation: string; stretch: string; source: string; url: string; minimum: string; applies_to: string; coef: { A: number; k: number; B: number; C: number; r0_cm: number } }
  check: {
    blowoff: { n: number; mean_diff_o2: number; rms_diff_o2: number; max_abs_diff_o2: number }
    held: { n: number; consistent: number }
    quench: { n: number; on_curve: number; inside_band: number; still_air_o2: number; off_curve: { test: string; o2: number; geometry: string | null; why: string }[] }
    own_blowoff_line: { slope: number; intercept: number; slope_se: number; rms_o2: number; n: number; published: { slope: number; intercept: number } } | null
  }
  tested: { o2: [number, number]; flow_cm_s_max: number; pressure_atm: number; gravity: number }
  buoyancy: { flow_1g_cm_s: [number, number]; partial_gravity: string; sources: { value: number; ref: string; url: string }[]; earth_check: { o2: number; flow_cm_s: number; curve_o2: number; ref: string } }
}
export interface Assessment {
  form: string; status: 'queima' | 'no_limite' | 'nao_sustenta'; headline: string; detail: string; o2: number
  limit_o2: [number, number]; band_o2: number; margin_o2: [number, number]; forced_cm_s: number
  buoyant_cm_s: [number, number]; buoyant_scaled_cm_s: [number, number]; flow_cm_s: [number, number]
  inside_tested: boolean; outside: string[]; source: string; dilution_min: [number, number]
}
export interface SimValidation {
  available: boolean; date: string; engine: string; gpu: string; tier: string; criterion: string
  sample: { material: string; shape: string; radius_cm: number }; pressure_psi: number
  rows: { gravity: number; wind_cm_s: number; sim_o2: number; plus_minus: number; nasa_o2: [number, number]; diff_o2: number | null; inside: boolean }[]
  n: number; inside: number; rms_o2: number; max_abs_o2: number; band_o2: number; headline: string; stale: string[]
  source: string; url: string; equation: string; stretch: string; how: string; caveats: string[]
}
export interface Proposal {
  rank: number; id: string; kind: 'gravidade' | 'oxigenio' | 'pressao' | 'habitat' | 'curva'; title: string
  material: string; o2: string; pressure: string; gravity: string; flow: string; measure: string; prediction: string; decides: string
  closes: { habitat: string; name: string; what: string; label: string }[]; remains: string[]; gain_o2: number; new_factors: string[]; score: number
  platform: string; check_first: string; sources: string[]
  lunar: { text: string; caveats_before: number; caveats_after: number; width_before_o2: number; width_after_o2: number }
}
export interface FireQueue {
  available: boolean; form: string; source: string; url: string; band_o2: number; method: string
  targets: { habitat: Habitat; assessment: Assessment; gaps: string[]; width_o2: number }[]; queue: Proposal[]
}
export type ChartType = 'scatter' | 'bar' | 'histogram'
export interface ChartConfig { dataset: string; type: ChartType; x: string; y: string; group: string; filterKey: string; filterValue: string; bins: number }
export type BuiltChart =
  | { kind: 'scatter'; series: { name: string; points: { x: number; y: number; id: string }[] }[]; missing: number; used: number }
  | { kind: 'bar'; bars: { name: string; mean: number; n: number; min: number; max: number }[]; missing: number; used: number }
  | { kind: 'histogram'; bars: { name: string; count: number }[]; missing: number; used: number }
export interface TestDetail { test: any; investigation: string; metrics: Record<string, any>; raw: Record<string, string>; source: string }

// Onde a API está. Sem VITE_API_URL, a interface chama /api no mesmo domínio: no Cloudflare o Worker
// (worker/index.ts) repassa para o backend; no `npm run dev`, o proxy do Vite faz o mesmo.
// Com VITE_API_URL (ex.: https://api.seudominio.com), o navegador chama a API direto (ela já libera CORS).
export const API_BASE = (import.meta.env.VITE_API_URL ?? '').trim().replace(/\/+$/, '') + '/api'
export const apiUrl = (path: string) => API_BASE + path

async function j<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(apiUrl(path), body === undefined ? undefined : {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `O servidor respondeu ${res.status}`)
  return data as T
}

export const api = {
  meta: () => j<Meta>('/meta'),
  investigations: () => j<Investigation[]>('/investigations'),
  investigation: (id: string) => j<InvDetail>('/investigations/' + encodeURIComponent(id)),
  tests: async (): Promise<Test[]> => {
    const d = await j<{ columns: string[]; rows: any[][] }>('/tests')
    return d.rows.map((r) => Object.fromEntries(d.columns.map((c, i) => [c, r[i]])) as unknown as Test)
  },
  test: (id: string) => j<TestDetail>('/tests/' + encodeURIComponent(id)),
  verdict: (s: Scenario) => j<{ verdict: Verdict; matrix: MatrixCell[] }>('/verdict', s),
  rank: (scenario: Scenario, question = '') => j<{ ranking: Ranked[] }>('/rank', { scenario, question }),
  nextTests: (family: string, material: string) => j<{ next: NextTest[]; method: string }>('/next-tests', { family, material }),
  ask: (question: string, scenario: Scenario, conversation_id = '') => j<Answer>('/ask', { question, scenario, conversation_id }),
  predict: (b: { fuel: string; o2: number; co2: number; he: number; pressure_atm: number }) => j<Prediction>('/predict/burn-rate', b),
  insights: () => j<{ insights: Insight[] }>('/insights'),
  infer: (text: string, scenario: Scenario) => j<{ scenario: Scenario; understood: string[]; method: string; changed: boolean }>('/scenario/infer', { text, scenario }),
  graph: (s: Scenario) => j<{ nodes: GNode[]; edges: GEdge[] }>('/graph', s),
  flammability: () => j<Flammability>('/flammability'),
  queue: () => j<FireQueue>('/flammability/queue'),
  simValidation: () => j<SimValidation>('/sim/validation'),
  assess: (s: Scenario, forced_cm_s: number, form: string) => j<{ available: boolean; assessment?: Assessment }>('/flammability/assess', { ...s, forced_cm_s, form }),
  datasets: () => j<{ datasets: Dataset[]; note: string }>('/datasets'),
  records: (id: string) => j<{ dataset: Dataset; records: DataRecord[] }>('/datasets/' + encodeURIComponent(id) + '/records'),
  // o gráfico vem pronto do backend: séries, médias por grupo, classes do histograma e opções do filtro
  chart: (cfg: ChartConfig) => j<{ chart: BuiltChart; filter_options: string[] }>('/datasets/' + encodeURIComponent(cfg.dataset) + '/chart', cfg),
  csvUrl: (cfg: Pick<ChartConfig, 'dataset' | 'filterKey' | 'filterValue'>) =>
    apiUrl('/datasets/' + encodeURIComponent(cfg.dataset) + '/csv?' + new URLSearchParams({ filter_key: cfg.filterKey, filter_value: cfg.filterValue })),
}

// ---------------------------------------------------------------- formatação pt-BR
export const nf = (v: number, d = 0) => v.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d })
export const pct = (f: number, d?: number) => {
  const v = f * 100
  return nf(v, d ?? (Math.abs(v - Math.round(v)) < 0.05 ? 0 : 1)) + '%'
}
export const psi = (atm: number) => nf(atm * 14.696, 1) + ' psi'
export const gLabel = (g: number) => (g <= 0.05 ? '0 g' : g >= 0.95 ? '1 g' : nf(g, 2) + ' g')
export const FAMILY: Record<string, string> = { solido: 'Sólidos', gota: 'Gotas', gas: 'Chamas gasosas', fumaca: 'Fumaça', todas: 'Todas' }
export const OUTCOME: Record<string, string> = { queimou: 'queimou', extinguiu: 'apagou', disrupcao: 'gota estourou', nao_acendeu: 'não acendeu', desconhecido: 'não tabelado' }
export const ROLE: Record<string, string> = { prevencao: 'Prevenção', deteccao: 'Detecção', supressao: 'Supressão', fundamento: 'Fundamento' }
export const TIER: Record<Tier, { label: string; short: string }> = {
  medido: { label: 'Medido', short: 'Há teste nesta condição' },
  delimitado: { label: 'Delimitado', short: 'Entre 0 g e 1 g' },
  parcial: { label: 'Só um limite', short: 'Falta o outro lado' },
  sem_evidencia: { label: 'Terra incógnita', short: 'Nenhum teste aqui' },
}
