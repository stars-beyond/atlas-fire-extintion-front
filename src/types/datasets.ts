// Tipos dos conjuntos de dados tabelados e do construtor de gráficos ("Monte seu gráfico").

export interface VarDef { key: string; label: string; unit?: string; column: string; n: number }
export interface Dataset { id: string; label: string; investigation: string; psi: string; rows: number; files: string[]; numeric: VarDef[]; categorical: VarDef[] }
export interface DataRecord { id: string; label: string; inv: string; num: Record<string, number | null>; cat: Record<string, string | null>; source_file: string; source_row: number; assumed: string[] }
export type ChartType = 'scatter' | 'bar' | 'histogram'
export interface ChartConfig { dataset: string; type: ChartType; x: string; y: string; group: string; filterKey: string; filterValue: string; bins: number }
export type BuiltChart =
  | { kind: 'scatter'; series: { name: string; points: { x: number; y: number; id: string }[] }[]; missing: number; used: number }
  | { kind: 'bar'; bars: { name: string; mean: number; n: number; min: number; max: number }[]; missing: number; used: number }
  | { kind: 'histogram'; bars: { name: string; count: number }[]; missing: number; used: number }
