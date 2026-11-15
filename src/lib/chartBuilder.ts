// Construtor de gráficos, portado do dashboard COSMOEX FLAME da equipe
// (stars-beyond/cosmoex-flame-dashboard). O cálculo (filtro, séries, médias, histograma e CSV) é feito
// pela API, em api/chart.go do backend; aqui ficam só os rótulos e a configuração inicial da tela.
import type { ChartConfig, ChartType, Dataset } from '../api'

export type { BuiltChart, ChartConfig, ChartType } from '../api'
export const TYPE_LABEL: Record<ChartType, string> = { scatter: 'Dispersão', bar: 'Barras (média por grupo)', histogram: 'Histograma' }

export function defaultConfig(def: Dataset): ChartConfig {
  const has = (k: string) => def.numeric.some((v) => v.key === k)
  const x = has('o2_pct') ? 'o2_pct' : def.numeric[0]?.key ?? ''
  const y = ['k_mm2_s', 'tad_k', 'o2_final_pct', 'fuel_mg_s', 'burn_time_s', 'pressure_psi'].find(has) ?? def.numeric.find((v) => v.key !== x)?.key ?? x
  const group = ['investigation', 'diluent', 'outcome', 'fuel'].find((k) => def.categorical.some((v) => v.key === k)) ?? ''
  return { dataset: def.id, type: 'scatter', x, y, group, filterKey: '', filterValue: '', bins: 8 }
}
