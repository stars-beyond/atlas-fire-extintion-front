// Tipos do acervo: habitats, testes, investigações e os metadados da ingestão.

export interface Habitat { id: string; name: string; o2: number; pressure_atm: number; gravity: number; note: string; target: boolean }

export interface Test {
  id: string; inv: string; label: string; family: string; fuel: string | null; material: string | null
  o2: number | null; p: number | null; g: number; flow: number | null; co2: number | null; he: number | null
  outcome: string; assumed: boolean
  // só nos ensaios de fora da NASA (torre de queda do ZARM), que chegam por /api/external e nunca entram nas contagens
  external?: boolean; spread_mm_s?: number | null; sample?: string; outcome_raw?: string
}
export interface ExternalRecord { id: string; short: string; title: string; authors: string; url: string }
export interface ExternalSet {
  available: boolean; id: string; name: string; agency: string; what: string; not_nasa: string; license: string
  records: ExternalRecord[]; tests: Test[]
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
export interface TestDetail { test: any; investigation: string; metrics: Record<string, any>; raw: Record<string, string>; source: string }
