// Column 3 · Next fire: where the evidence stops and which experiments would move the edge.
// Scope, kept in view at all times: the queue comes from ONE published boundary, the BASS-II acrylic rod
// (/api/flammability/queue). Everything in this column is either a reading of that curve or a proposed test.
// Nothing here was performed by NASA unless it is drawn as a measured point.
import { useMemo, useState } from 'react'
import { gLabel, nf, pct, psi } from '../../lib/format'
import { safeHref } from '../../lib/url'
import type { Assessment, AuditItem, Boundary, FireQueue, FlamPoint, FlamTest, Flammability, Habitat, NextTest, Proposal, Scenario } from '../../types'
import { GAP, KIND, type FindingView, type Focus, type GapKind } from './links'
import { Empty, Failed, Gate, Guard, PaneHead, Pending, Section, Tag, lin, logScale, useTip } from './ui'
import type { Async } from './useAsync'

type Target = FireQueue['targets'][number]
const BURNED: FlamPoint['state'][] = ['queimou', 'vento_nao_apagou']
const STATE: Record<FlamPoint['state'], string> = {
  queimou: 'Burned', vento_nao_apagou: 'Burned, not blown out', apagou_pouco_ar: 'Went out for lack of air',
  apagou_vento: 'Blown out by the airflow', apagou_sozinha: 'Went out on its own', nao_sustentou: 'Did not sustain',
}
const limitText = (a: Assessment) => (a.limit_o2[1] - a.limit_o2[0] < 0.1 ? `${nf(a.limit_o2[0], 1)}%` : `${nf(a.limit_o2[0], 1)}–${nf(a.limit_o2[1], 1)}%`)
const atmosphere = (h: Habitat) => `${pct(h.o2)} O₂ · ${psi(h.pressure_atm)} · ${gLabel(h.gravity)}`

interface Props {
  queue: Async<FireQueue>; flam: Async<Flammability>; assess: Async<{ available: boolean; assessment?: Assessment }>
  scenario: Scenario; scenarioName: string; fuelNote: string | null; basis: string | null; basisName: string
  focus: Focus; linked: Set<string>; pinned: { label: string; ids: string[] } | null; onUnpin: () => void
  selected: string | null; onSelect: (id: string) => void
  findingsOf: (p: Proposal) => FindingView[]; onFinding: (id: string) => void
  onHabitat: (h: Habitat) => void; onRecord: (id: string) => void; onInvestigation: (id: string) => void; onOpenPage: () => void
  wind: number; gaps: Async<{ next: NextTest[]; method: string }>; materialName: string
}

// Audit severities as the API codes them (older responses in Portuguese), with the label shown.
const SEVERITY: Record<string, string> = { alta: 'high', 'média': 'medium', media: 'medium', baixa: 'low', high: 'high', medium: 'medium', low: 'low' }
export interface Quality { audit: AuditItem[]; flags: string[] }
// Open data-quality items of one BASS-II test: rows of the PSI-table-versus-report audit and the extractor's own flags.
export const qualityOf = (flam: Flammability | null | undefined, test: string): Quality => ({
  audit: (flam?.audit ?? []).filter((a) => a.test === test), flags: flam?.tests?.find((t) => t.test === test)?.flags ?? [],
})
export const severityLabel = (s: string) => SEVERITY[s] ?? s

export function NextFirePane(p: Props) {
  return (
    <section className="dpane" aria-label="Next fire">
      <PaneHead n="03" title="Next fire" question="Where are the evidence gaps, and which proposed experiments could address them?" />
      <Gate r={p.queue} what="the experiment queue">
        {(q) => (!q.available
          ? <Empty>The BASS-II outcomes have not been loaded into the database, so the API cannot build the queue. No proposal is shown.</Empty>
          : <Body q={q} {...p} />)}
      </Gate>
      <Guard what="The material-specific gap list"><MaterialGaps gaps={p.gaps} materialName={p.materialName} /></Guard>
      <footer className="dpane-foot"><button className="dlink" onClick={p.onOpenPage}>Open the Next fire page: printable sheets and the full queue as text →</button></footer>
    </section>
  )
}

