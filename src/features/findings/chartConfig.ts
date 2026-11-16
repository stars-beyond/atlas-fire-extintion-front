// Construtor de gráficos, portado do dashboard COSMOEX FLAME da equipe
// (stars-beyond/cosmoex-flame-dashboard). O cálculo (filtro, séries, médias, histograma e CSV) é feito
// pela API, em api/chart.go do backend; aqui ficam só os rótulos e a configuração inicial da tela.
import type { ChartConfig, ChartType, Dataset, VarDef } from '../../types'

export type { BuiltChart, ChartConfig, ChartType } from '../../types'
export const TYPE_LABEL: Record<ChartType, string> = { scatter: 'Scatter', bar: 'Bars (mean per group)', histogram: 'Histogram' }
export const CHART_TYPES: ChartType[] = ['scatter', 'bar', 'histogram']
// "Label (unit)" of a variable, for axis titles and menus
export const unit = (v?: Pick<VarDef, 'label' | 'unit'>) => (v ? (v.unit ? `${v.label} (${v.unit})` : v.label) : '')

export function defaultConfig(def: Dataset): ChartConfig {
  const has = (k: string) => def.numeric.some((v) => v.key === k)
  const x = has('o2_pct') ? 'o2_pct' : def.numeric[0]?.key ?? ''
  const y = ['k_mm2_s', 'tad_k', 'o2_final_pct', 'fuel_mg_s', 'burn_time_s', 'pressure_psi'].find(has) ?? def.numeric.find((v) => v.key !== x)?.key ?? x
  const group = ['investigation', 'diluent', 'outcome', 'fuel'].find((k) => def.categorical.some((v) => v.key === k)) ?? ''
  return { dataset: def.id, type: 'scatter', x, y, group, filterKey: '', filterValue: '', bins: 8 }
}

// Whether something read back from the browser's storage has the shape of a chart configuration at all.
export function isChartConfig(c: unknown): c is ChartConfig {
  const o = c as Record<string, unknown> | null
  return !!o && typeof o === 'object' && ['dataset', 'type', 'x', 'y', 'group', 'filterKey', 'filterValue'].every((k) => typeof o[k] === 'string')
    && typeof o.bins === 'number' && Number.isFinite(o.bins) && o.bins >= 3 && o.bins <= 20
}
// Why a saved configuration cannot be drawn against the data sets the API publishes now. Empty = valid.
export function mismatch(cfg: ChartConfig, datasets: Dataset[]): string[] {
  const d = datasets.find((x) => x.id === cfg.dataset)
  if (!d) return [`the data set "${cfg.dataset}" is no longer published by the API`]
  const num = (k: string) => d.numeric.some((v) => v.key === k), cat = (k: string) => d.categorical.some((v) => v.key === k)
  const out: string[] = []
  if (!CHART_TYPES.includes(cfg.type)) out.push(`chart type "${cfg.type}" is not supported`)
  if (!num(cfg.y)) out.push(`variable "${cfg.y}" is no longer in ${d.label}`)
  if (cfg.type === 'scatter' && !num(cfg.x)) out.push(`variable "${cfg.x}" is no longer in ${d.label}`)
  if (cfg.type === 'bar' && !cat(cfg.group)) out.push(cfg.group ? `grouping "${cfg.group}" is no longer in ${d.label}` : 'a bar chart needs a grouping variable')
  if (cfg.type === 'scatter' && cfg.group && !cat(cfg.group)) out.push(`grouping "${cfg.group}" is no longer in ${d.label}`)
  if (cfg.filterKey && !cat(cfg.filterKey)) out.push(`filter "${cfg.filterKey}" is no longer in ${d.label}`)
  return out
}
