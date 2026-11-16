// Tipo da validação do simulador 3D (lab3d) contra a curva publicada pela NASA.

export interface SimValidation {
  available: boolean; date: string; engine: string; gpu: string; tier: string; criterion: string
  sample: { material: string; shape: string; radius_cm: number }; pressure_psi: number
  rows: { gravity: number; wind_cm_s: number; sim_o2: number; plus_minus: number; nasa_o2: [number, number]; diff_o2: number | null; inside: boolean }[]
  n: number; inside: number; rms_o2: number; max_abs_o2: number; band_o2: number; headline: string; stale: string[]
  source: string; url: string; equation: string; stretch: string; how: string; caveats: string[]
  spread?: SimSpreadCheck
}
// A escala de tempo do simulador: a velocidade da frente numa placa de acrílico contra a medida nos ensaios do ZARM.
export interface SimSpreadCheck {
  available: boolean; date: string; engine: string; criterion: string; headline: string; stale: string[]; caveats: string[]; n: number
  sample: { material: string; shape: string; length_cm: number; thickness_cm: number; width_cm: number }
  measured: { what: string; source: string; license: string }
  rows: { trial: string; o2_pct: number; pressure_psi: number; flow_cm_s: number; measured_mm_s: number; sim_mm_s: number | null; flame_mm_s: number | null; ratio: number | null; reached_cm: number; burning_end: boolean }[]
}
