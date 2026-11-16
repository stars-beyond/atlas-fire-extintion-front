// Distinct values of the filter variable chosen in a chart draft, computed by the API (it sends them with any
// chart of that data set). Used by the chart builder of the Findings page and by "Create your dashboard".
// No filter variable, or a failed request: an empty list. A late answer for an earlier choice is dropped.
import { api } from '../../api'
import { useAsync } from '../../lib/useAsync'
import type { ChartConfig } from '../../types'

export function useFilterOptions(draft: ChartConfig | null): string[] {
  const key = draft?.filterKey ?? ''
  const r = useAsync<string[]>(() => (draft && key ? api.chart({ ...draft, filterValue: '' }).then((x) => x.filter_options ?? []) : Promise.resolve([])), [draft?.dataset, key])
  return key ? r.data ?? [] : []
}
