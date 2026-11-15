// Expedições: o ranking das investigações para o cenário, a ficha de cada uma e a comparação lado a lado.
import { useMemo, useState } from 'react'
import { FAMILY, ROLE, gLabel, nf, pct, psi } from '../../lib/format'
import { useAtlas } from '../../state'
import { range } from './attrs'
import { Compare } from './Compare'
import { Ficha } from './Ficha'

const PART: [keyof import('../../types').Ranked['parts'], string, string][] = [
  ['proximidade', 'Closeness to tested conditions', 'var(--g0)'], ['relevancia', 'Text relevance to the scenario', 'var(--gas)'],
  ['dados', 'Tabulated data (O₂, pressure, outcome)', 'var(--gota)'], ['enunciado', 'Role stated in the challenge', 'var(--solido)'],
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
        <span className="cap">Expeditions · ranking for the probe</span>
        <h1>Which investigations matter at {pct(scenario.o2)} O₂, {psi(scenario.pressure_atm)} and {gLabel(scenario.gravity)}</h1>
        <p className="lede">The order changes with the scenario. Each bar shows where the score comes from: tested conditions close to the probe, the investigation's text, tabulated data, and the role the challenge statement gives it.</p>
        <div className="badges">{PART.map(([k, l, c]) => (<span key={k} className="pill"><i className="swatch" style={{ background: c }} />{l} · {nf((meta?.weights[k] ?? 0) * 100)}%</span>))}</div>
      </div>
      <div className="split">
        <div className="tbl-wrap"><table>
          <thead><tr><th>#</th><th>Investigation</th><th>Role</th><th>Score</th><th className="num">Tests</th><th>O₂ tested</th><th>Compare</th></tr></thead>
          <tbody>{ranking.map((r, i) => { const v = byId.get(r.id); if (!v) return null; return (
            <tr key={r.id} className={`click${sel === r.id ? ' sel' : ''}`} onClick={() => selectInv(r.id)}>
              <td className="mono faint">{i + 1}</td>
              <td><b>{r.name}</b><div className="faint" style={{ fontSize: 11.5 }}>{FAMILY[v.family]} · {v.hardware_family}</div></td>
              <td>{ROLE[r.role]}</td>
              <td><div className="scorebar" title={r.reason}>{PART.map(([k, , c]) => (<i key={k} style={{ width: `${r.parts[k] * (meta?.weights[k] ?? 0.25) * 100}%`, background: c }} />))}</div><span className="mono faint">{nf(r.score * 100)}</span></td>
              <td className="num">{nf(v.stats.n_tests)}</td>
              <td className="mono">{range(v.stats.o2 ?? v.stats.declared?.o2 ?? null, (x) => pct(x))}</td>
              <td><input type="checkbox" checked={cmp.includes(r.id)} onChange={() => toggle(r.id)} onClick={(e) => e.stopPropagation()} aria-label={`Compare ${r.name}`} /></td>
            </tr>) })}</tbody>
        </table></div>
        <div style={{ display: 'grid', gap: 16 }}>
          {pair && pair[0] && pair[1] ? <Compare a={pair[0]} b={pair[1]} /> : <p className="note">Tick two investigations in the Compare column to see what they share and where they differ.</p>}
          {sel && <Ficha id={sel} />}
        </div>
      </div>
    </div></main>
  )
}
