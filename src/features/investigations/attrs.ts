// Atributos de uma investigação em texto, na mesma ordem para a ficha e para a comparação lado a lado.
import { FAMILY, ROLE, gLabel, nf, pct, psi } from '../../lib/format'
import type { Investigation } from '../../types'

export const range = (r: [number, number] | null | undefined, f: (v: number) => string) => (r ? (r[0] === r[1] ? f(r[0]) : `${f(r[0])} a ${f(r[1])}`) : 'não tabelado')


export function attrs(v: Investigation): [string, string][] {
  const s = v.stats
  return [
    ['Papel na segurança', ROLE[v.role]], ['Combustível', FAMILY[v.family]], ['Equipamento', v.hardware_family],
    ['Oxigênio', range(s.o2 ?? s.declared?.o2 ?? null, (x) => pct(x))],
    ['Pressão', s.pressure_assumed && !s.pressure_atm ? 'cabine (assumida)' : range(s.pressure_atm ?? s.declared?.pressure_atm ?? null, psi)],
    ['Gravidade', s.gravity?.length ? s.gravity.map(gLabel).join(' e ') : '0 g'],
    ['Fluxo de ar', range(s.flow_cm_s, (x) => nf(x, 0) + ' cm/s')],
    ['Desfecho tabelado', s.has_outcome ? 'sim' : 'não'],
    ['Combustíveis ou materiais', s.fuels?.slice(0, 4).join(', ') || '–'],
    ['O que variou entre os testes', s.varies?.slice(0, 5).join(', ') || '–'],
    ['Medições', s.measurements?.slice(0, 6).join(', ') || '–'],
    ['Linhas tabeladas', nf(s.n_tests)], ['Período', v.start_year ? `${v.start_year}–${v.end_year ?? ''}` : '–'],
  ]
}
