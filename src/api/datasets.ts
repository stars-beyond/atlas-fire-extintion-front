// API dos conjuntos de dados tabelados e do construtor de gráficos.
import type { BuiltChart, ChartConfig, DataRecord, Dataset } from '../types'
import { apiUrl, j } from './client'

export const datasets = () => j<{ datasets: Dataset[]; note: string }>('/datasets')
export const records = (id: string) => j<{ dataset: Dataset; records: DataRecord[] }>('/datasets/' + encodeURIComponent(id) + '/records')
// o gráfico vem pronto do backend: séries, médias por grupo, classes do histograma e opções do filtro
export const chart = (cfg: ChartConfig) => j<{ chart: BuiltChart; filter_options: string[] }>('/datasets/' + encodeURIComponent(cfg.dataset) + '/chart', cfg)
export const csvUrl = (cfg: Pick<ChartConfig, 'dataset' | 'filterKey' | 'filterValue'>) =>
  apiUrl('/datasets/' + encodeURIComponent(cfg.dataset) + '/csv?' + new URLSearchParams({ filter_key: cfg.filterKey, filter_value: cfg.filterValue }))
