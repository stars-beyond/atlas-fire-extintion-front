// Tipo da validação do simulador 3D (lab3d) contra a curva publicada pela NASA.

export interface SimValidation {
  available: boolean; date: string; engine: string; gpu: string; tier: string; criterion: string
  sample: { material: string; shape: string; radius_cm: number }; pressure_psi: number
  rows: { gravity: number; wind_cm_s: number; sim_o2: number; plus_minus: number; nasa_o2: [number, number]; diff_o2: number | null; inside: boolean }[]
  n: number; inside: number; rms_o2: number; max_abs_o2: number; band_o2: number; headline: string; stale: string[]
  source: string; url: string; equation: string; stretch: string; how: string; caveats: string[]
}
