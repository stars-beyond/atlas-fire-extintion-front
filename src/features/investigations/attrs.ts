// Atributos de uma investigação em texto, na mesma ordem para a ficha e para a comparação lado a lado.
import { FAMILY, ROLE, gLabel, nf, pct, psi } from '../../lib/format'
import type { Investigation } from '../../types'

export const range = (r: [number, number] | null | undefined, f: (v: number) => string) => (r ? (r[0] === r[1] ? f(r[0]) : `${f(r[0])} to ${f(r[1])}`) : 'not tabulated')

export function attrs(v: Investigation): [string, string][] {
  const s = v.stats
  return [
    ['Safety role', ROLE[v.role] ?? v.role], ['Fuel', FAMILY[v.family] ?? v.family], ['Hardware', v.hardware_family],
    ['Oxygen', range(s.o2 ?? s.declared?.o2 ?? null, (x) => pct(x))],
    ['Pressure', s.pressure_assumed && !s.pressure_atm ? 'cabin (assumed)' : range(s.pressure_atm ?? s.declared?.pressure_atm ?? null, psi)],
    ['Gravity', s.gravity?.length ? s.gravity.map(gLabel).join(' and ') : '0 g'],
    ['Airflow', range(s.flow_cm_s, (x) => nf(x, 0) + ' cm/s')],
    ['Tabulated outcome', s.has_outcome ? 'yes' : 'no'],
    ['Fuels or materials', s.fuels?.slice(0, 4).join(', ') || '–'],
    ['What varied between tests', s.varies?.slice(0, 5).join(', ') || '–'],
    ['Measurements', s.measurements?.slice(0, 6).join(', ') || '–'],
    ['Tabulated rows', nf(s.n_tests)], ['Period', v.start_year ? `${v.start_year}–${v.end_year ?? ''}` : '–'],
  ]
}
