// Tipo da previsão do efeito do agente supressor (modelo ajustado às gotas do FLEX).

export interface Prediction {
  model_id: string; o2_effective?: number; k_mm2_s: number; baseline_k_mm2_s: number; delta_pct: number; in_range: boolean
  out_of_range: string[]; level: string; note: string; model: { n: number; r2_cv: number; range: Record<string, [number, number]> }
}

// Velocidade de propagação num filme fino de acrílico em 0 g, pelo modelo neural da equipe (ensaios do ZARM).
// `available` diz se há número; fora da grade do modelo vem só `reason`.
export interface SpreadCheckRow { trial: string; o2_pct: number; pressure_kpa: number; flow_cm_s: number; measured_mm_s: number; predicted_mm_s: number; nets_mm_s: [number, number] }
export interface Spread {
  available: boolean; reason?: string
  v_mm_s: number; nets_mm_s: [number, number]; baseline_mm_s: number; ratio: number; s_per_10cm: number
  level: 'interpolado' | 'extrapolado' | 'fora' | ''; in_range: boolean; out_of_range: string[]; gravity_ignored: boolean; stalls: boolean
  o2_pct: number; pressure_kpa: number; flow_cm_s: number; ppo2_kpa: number
  headline: string; compare: string; detail: string; caveats: string[]; note: string
  model?: { name: string; url: string; commit: string; date: string; nets: number; trials: number; sample: string; heldout_mae_mm_s: number; check_mae_mm_s: number; license: string }
  check?: SpreadCheckRow[]; sources?: string[]
}

// Câmera térmica: o filme de temperatura previsto pelas redes da equipe. Os quadros chegam como uint8
// comprimido (zlib) em base64, linha a linha; a temperatura é valor / 255 × t_max_c. `compare` é o ensaio
// de exemplo do modelo ao lado da gravação medida.
export interface Thermal {
  available: boolean; reason?: string; compare: boolean
  level: 'interpolado' | 'extrapolado' | 'fora' | 'medido' | ''; in_range?: boolean; out_of_range: string[]
  gravity_ignored?: boolean; caveats?: string[]; note?: string
  w: number; h: number; steps: number; history: number; fps: number; mm_px: number; t_max_c: number; std_max_c: number
  std_w: number; std_h: number; nets: number
  o2_pct: number; pressure_kpa: number; flow_cm_s: number
  history_b64: string; frames_b64: string; std_b64: string; metal_b64: string
  front_px: (number | null)[]; fuel_end_px: number; v_mm_s: number | null; nets_mm_s: [number, number] | null; stalls: boolean
  table_v_mm_s?: number; baseline_mm_s?: number; ratio?: number
  measured_b64?: string; measured_steps?: number; measured_v_mm_s?: number | null; mae_c?: (number | null)[]
  sample?: { trial: string; o2_pct: number; pressure_kpa: number; flow_cm_s: number; note: string }
  license?: string; attribution?: string[]
}
