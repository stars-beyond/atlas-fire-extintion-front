// Tipos da evidência: veredito, vizinhos, ranking das investigações, lacunas, achados e grafo.
import type { Scenario } from './scenario'

export type Tier = 'medido' | 'delimitado' | 'parcial' | 'sem_evidencia'

export interface Neighbor {
  test: { id: string; investigation_id: string; label: string; family: string; fuel: string | null; o2: number; pressure_atm: number; gravity: number; outcome: string; outcome_raw: string | null; assumed: string[]; source_file: string; source_row: number }
  investigation: string; distance: number; d_o2_pp: number; d_pressure_pct: number; d_gravity: number; inside: boolean
}
export interface Empirical {
  total: number; known: number; burned: number; extinguished: number; disrupted: number; no_ignition: number; unknown: number
  rate: number | null; headline: string; caveat: string; by_investigation: { id: string; name: string; total: number; known: number; burned: number }[]
}
export interface ExternalNear { id: string; label: string; o2: number; pressure_atm: number; flow_cm_s: number; outcome: string; outcome_raw: string; spread_mm_s: number | null }
// Ensaios de fora da NASA na atmosfera do cenário. Não mudam o nível de evidência; tier_with é o nível que seria.
export interface ExternalEvidence {
  id: string; name: string; agency: string; n: number; burned: number; stopped: number; unknown: number
  spread_mm_s: [number, number] | null; n_spread: number; tier_with: Tier; tier_with_label: string
  headline: string; detail: string; caveat: string; nearest: ExternalNear[]; license: string
  records: { id: string; short: string; title: string; authors: string; url: string }[]
}
export interface Verdict {
  tier: Tier; label: string; headline: string; explanation: string; same_g: number; zero_g: number; one_g: number
  outcomes: Record<string, number>; nearest: Neighbor[]; scenario: Scenario; empirical: Empirical | null
  external?: ExternalEvidence | null
}
export interface MatrixCell { family: string; tier: Tier; label: string; n: number }
export interface Ranked {
  id: string; name: string; family: string; role: string; score: number
  parts: { proximidade: number; relevancia: number; dados: number; enunciado: number }; reason: string
}
export interface NextTest { o2: number; pressure_atm: number; gravity: number; platform: string; gain: number; closes: string[]; why: string }
export interface Insight { id: string; title: string; finding: string; source: string; data: any }
export interface GNode { id: string; type: 'cenario' | 'teste' | 'investigacao' | 'material' | 'gravidade' | 'desfecho'; label: string; detail?: string; test_id?: string; family?: string; inside?: boolean }
export interface GEdge { source: string; target: string; type: string; label?: string }