function Body({ q, ...p }: Props & { q: FireQueue }) {
  const [kind, setKind] = useState<Proposal['kind'] | 'all'>('all')
  const [wantHabitat, setForHabitat] = useState(false)
  const target = q.targets.find((t) => t.habitat.id === p.scenario.habitat)
  // the habitat filter only exists while the scenario is a target environment with something untested
  const forHabitat = wantHabitat && !!target && target.gaps.length > 0
  // distinct factors, and separately how many environments have at least one: never the environment × factor product
  const factors = [...new Set(q.targets.flatMap((t) => t.gaps))], envs = q.targets.filter((t) => t.gaps.length).length
  const queueWind = q.targets[0]?.assessment?.forced_cm_s
  const closesHere = (x: Proposal) => !!target && x.closes.some((c) => c.habitat === target.habitat.id)
  const list = q.queue.filter((x) => (!p.pinned || p.pinned.ids.includes(x.id)) && (kind === 'all' || x.kind === kind) && (!forHabitat || closesHere(x)))
  const cur = list.find((x) => x.id === p.selected) ?? list[0] ?? null
  const kinds = [...new Set(q.queue.map((x) => x.kind))]
  const tested = p.flam.data?.boundaries?.[0]?.tested
  return (
    <>
      <div className="dscope">
        <p className="dscope-k">Scope of this column</p>
        <p>One sample and one curve. Sample: <b>{q.queue[0]?.material ?? 'the acrylic rod'}</b>. Investigation: {p.basis ? <button className="dlink" onClick={() => p.onInvestigation(p.basis!)}>{p.basisName}</button> : p.basisName}. Boundary: the one NASA published in <a href={safeHref(q.url)} target="_blank" rel="noreferrer">{q.source}</a>
          {tested && <>. Tested at {nf(tested.o2[0], 1)}–{nf(tested.o2[1], 1)}% O₂, up to {nf(tested.flow_cm_s_max)} cm/s, {psi(tested.pressure_atm)}, {gLabel(tested.gravity)}</>}. It does not describe other materials or other fire scenarios.</p>
        {p.fuelNote && <p className="dscope-warn">{p.fuelNote}</p>}
      </div>

      <dl className="dreadout wide">
        <div><dt>Proposed experiments</dt><dd>{nf(q.queue.length)}</dd></div>
        <div><dt>Distinct untested factors</dt><dd>{nf(factors.length)}<small>{factors.map((g) => GAP[g as GapKind] ?? g).join(' · ')}</small></dd></div>
        <div><dt>Target environments with a gap</dt><dd>{nf(envs)} of {nf(q.targets.length)}</dd></div>
      </dl>

      <Section title="Flammability map: what was burned, and where the targets sit" aside="O₂ × airflow">
        {p.flam.error ? <Failed what="the BASS-II test points" error={p.flam.error} retry={p.flam.reload} /> : !p.flam.data ? <Pending what="the BASS-II test points" />
          : !p.flam.data.available || !p.flam.data.boundaries?.length ? <Empty>The published boundary is not in the database, so the map cannot be drawn.</Empty>
            : <Guard what="The flammability map"><FlamMap flam={p.flam.data} form={q.form} targets={q.targets} scenario={p.scenario} assessment={p.assess.data?.assessment ?? null} closes={cur ? cur.closes.map((c) => c.habitat) : []} onRecord={p.onRecord} onHabitat={p.onHabitat} /></Guard>}
      </Section>

      <Section title={`Acrylic-rod reading for ${p.scenarioName}`} tag="curve">
        <ScenarioReading assess={p.assess} wind={p.wind} queueWind={queueWind} />
      </Section>

      <Section title="Target environments" tag="curve" aside="click to set the scenario">
        <ul className="dtargets">
          {q.targets.map((t) => (
            <li key={t.habitat.id}>
              <button className={`dtarget${t.habitat.id === p.scenario.habitat ? ' on' : ''}${cur?.closes.some((c) => c.habitat === t.habitat.id) ? ' linked' : ''}`} aria-pressed={t.habitat.id === p.scenario.habitat} onClick={() => p.onHabitat(t.habitat)}>
                <span className="dtarget-name"><b>{t.habitat.name}</b><span>{atmosphere(t.habitat)}</span></span>
                <span className="dtarget-gaps">{t.gaps.length ? t.gaps.map((g) => (<i key={g} className={cur?.closes.some((c) => c.habitat === t.habitat.id && c.what === g) ? 'closing' : ''}>{GAP[g as GapKind] ?? g}</i>)) : <i className="ok">inside the tested range</i>}</span>
                <span className="dtarget-limit"><span>O₂ limit read from the curve</span><b>{limitText(t.assessment)}</b><span>± {nf(t.assessment.band_o2, 1)}</span></span>
              </button>
            </li>
          ))}
        </ul>
        <p className="dcap">Chips are the factors no test covers for that environment. A wide limit means gravity adds an airflow nobody has measured. Highlighted chips are the ones the selected experiment would close.</p>
      </Section>

      <Section title="Proposed experiments, in priority order" tag="proposed" aside={`${list.length} of ${q.queue.length}`}>
        {p.pinned && <p className="dlinknote">Showing the {p.pinned.ids.length} linked to <b>{p.pinned.label}</b>. <button className="dlink" onClick={p.onUnpin}>Show all {q.queue.length}</button></p>}
        <div className="dfilters" role="group" aria-label="Filter the queue">
          <button aria-pressed={kind === 'all'} onClick={() => setKind('all')}>All kinds</button>
          {kinds.map((k) => (<button key={k} aria-pressed={kind === k} onClick={() => setKind(kind === k ? 'all' : k)}>{KIND[k] ?? k} <span>{q.queue.filter((x) => x.kind === k).length}</span></button>))}
          {target && target.gaps.length > 0 && <button aria-pressed={forHabitat} onClick={() => setForHabitat(!forHabitat)}>Closes a gap for {target.habitat.name} <span>{q.queue.filter(closesHere).length}</span></button>}
        </div>
        {list.length === 0 ? <Empty>No proposed experiment matches these filters.</Empty> : (
          <ol className="dqueue">
            {list.map((x) => {
              const habs = new Set(x.closes.map((c) => c.habitat)).size
              return (
                <li key={x.id}>
                  <button className={`dprop${cur?.id === x.id ? ' on' : ''}${p.linked.has(x.id) ? ' linked' : ''}`} aria-current={cur?.id === x.id} onClick={() => p.onSelect(x.id)}>
                    <span className="dprop-n">{x.rank}</span>
                    <span className="dprop-t">
                      <b>{x.title}</b>
                      <span>{x.closes.length ? `closes ${x.closes.length} ${x.closes.length === 1 ? 'gap' : 'gaps'} in ${habs} ${habs === 1 ? 'environment' : 'environments'}` : 'closes no environment gap'} · {x.new_factors.length === 0 ? 'no new factor' : `${x.new_factors.length} new ${x.new_factors.length === 1 ? 'factor' : 'factors'}`}{x.gain_o2 > 0 ? ` · removes ${nf(x.gain_o2, 1)} O₂ points of band` : ''}</span>
                    </span>
                    <span className="dprop-k">{KIND[x.kind] ?? x.kind}{target && closesHere(x) && <em title={`Closes a gap for ${target.habitat.name}`} />}</span>
                  </button>
                </li>
              )
            })}
          </ol>
        )}
        <details className="dhow"><summary>How the queue is ordered</summary><p>{q.method}</p><p>The order is a fixed rule over the published curve. It is not an opinion of a language model, and it is not a NASA plan.</p></details>
      </Section>

      {cur && <Sheet x={cur} band={q.band_o2} url={q.url} findings={p.findingsOf(cur)} onFinding={p.onFinding} />}
    </>
  )
}

