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
export interface Verdict {
  tier: Tier; label: string; headline: string; explanation: string; same_g: number; zero_g: number; one_g: number
  outcomes: Record<string, number>; nearest: Neighbor[]; scenario: Scenario; empirical: Empirical | null
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
