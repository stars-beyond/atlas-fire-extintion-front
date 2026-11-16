// Charts of the Findings column. Every number drawn here arrives in the `data` field of /api/insights;
// the browser only places marks. Axis bounds are taken from the data, never typed in.
import { useState } from 'react'
import { FAMILY, FAMILY_COLOR, nf, pct } from '../../lib/format'
import type { Habitat } from '../../types'
import { FLEX_DILUENT as DIL, FLEX_END as END } from '../findings/labels'
import { psiRange } from './links'
import { lin, useTip } from './ui'

const ticks = (lo: number, hi: number, step: number) => { const out: number[] = []; for (let v = lo; v <= hi + step / 1e6; v += step) out.push(+v.toFixed(6)); return out }

// ---- coverage: tested O₂ range per fuel family, against the atmospheres of the target environments ---------
export interface CoverageRow { family: string; n: number; o2_min: number; o2_max: number; p_min: number; p_max: number }
export function CoverageChart({ data, habitats, scenarioO2, family, onFamily, pressureAssumed }: {
  data: CoverageRow[]; habitats: Habitat[]; scenarioO2: number; family: string; onFamily: (f: string) => void; pressureAssumed: boolean
}) {
  const tip = useTip(), W = tip.width
  const x = lin(0, 1, 104, W - 12)
  // one reference line per distinct oxygen level among the target environments
  const groups = new Map<string, { o2: number; names: string[] }>()
  for (const h of habitats.filter((h) => h.target)) {
    const k = h.o2.toFixed(3); const g = groups.get(k) ?? { o2: h.o2, names: [] }
    g.names.push(h.name); groups.set(k, g)
  }
  const refs = [...groups.values()].sort((a, b) => a.o2 - b.o2)
  const onRef = refs.some((r) => Math.abs(r.o2 - scenarioO2) < 0.0005)
  const top = 14 + refs.length * 12, rowH = 30, bottom = top + data.length * rowH + 8
  return (
    <div className="dchart" ref={tip.host}>
      <svg viewBox={`0 0 ${W} ${bottom + 22}`} width="100%" role="img" aria-label={`Tested oxygen range by fuel family. ${data.map((d) => `${FAMILY[d.family] ?? d.family}: ${pct(d.o2_min, 1)} to ${pct(d.o2_max, 1)}, ${d.n} records`).join('. ')}.`}>
        {ticks(0, 1, 0.2).map((t) => (<g key={t}><line className="dgrid" x1={x(t)} x2={x(t)} y1={top} y2={bottom} /><text className="dtick" x={x(t)} y={bottom + 14} textAnchor="middle">{pct(t)}</text></g>))}
        {refs.map((r, i) => {
          const sel = Math.abs(r.o2 - scenarioO2) < 0.0005, ly = 10 + i * 12
          const label = `${pct(r.o2)} · ${r.names.join(', ')}`, flip = x(r.o2) + 4 + label.length * 5.9 > W
          return (
            <g key={r.o2} className={`dref${sel ? ' on' : ''}`}>
              <line x1={x(r.o2)} x2={x(r.o2)} y1={ly + 3} y2={bottom} />
              <text x={flip ? W - 2 : x(r.o2) + 4} y={ly} textAnchor={flip ? 'end' : 'start'}>{label}</text>
            </g>
          )
        })}
        {data.map((d, i) => {
          const y = top + 8 + i * rowH, on = family === d.family, dim = family !== 'todas' && !on
          return (
            <g key={d.family} className={`dcov-row${on ? ' on' : ''}${dim ? ' dim' : ''}`} role="button" tabIndex={0} aria-pressed={on}
              aria-label={`${FAMILY[d.family] ?? d.family}: filter the dashboard by this fuel family`}
              onClick={() => onFamily(on ? 'todas' : d.family)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onFamily(on ? 'todas' : d.family) } }}
              onMouseMove={(e) => tip.show(e, <><b>{FAMILY[d.family] ?? d.family}</b><span>O₂ {pct(d.o2_min, 1)} to {pct(d.o2_max, 1)}</span><span>Pressure {psiRange([d.p_min, d.p_max])}{d.family === 'solido' && pressureAssumed ? ' (assumed, not measured)' : ''}</span><span>{nf(d.n)} records with O₂ and pressure, all gravities</span><em>Click to filter by this family</em></>)}
              onMouseLeave={tip.hide}>
              <rect className="dhit" x={0} y={y - 6} width={W} height={rowH - 2} />
              <text className="dlabel" x={0} y={y + 8}>{FAMILY[d.family] ?? d.family}</text>
              <text className="dtick" x={0} y={y + 19}>n = {nf(d.n)}</text>
              <rect x={x(d.o2_min)} y={y} width={Math.max(3, x(d.o2_max) - x(d.o2_min))} height={13} rx={2} fill={FAMILY_COLOR[d.family] ?? 'var(--dim)'} />
              {x(d.o2_max) + 84 > W
                ? <text className="dvalue inside" x={x(d.o2_max) - 5} y={y + 10} textAnchor="end">{pct(d.o2_min, 1)}–{pct(d.o2_max, 1)}</text>
                : <text className="dvalue" x={x(d.o2_max) + 6} y={y + 10}>{pct(d.o2_min, 1)}–{pct(d.o2_max, 1)}</text>}
            </g>
          )
        })}
        {!onRef && scenarioO2 <= 1 && (
          <g className="dref on"><line x1={x(scenarioO2)} x2={x(scenarioO2)} y1={top - 2} y2={bottom} /><text x={x(scenarioO2) + (scenarioO2 > 0.8 ? -4 : 4)} y={bottom - 2} textAnchor={scenarioO2 > 0.8 ? 'end' : 'start'}>scenario {pct(scenarioO2, 1)}</text></g>
        )}
      </svg>
      {tip.el}
      <p className="dcap">Bars: lowest to highest initial O₂ among records with both O₂ and pressure, at any gravity; n is that record count.{pressureAssumed ? ' Solids: pressure is assumed to be cabin pressure, not measured per test.' : ''} Dashed lines: O₂ of the target environments (from <span className="dmono">/api/meta</span>); the highlighted one is the reference scenario.</p>
    </div>
  )
}