function ScenarioReading({ assess, wind, queueWind }: { assess: Props['assess']; wind: number; queueWind?: number }) {
  if (assess.error) return <Failed what="the curve reading" error={assess.error} retry={assess.reload} />
  if (!assess.data) return <Pending what="the curve reading" />
  const a = assess.data.assessment
  if (!assess.data.available || !a) return <Empty>The API has no published boundary to read for this scenario.</Empty>
  return (
    <div className="dreading">
      <p className="dreading-h"><b>{a.headline}.</b> {a.detail}</p>
      <dl className="dkv">
        <div><dt>O₂ needed to sustain a flame</dt><dd>{limitText(a)} ± {nf(a.band_o2, 1)}</dd></div>
        <div><dt>Airflow at the flame</dt><dd>{a.flow_cm_s[0] === a.flow_cm_s[1] ? `${nf(a.flow_cm_s[0])} cm/s` : `${nf(a.flow_cm_s[0])}–${nf(a.flow_cm_s[1])} cm/s`} <span className="faint">({nf(a.forced_cm_s)} cm/s cabin ventilation{a.buoyant_cm_s[1] > 0 ? `, plus 0–${nf(a.buoyant_cm_s[1])} from gravity` : ''})</span></dd></div>
        <div><dt>Inside the tested range</dt><dd>{a.inside_tested ? 'yes' : 'no: this is an extrapolation'}</dd></div>
      </dl>
      {a.outside.length > 0 && (<><h4>What no test covers for this scenario</h4><ul className="dgaps">{a.outside.map((t) => <li key={t}>{t}</li>)}</ul></>)}
      <p className="dcap">Source: {a.source}. The estimate is the published curve read at this atmosphere with {nf(wind)} cm/s of forced airflow (the Airflow control above). It is not a measurement and not a probability.{typeof queueWind === 'number' && Math.abs(queueWind - wind) > 0.5 ? ` The target environments and the queue below were computed by the API at its fixed reference of ${nf(queueWind)} cm/s and do not follow the Airflow control.` : ''}</p>
    </div>
  )
}

