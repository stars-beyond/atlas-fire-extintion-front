// Expedições: o ranking das investigações para o cenário, a ficha de cada uma e a comparação lado a lado.
import { useMemo, useState } from 'react'
import { FAMILY, ROLE, gLabel, nf, pct, psi } from '../../lib/format'
import { useAtlas } from '../../state'
import { range } from './attrs'
import { Compare } from './Compare'
import { Ficha } from './Ficha'

const PART: [keyof import('../../types').Ranked['parts'], string, string][] = [
  ['proximidade', 'Proximidade das condições testadas', 'var(--g0)'], ['relevancia', 'Relevância do texto para o cenário', 'var(--gas)'],
  ['dados', 'Dados tabelados (O₂, pressão, desfecho)', 'var(--gota)'], ['enunciado', 'Papel descrito no enunciado', 'var(--solido)'],
]

export function Expedicoes() {
  const { ranking, invs, scenario, selectedInv, selectInv, meta } = useAtlas()
  const [cmp, setCmp] = useState<string[]>([])
  const byId = useMemo(() => new Map(invs.map((v) => [v.id, v])), [invs])
  const sel = selectedInv ?? ranking[0]?.id
  const toggle = (id: string) => setCmp((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c.slice(-1), id]))
  const pair = cmp.length === 2 ? [byId.get(cmp[0]), byId.get(cmp[1])] : null
  return (
    <main className="page"><div className="page-in">
      <div style={{ display: 'grid', gap: 8 }}>
        <span className="cap">Expedições · ranking para a sonda</span>
        <h1>Quais investigações importam para {pct(scenario.o2)} de O₂ a {psi(scenario.pressure_atm)} em {gLabel(scenario.gravity)}</h1>
        <p className="lede">A ordem muda com o cenário. Cada barra mostra de onde vem a nota: condições testadas perto da sonda, texto da investigação, dados tabelados e o papel que o enunciado do desafio dá a ela.</p>
        <div className="badges">{PART.map(([k, l, c]) => (<span key={k} className="pill"><i className="swatch" style={{ background: c }} />{l} · {nf((meta?.weights[k] ?? 0) * 100)}%</span>))}</div>
      </div>
      <div className="split">
        <div className="tbl-wrap"><table>
          <thead><tr><th>#</th><th>Investigação</th><th>Papel</th><th>Nota</th><th className="num">Testes</th><th>O₂ testado</th><th>Comparar</th></tr></thead>
          <tbody>{ranking.map((r, i) => { const v = byId.get(r.id); if (!v) return null; return (
            <tr key={r.id} className={`click${sel === r.id ? ' sel' : ''}`} onClick={() => selectInv(r.id)}>
              <td className="mono faint">{i + 1}</td>
              <td><b>{r.name}</b><div className="faint" style={{ fontSize: 11.5 }}>{FAMILY[v.family]} · {v.hardware_family}</div></td>
              <td>{ROLE[r.role]}</td>
              <td><div className="scorebar" title={r.reason}>{PART.map(([k, , c]) => (<i key={k} style={{ width: `${r.parts[k] * (meta?.weights[k] ?? 0.25) * 100}%`, background: c }} />))}</div><span className="mono faint">{nf(r.score * 100)}</span></td>
              <td className="num">{nf(v.stats.n_tests)}</td>
              <td className="mono">{range(v.stats.o2 ?? v.stats.declared?.o2 ?? null, (x) => pct(x))}</td>
              <td><input type="checkbox" checked={cmp.includes(r.id)} onChange={() => toggle(r.id)} onClick={(e) => e.stopPropagation()} aria-label={`Comparar ${r.name}`} /></td>
            </tr>) })}</tbody>
        </table></div>
        <div style={{ display: 'grid', gap: 16 }}>
          {pair && pair[0] && pair[1] ? <Compare a={pair[0]} b={pair[1]} /> : <p className="note">Marque duas investigações na coluna Comparar para ver o que têm de igual e de diferente.</p>}
          {sel && <Ficha id={sel} />}
        </div>
      </div>
    </div></main>
  )
}