// ---- Saffire-II: the same samples in flight (0 g) and on the ground (1 g) -----------------------------------
export interface PairRow { sample: string; material: string; zero_g: string; one_g: string; outcome_0g: string }
export function GravityPairs({ data }: { data: PairRow[] }) {
  return (
    <div className="dtable-wrap">
      <table className="dtable">
        <thead><tr><th>Sample</th><th>Material</th><th><i className="ddot" style={{ background: 'var(--g0)' }} />0 g · flight</th><th><i className="ddot" style={{ background: 'var(--g1)' }} />1 g · ground</th></tr></thead>
        <tbody>
          {data.map((p) => {
            // the catalog marks a repeated material with a note in Portuguese; shown as a ditto
            const same = /^\(mesmo material/i.test(p.material)
            return (
              <tr key={p.sample}>
                <td className="dmono">{p.sample}</td>
                <td>{same ? <span className="faint" title="Same material as the row above">〃</span> : p.material}</td>
                <td><span className={`dout ${p.outcome_0g === 'extinguiu' ? 'out' : 'burn'}`}>{p.outcome_0g === 'extinguiu' ? 'barely burned' : 'burned'}</span> <span className="faint">{p.zero_g}</span></td>
                <td>{p.one_g.replace(/^1 g:\s*/, '')}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <p className="dcap">Cell text is the entry in the PSI table (burn duration in s, burn length in cm, or a note). The coloured word is the Atlas outcome class for the 0 g run.</p>
    </div>
  )
}

// ---- FLEX: how the burn ended per fuel and diluent, and burning rate against oxygen --------------------------
// END (how the burn ended) and DIL (diluent codes) are the tables the Findings page uses too: ../findings/labels.ts
export interface FlexData { groups: { group: string; n: number; extinguiu: number; disrupcao: number; queimou: number; k_mean: number }[]; points: { o2: number; k: number; dil: string; fuel?: string; id?: string }[] }

export function FlexOutcomes({ data }: { data: FlexData }) {
  const tip = useTip()
  return (
    <div className="dchart" ref={tip.host}>
      <div className="dkey">{END.map(([k, l, c]) => (<span key={k}><i className="dsw" style={{ background: c }} />{l}</span>))}</div>
      <div className="dflex" role="table" aria-label="FLEX: share of tests by how the burn ended, and mean burning-rate constant, per fuel and diluent">
        <div className="dflex-head" role="row"><span role="columnheader">Fuel · diluent</span><span role="columnheader">n</span><span role="columnheader">How the burn ended</span><span role="columnheader">Mean K, mm²/s</span></div>
        {data.groups.map((g) => (
          <div key={g.group} className="dflex-row" role="row">
            <span role="cell">{g.group}</span>
            <span role="cell" className="dnum">{nf(g.n)}</span>
            <span role="cell" className="dstack">
              {END.map(([k, l, c]) => { const v = g[k as 'extinguiu']; return v > 0 ? (
                <i key={k} style={{ flexGrow: v, background: c }} onMouseMove={(e) => tip.show(e, <><b>{g.group}</b><span>{l}: {pct(v, 1)} of {nf(g.n)} tests</span></>)} onMouseLeave={tip.hide}><span>{pct(v, 1)}</span></i>) : null })}
            </span>
            <span role="cell" className="dnum">{nf(g.k_mean, 2)}</span>
            <span role="cell" className="dflex-vals">{END.map(([k, l]) => `${l} ${pct(g[k as 'extinguiu'], 1)}`).join(' · ')}</span>
          </div>
        ))}
      </div>
      {tip.el}
      <p className="dcap">Each bar is 100% of that group's n tests, split by how the burn ended (the API's three outcome classes). Mean K is the unadjusted mean over the tests of the group that have a tabulated burning rate.</p>
    </div>
  )
}

export function FlexScatter({ data, onRecord }: { data: FlexData; onRecord: (id: string) => void }) {
  const tip = useTip(), W = tip.width
  const [table, setTable] = useState(false)   // before the early return: hooks must run in the same order on every render
  const pts = data.points
  if (!pts.length) return null
  const xs = pts.map((p) => p.o2), ys = pts.map((p) => p.k)
  const r6 = (v: number) => +v.toFixed(6)
  const x0 = Math.floor(r6((Math.min(...xs) - 0.01) * 20)) / 20, x1 = Math.ceil(r6((Math.max(...xs) + 0.01) * 20)) / 20
  const y1 = Math.ceil(r6(Math.max(...ys) * 5)) / 5
  const H = 244, sx = lin(x0, x1, 44, W - 14), sy = lin(0, y1, H - 30, 24)
  const seen = new Set(pts.map((p) => p.dil))
  const dils = [...Object.keys(DIL).filter((d) => seen.has(d)), ...[...seen].filter((d) => !DIL[d])]   // fixed order: colour follows the diluent
  const col = (d: string) => DIL[d]?.color ?? 'var(--faint)'
  return (
    <div className="dchart" ref={tip.host}>
      <div className="dkey">{dils.map((d) => (<span key={d}><i className="dsw round" style={{ background: col(d) }} />{DIL[d]?.label ?? d}</span>))}</div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`FLEX droplet burning-rate constant against initial oxygen, ${pts.length} tests, coloured by diluent`}>
        {ticks(0, y1, y1 > 1 ? 0.2 : 0.1).map((t) => (<g key={t}><line className="dgrid" x1={44} x2={W - 14} y1={sy(t)} y2={sy(t)} /><text className="dtick" x={38} y={sy(t) + 3} textAnchor="end">{nf(t, 1)}</text></g>))}
        {ticks(x0, x1, 0.05).map((t) => (<text key={t} className="dtick" x={sx(t)} y={H - 14} textAnchor="middle">{pct(t)}</text>))}
        <text className="daxis" x={8} y={9}>K, burning-rate constant (mm²/s)</text>
        <text className="daxis" x={W - 14} y={H - 1} textAnchor="end">initial O₂ (mole %)</text>
        {pts.map((p, i) => (
          <g key={p.id ?? i} className="dpt" onClick={() => p.id && onRecord(p.id)}
            onMouseMove={(e) => tip.show(e, <><b>{p.id ? p.id.split(':')[1] : 'FLEX test'}</b><span>{p.fuel ? p.fuel + ' · ' : ''}{DIL[p.dil]?.label ?? p.dil}</span><span>O₂ {pct(p.o2, 1)} · K {nf(p.k, 2)} mm²/s</span>{p.id && <em>Click for the source row</em>}</>)} onMouseLeave={tip.hide}>
            <circle cx={sx(p.o2)} cy={sy(p.k)} r={7} fill="transparent" />
            <circle cx={sx(p.o2)} cy={sy(p.k)} r={3} fill={col(p.dil)} />
          </g>
        ))}
      </svg>
      {tip.el}
      <p className="dcap">One point per FLEX test with a tabulated burning rate (n = {nf(pts.length)}). Click a point to open its row in the PSI table. <button className="dlink" aria-expanded={table} onClick={() => setTable(!table)}>{table ? 'Hide the data table' : 'Read the points as a table'}</button></p>
      {table && (
        <div className="dtable-wrap dscroll" tabIndex={0} aria-label="FLEX points as a table">
          <table className="dtable">
            <thead><tr><th>Test</th><th>Fuel</th><th>Diluent</th><th className="dnum">O₂, %</th><th className="dnum">K, mm²/s</th><th /></tr></thead>
            <tbody>{pts.map((p, i) => (
              <tr key={p.id ?? i}><td className="dmono">{p.id ? p.id.split(':')[1] : 'not identified'}</td><td>{p.fuel ?? 'unknown'}</td><td>{DIL[p.dil]?.label ?? p.dil}</td><td className="dnum">{nf(p.o2 * 100, 1)}</td><td className="dnum">{nf(p.k, 2)}</td>
                <td>{p.id && <button className="dlink" onClick={() => onRecord(p.id!)}>source row</button>}</td></tr>))}</tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ---- CFI-G: share of tests that ignited per band of adiabatic flame temperature ------------------------------
export interface BandRow { band: string; from: number; n: number; ignition: number }
export function IgnitionBands({ data }: { data: BandRow[] }) {
  const tip = useTip(), W = tip.width
  const H = 206, bw = (W - 62) / data.length, y = lin(0, 1, H - 38, 20)
  return (
    <div className="dchart" ref={tip.host}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`CFI-G: share of tests that ignited by adiabatic flame temperature band. ${data.map((d) => `${d.band} K: ${pct(d.ignition, 1)} of ${d.n}`).join('; ')}.`}>
        {ticks(0, 1, 0.25).map((t) => (<g key={t}><line className="dgrid" x1={46} x2={W - 8} y1={y(t)} y2={y(t)} /><text className="dtick" x={40} y={y(t) + 3} textAnchor="end">{pct(t)}</text></g>))}
        {data.map((d, i) => {
          const cx = 52 + i * bw + (bw - 8) / 2, wBar = Math.min(bw - 10, 30), bx = cx - wBar / 2
          return (
            <g key={d.band} className="dbar" onMouseMove={(e) => tip.show(e, <><b>{d.band} K</b><span>{pct(d.ignition, 1)} of {nf(d.n)} tests ignited</span></>)} onMouseLeave={tip.hide}>
              <rect className="dhit" x={cx - bw / 2} y={12} width={bw} height={H - 12} />
              <rect x={bx} y={y(d.ignition)} width={wBar} height={Math.max(1, y(0) - y(d.ignition))} rx={2} fill="var(--g1)" />
              <text className="dvalue" x={cx} y={y(d.ignition) - 5} textAnchor="middle">{pct(d.ignition)}</text>
              <text className="dtick" x={cx} y={H - 23} textAnchor="middle">{bw < 74 ? d.from : d.band}</text>
              <text className="dtick faint" x={cx} y={H - 11} textAnchor="middle">n = {d.n}</text>
            </g>
          )
        })}
        <text className="daxis" x={46} y={9}>tests that ignited (%)</text>
        <text className="daxis" x={W - 8} y={H - 1} textAnchor="end">adiabatic flame temperature{bw < 74 ? `, start of each ${data.length > 1 ? data[1].from - data[0].from : 200} K band` : ''} (K)</text>
      </svg>
      {tip.el}
    </div>
  )
}