// O₂ against airflow: the published boundary, the measured rod tests, the tested envelope and the targets.
function FlamMap({ flam, form, targets, scenario, assessment, closes, onRecord, onHabitat }: {
  flam: Flammability; form: string; targets: Target[]; scenario: Scenario; assessment: Assessment | null; closes: string[]
  onRecord: (id: string) => void; onHabitat: (h: Habitat) => void
}) {
  const tip = useTip()
  const [table, setTable] = useState(false)
  const b: Boundary = flam.boundaries!.find((x) => x.form === form) ?? flam.boundaries![0]
  const pts = useMemo(() => flam.tests.filter((t) => t.form === b.form).flatMap((t: FlamTest) => t.points.filter((x) => x.flow_cm_s != null).map((x) => ({ t, x }))), [flam, b.form])
  const W = tip.width, H = Math.round(Math.min(400, Math.max(300, W * 0.64))), L = 40, R = 14, T = 14, B = 36, X0 = 0.3, X1 = 60
  const isTarget = targets.some((t) => t.habitat.id === scenario.habitat)
  const sO2 = scenario.o2 * 100
  const yMax = Math.ceil(Math.max(b.tested.o2[1], ...targets.map((t) => t.habitat.o2 * 100), !isTarget && sO2 <= 45 ? sO2 : 0) + 2)
  const yMin = Math.floor(Math.min(b.tested.o2[0], ...b.curve.map((c) => c.o2)) - 2)
  const x = logScale(X0, X1, L, W - R), y = lin(yMin, yMax, H - B, T)
  const cx = (u: number) => x(Math.min(X1, Math.max(X0, u)))
  const curve = b.curve.filter((c) => c.flow_cm_s >= X0 && c.flow_cm_s <= X1)
  const path = (d: number) => curve.map((c, i) => `${i ? 'L' : 'M'}${x(c.flow_cm_s).toFixed(1)},${y(c.o2 + d).toFixed(1)}`).join('')
  const band = path(b.band_o2) + curve.slice().reverse().map((c) => `L${x(c.flow_cm_s).toFixed(1)},${y(c.o2 - b.band_o2).toFixed(1)}`).join('') + 'Z'
  // targets that share oxygen and airflow are drawn once, with both names
  const groups = new Map<string, Target[]>()
  for (const t of targets) { const k = `${t.habitat.o2}|${t.assessment.flow_cm_s.join('-')}`; groups.set(k, [...(groups.get(k) ?? []), t]) }
  const yTicks: number[] = []; for (let v = Math.ceil(yMin / 5) * 5; v <= yMax; v += 5) yTicks.push(v)
  const c = b.published?.coef, ck = b.check
  const rodTests = flam.tests.filter((t) => t.form === b.form)
  const flaggedTests = rodTests.filter((t) => { const ql = qualityOf(flam, t.test); return ql.audit.length + ql.flags.length > 0 }).length
  const sevCount = (flam.audit ?? []).reduce<Record<string, number>>((m, a) => { const k = severityLabel(a.severity); m[k] = (m[k] ?? 0) + 1; return m }, {})
  const sev = ['high', 'medium', 'low'].filter((k) => sevCount[k]).map((k) => `${sevCount[k]} ${k}`)
  return (
    <div className="dchart dmap" ref={tip.host}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`Flammability map for the acrylic rod. Tested between ${b.tested.o2[0]}% and ${b.tested.o2[1]}% oxygen. ${targets.map((t) => `${t.habitat.name} at ${pct(t.habitat.o2)}`).join(', ')}.`}>
        <defs><pattern id="dhatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" /></pattern></defs>
        {/* above the highest oxygen ever tested: no solid-fuel test at all */}
        <rect className="dmap-unknown" x={L} y={T} width={W - R - L} height={Math.max(0, y(b.tested.o2[1]) - T)} />
        <text className="dmap-note" x={L + 8} y={y(b.tested.o2[1]) - 7}>↑ no test with this sample above {nf(b.tested.o2[1], 1)}% O₂</text>
        {yTicks.map((v) => (<g key={v}><line className="dgrid" x1={L} x2={W - R} y1={y(v)} y2={y(v)} /><text className="dtick" x={L - 6} y={y(v) + 3} textAnchor="end">{v}%</text></g>))}
        {[0.3, 1, 3, 10, 30, 60].map((v) => (<g key={v}><line className="dgrid" x1={x(v)} x2={x(v)} y1={T} y2={H - B} /><text className="dtick" x={x(v)} y={H - B + 14} textAnchor="middle">{v === X0 ? '≤0.3' : v}</text></g>))}
        <text className="daxis" x={W - R} y={H - 4} textAnchor="end">airflow at the flame (cm/s, log scale)</text>
        <text className="daxis" x={L} y={9}>O₂ (mole %)</text>
        {/* tested envelope */}
        <rect className="dmap-env" x={L} y={y(b.tested.o2[1])} width={cx(b.tested.flow_cm_s_max) - L} height={y(b.tested.o2[0]) - y(b.tested.o2[1])} />
        {W >= 440 && <text className="dmap-note env" x={cx(b.tested.flow_cm_s_max) - 7} y={y(b.tested.o2[1]) + 13} textAnchor="end">tested envelope</text>}
        <text className="dmap-note" x={x(4)} y={y(yMin) - 6} textAnchor="middle">below the curve: no sustained flame</text>
        <path className="dmap-band" d={band} />
        <path className="dmap-curve" d={path(0)} />
        {pts.map(({ t, x: pt }, i) => {
          const burned = BURNED.includes(pt.state), ql = qualityOf(flam, t.test), flagged = ql.audit.length + ql.flags.length > 0
          return (
            <g key={t.atlas_id + i} className={`dpt${flagged ? ' flagged' : ''}`} onClick={() => onRecord(t.atlas_id)}
              onMouseMove={(e) => tip.show(e, <><b>BASS-II {t.test}</b><span>{STATE[pt.state] ?? pt.state}</span><span>O₂ {nf(pt.o2, 1)}% · {pt.flow_cm_s! < X0 ? 'under 0.3' : nf(pt.flow_cm_s!, 1)} cm/s</span>{t.report_page && <span>Report p. {t.report_page}</span>}{ql.audit.map((a, k) => <span key={k} className="dwarn">Audit · {severityLabel(a.severity)}: {a.field === 'teste' ? 'test row' : a.field}, {a.kind}</span>)}{ql.flags.map((x, k) => <span key={'f' + k} className="dwarn">Extractor flag: {x.length > 70 ? x.slice(0, 68) + '…' : x}</span>)}<em>Click for the source row</em></>)} onMouseLeave={tip.hide}>
              <circle cx={cx(pt.flow_cm_s!)} cy={y(pt.o2)} r={7} fill="transparent" />
              {flagged && <rect className="dflagmark" x={cx(pt.flow_cm_s!) - 5.5} y={y(pt.o2) - 5.5} width={11} height={11} />}
              <circle className={burned ? 'burn' : 'out'} cx={cx(pt.flow_cm_s!)} cy={y(pt.o2)} r={2.9} />
            </g>
          )
        })}
        {[...groups.values()].map((g) => {
          const a = g[0].assessment, o2 = g[0].habitat.o2 * 100
          const on = g.some((t) => t.habitat.id === scenario.habitat), link = g.some((t) => closes.includes(t.habitat.id))
          const x0 = cx(a.flow_cm_s[0]), x1 = cx(a.flow_cm_s[1])
          return (
            <g key={g[0].habitat.id} className={`dmap-target${on ? ' on' : ''}${link ? ' linked' : ''}`} role="button" tabIndex={0} aria-label={`Set the scenario to ${g[0].habitat.name}`}
              onClick={() => onHabitat(g[0].habitat)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onHabitat(g[0].habitat) } }}
              onMouseMove={(e) => tip.show(e, <><b>{g.map((t) => t.habitat.name).join(', ')}</b><span>{nf(o2, 1)}% O₂ · airflow {a.flow_cm_s[0] === a.flow_cm_s[1] ? nf(a.flow_cm_s[0]) : `${nf(a.flow_cm_s[0])}–${nf(a.flow_cm_s[1])}`} cm/s</span><span>{a.inside_tested ? 'Inside the tested range' : 'Outside the tested range: curve reading only'}</span></>)} onMouseLeave={tip.hide}>
              <rect className="dhit" x={L} y={y(o2) - 9} width={W - R - L} height={18} />
              <line x1={x0} x2={Math.max(x1, x0 + 0.01)} y1={y(o2)} y2={y(o2)} />
              <path d={`M${x0},${y(o2) - 5}v10`} />{x1 > x0 && <path d={`M${x1},${y(o2) - 5}v10`} />}
              {x1 === x0 && <circle cx={x0} cy={y(o2)} r={4} />}
              <text x={x0 - 8} y={y(o2) + 3.5} textAnchor="end">{g.map((t) => t.habitat.name).join(' · ')} · {nf(o2)}%</text>
            </g>
          )
        })}
        {!isTarget && assessment && (sO2 <= yMax ? (
          <g className="dmap-target on">
            <line x1={cx(assessment.flow_cm_s[0])} x2={Math.max(cx(assessment.flow_cm_s[1]), cx(assessment.flow_cm_s[0]) + 0.01)} y1={y(sO2)} y2={y(sO2)} />
            <circle cx={cx(assessment.flow_cm_s[0])} cy={y(sO2)} r={4} />
            <text x={cx(assessment.flow_cm_s[0]) - 8} y={y(sO2) + 3.5} textAnchor="end">Scenario · {nf(sO2, 1)}%</text>
          </g>
        ) : (
          <g className="dmap-target on"><path d={`M${W - R - 60},${T + 16}l5,-8l5,8z`} /><text x={W - R - 66} y={T + 15} textAnchor="end">Scenario at {nf(sO2)}% O₂, above this axis</text></g>
        ))}
      </svg>
      {tip.el}
      <ul className="dkey wrap">
        <li><i className="dsw round" style={{ background: 'var(--g1)' }} />Test point: flame sustained</li>
        <li><i className="dsw round hollow" />Test point: flame went out</li>
        <li><i className="dsw flag" />Test with an open data-quality item</li>
        <li><i className="dsw line" />Published boundary, with ± {nf(b.band_o2, 2)} scatter</li>
        <li><i className="dsw env" />Tested envelope</li>
        <li><i className="dsw target" />Target environment (not tested)</li>
      </ul>
      <div className="dquality">
        <Tag k="extracted" />
        <p>
          The {nf(pts.length)} points are not raw instrument readings: the Atlas extracted them from the test log of the NASA report. {flam.method}
          {' '}<b>{nf(flaggedTests)} of {nf(rodTests.length)}</b> tests of this sample carry an open data-quality item (squares on the map).
          Across all BASS-II samples the audit of the PSI table against the report lists <b>{nf(flam.audit?.length ?? 0)}</b> items{sev.length ? ` (${sev.join(', ')})` : ''}. They are discrepancies between two NASA sources, not confirmed errors and not separate experiments; no point is dropped or corrected because of them.
        </p>
      </div>
      <p className="dcap">
        Boundary: O₂ limit = {nf(c?.A ?? NaN, 1)}·exp(−{nf(c?.k ?? NaN, 1)}·a) + {nf(c?.B ?? NaN, 4)}·a + {nf(c?.C ?? NaN, 1)}, with stretch rate a = 3/2·U/r₀ and r₀ = {nf(c?.r0_cm ?? NaN, 3)} cm ({b.published?.source}).
        {ck?.blowoff && ck?.quench && <>{' '}Checked by the API against the extracted points: {ck.blowoff.n} blow-off points with an RMS difference of {nf(ck.blowoff.rms_diff_o2, 2)} O₂ points; {ck.quench.on_curve} of {ck.quench.n} low-airflow extinctions on the curve.</>}
        {' '}A target drawn as a segment has an unknown airflow: gravity adds a draught nobody has measured at partial gravity. Points below 0.3 cm/s are drawn at the left edge.
        {' '}<button className="dlink" aria-expanded={table} onClick={() => setTable(!table)}>{table ? 'Hide the data table' : 'Read the points as a table'}</button>
      </p>
      {table && (
        <div className="dtable-wrap dscroll" tabIndex={0} aria-label="BASS-II test points as a table">
          <table className="dtable">
            <thead><tr><th>Test</th><th>End state</th><th className="dnum">O₂, %</th><th className="dnum">Airflow, cm/s</th><th>Data quality</th><th /></tr></thead>
            <tbody>{pts.map(({ t, x: pt }, i) => { const ql = qualityOf(flam, t.test); return (
              <tr key={t.atlas_id + i}><td className="dmono">{t.test}</td><td>{STATE[pt.state] ?? pt.state}</td><td className="dnum">{nf(pt.o2, 1)}</td><td className="dnum">{nf(pt.flow_cm_s!, 1)}</td>
                <td>{ql.audit.length + ql.flags.length ? `${ql.audit.length} audit · ${ql.flags.length} extractor` : 'no open item'}</td>
                <td><button className="dlink" onClick={() => onRecord(t.atlas_id)}>source row</button></td></tr>) })}</tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function Sheet({ x, band, url, findings, onFinding }: { x: Proposal; band: number; url: string; findings: FindingView[]; onFinding: (id: string) => void }) {
  const shrink = x.lunar.width_after_o2 < x.lunar.width_before_o2
  // bar lengths only: the band from the unknown gravity airflow plus the scatter of the tests (both from the API)
  const before = x.lunar.width_before_o2 + 2 * band, after = x.lunar.width_after_o2 + 2 * band
  const widthText = (w: number) => (w > 0 ? `${nf(w, 1)} O₂ points of band, plus the ± ${nf(band, 1)} scatter` : `scatter of the tests only, ± ${nf(band, 1)}`)
  return (
    <article className="dsheet" aria-label={`Proposed experiment ${x.rank}: ${x.title}`}>
      <header>
        <span className="dkicker">Proposed experiment {x.rank} · {KIND[x.kind] ?? x.kind}</span>
        <h3>{x.title}</h3>
        <Tag k="proposed" />
      </header>
      <dl className="dkv">
        <div><dt>Sample</dt><dd>{x.material}</dd></div>
        <div><dt>Oxygen</dt><dd>{x.o2}</dd></div>
        <div><dt>Pressure</dt><dd>{x.pressure}</dd></div>
        <div><dt>Gravity</dt><dd>{x.gravity}</dd></div>
        <div><dt>Airflow</dt><dd>{x.flow}</dd></div>
        <div><dt>Measure</dt><dd>{x.measure}</dd></div>
        <div><dt>New factors</dt><dd>{x.new_factors.length ? x.new_factors.join(', ') : 'none: same conditions BASS-II already used'}</dd></div>
        <div><dt>Platform</dt><dd>{x.platform}</dd></div>
      </dl>
      <div className="dsheet-two">
        <div><h4>What the published curve predicts <Tag k="curve">curve reading</Tag></h4><p>{x.prediction}</p></div>
        <div><h4>What the result would decide</h4><p>{x.decides}</p></div>
      </div>
      <div className="dsheet-two">
        <div>
          <h4>Gaps it would close</h4>
          {x.closes.length ? <ul className="dgaps closing">{x.closes.map((c) => <li key={c.habitat + c.what}><b>{c.name}</b>: {c.label}</li>)}</ul> : <p className="faint">None for a target environment.</p>}
        </div>
        <div>
          <h4>Still open afterwards</h4>
          {x.remains.length ? <ul className="dgaps">{x.remains.map((r) => <li key={r}>{r}</li>)}</ul> : <p className="faint">Nothing among the target environments.</p>}
        </div>
      </div>
      <div>
        <h4>Effect on the lunar-base O₂ limit <Tag k="curve">modelled interval</Tag></h4>
        <p>{x.lunar.text}</p>
        {shrink && (
          <div className="dinterval" role="img" aria-label={`Oxygen-limit band for the lunar base. Today: ${widthText(x.lunar.width_before_o2)}. After this test: ${widthText(x.lunar.width_after_o2)}.`}>
            <span>today</span><i style={{ width: '100%' }} /><b>{widthText(x.lunar.width_before_o2)}</b>
            <span>after</span><i className="after" style={{ width: `${(after / before) * 100}%` }} /><b>{widthText(x.lunar.width_after_o2)}</b>
          </div>
        )}
        {shrink && <p className="dcap">The band comes from the airflow gravity would add, which nobody has measured at partial gravity. This is the reduction expected if the test is run; it is a property of the model, not a result.</p>}
      </div>
      {x.check_first && <div className="dcheck"><h4>Check first</h4><p>{x.check_first}</p></div>}
      {findings.length > 0 && (
        <div><h4>Findings about the same factor</h4><p className="dchips">{findings.map((f) => (<button key={f.insight.id} className="dchip" onClick={() => onFinding(f.insight.id)}>Finding<span>{f.spec?.kicker ?? f.insight.title}</span></button>))}</p></div>
      )}
      <p className="dsources"><b>Sources</b> {x.sources.map((s, i) => (<span key={s}>{i > 0 && ' · '}{i === 0 ? <a href={safeHref(url)} target="_blank" rel="noreferrer">{s}</a> : s}</span>))}</p>
    </article>
  )
}

// A second, different methodology: /api/next-tests. A greedy heuristic over the evidence-coverage rule, for the
// material the scenario asks for. It shares nothing with the BASS-II queue above (no curve, no predicted value).
function MaterialGaps({ gaps, materialName }: { gaps: Props['gaps']; materialName: string }) {
  return (
    <Section title={`Coverage gaps for ${materialName}`} tag="heuristic" className="dmatgaps">
      <p className="dcap"><b>Different method from the queue above.</b> These are not readings of a published curve: they are the test conditions that would most raise the evidence-coverage level of the target environments for this fuel, picked by a fixed rule. They predict no result.</p>
      {gaps.error ? <Failed what="the material-specific gaps" error={gaps.error} retry={gaps.reload} /> : !gaps.data ? <Pending what="the material-specific gaps" />
        : !gaps.data.next?.length ? <Empty>For this fuel the heuristic finds no single test that would raise the coverage level of a target environment.</Empty> : (
          <>
            <ol className="dmg">
              {gaps.data.next.map((n, i) => (
                <li key={i}>
                  <span className="dprop-n">{i + 1}</span>
                  <div>
                    <b>{pct(n.o2, 1)} O₂ · {psi(n.pressure_atm)} · {gLabel(n.gravity)}</b> <Tag k="proposed" />
                    <span>{n.platform}</span>
                    <ul>{(n.closes ?? []).map((c) => <li key={c}>{c}</li>)}</ul>
                  </div>
                </li>
              ))}
            </ol>
            <p className="dcap">{gaps.data.method} Each line reads "environment: coverage level today → level after the test".</p>
          </>
        )}
    </Section>
  )
}
