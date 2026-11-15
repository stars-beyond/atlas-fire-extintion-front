// Tipos da inflamabilidade do BASS-II: testes, curva publicada, auditoria, avaliação do cenário e a fila do próximo fogo.
import type { Habitat } from './catalog'

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
