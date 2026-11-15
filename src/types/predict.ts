// Tipo da previsão do efeito do agente supressor (modelo ajustado às gotas do FLEX).

export interface Prediction {
  model_id: string; k_mm2_s: number; baseline_k_mm2_s: number; delta_pct: number; in_range: boolean
  out_of_range: string[]; level: string; note: string; model: { n: number; r2_cv: number; range: Record<string, [number, number]> }
}
