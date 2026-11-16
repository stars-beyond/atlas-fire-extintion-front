// Column 1 · Findings: what the tabulated NASA data demonstrate.
// Every insight /api/insights returns is listed, whatever its id: the ones this screen knows get a chart, the
// change card and the automatic cards get a plain source-backed summary, and nothing gets an invented chart.
// Findings are GLOBAL: they are computed over the whole archive and do not change with the scenario. The pane
// says so, and only marks whether a finding concerns the fuel family the scenario asks for.
import { FAMILY, OUTCOME, gLabel, nf } from '../../lib/format'
import type { Habitat, Investigation, Scenario } from '../../types'
import { CoverageChart, FlexOutcomes, FlexScatter, GravityPairs, IgnitionBands } from './findingCharts'
import { o2Range, psiRange, psiUrl, sortFindings, type FindingSort, type FindingView, type Focus, type GapKind, type Relation } from './links'
import { Empty, Gate, Guard, PaneHead, Tag } from './ui'
import type { Async } from './useAsync'

interface Props {
  insights: Async<FindingView[]>
  invById: Map<string, Investigation>
  habitats: Habitat[]; scenario: Scenario
  focus: Focus; open: string | null; linked: Set<string>
  sort: FindingSort; onSort: (s: FindingSort) => void
  relationOf: (f: FindingView) => Relation
  onSelect: (id: string) => void; onInvestigation: (id: string) => void; onFamily: (family: string) => void
  onRecord: (id: string) => void; onNextFire: (kinds: GapKind[], proposals: string[]) => void; onOpenPage: () => void
}

const KICKER: Record<FindingView['kind'], string> = { chart: '', change: 'Archive change', auto: 'New investigation · automatic summary', text: 'Computed finding' }

export function FindingsPane(p: Props) {
  const invFocus = p.focus?.kind === 'investigation' ? p.invById.get(p.focus.id) : undefined
  return (
    <section className="dpane" aria-label="Findings">
      <PaneHead n="01" title="Findings" question="What have the NASA experimental records actually demonstrated?" />
      <Gate r={p.insights} what="the findings">
        {(all) => {
          const list = sortFindings(all, p.sort, p.scenario.family, (id) => p.invById.get(id)?.family)
          return (
            <>
              <div className="dnote">
                <b>Global experimental findings.</b> Computed by the API over the whole archive; the reference scenario does not change their numbers. A finding is marked when it concerns a different fuel family than the scenario.
              </div>
              {all.length === 0 && <Empty>The API returned no computed finding. This happens when the experimental tables have not been ingested.</Empty>}
              {all.length > 0 && (
                <label className="dselect inline dsort"><span>Order</span>
                  <select value={p.sort} onChange={(e) => p.onSort(e.target.value as FindingSort)}>
                    <option value="curated">Charted findings first</option>
                    <option value="fuel">Scenario fuel family first</option>
                    <option value="api">As the API returns them</option>
                  </select>
                </label>
              )}
              {invFocus && (
                <p className="dlinknote">
                  {p.linked.size ? <><b>{p.linked.size} of {all.length}</b> findings use {invFocus.name} data.</> : <>No finding is computed from {invFocus.name} data.</>}
                </p>
              )}
              <ol className="dfindings">
                {list.map((f, i) => {
                  const on = p.open === f.insight.id, link = p.linked.has(f.insight.id)
                  const fams = [...new Set(f.sources.map((id) => p.invById.get(id)?.family).filter(Boolean))] as string[]
                  const off = p.scenario.family !== 'todas' && fams.length > 0 && !fams.includes(p.scenario.family)
                  return (
                    <li key={f.insight.id} className={`dfinding dfinding-${f.kind}${on ? ' on' : ''}${link ? ' linked' : ''}${off ? ' off' : ''}`}>
                      <button className="dfinding-head" aria-expanded={on} onClick={() => p.onSelect(f.insight.id)}>
                        <span className="dfinding-n">F{i + 1}</span>
                        <span className="dfinding-t">
                          <span className="dkicker">{f.spec?.kicker ?? KICKER[f.kind]}</span>
                          <b>{f.insight.title}</b>
                          <span className="dfinding-meta">
                            {fams.map((x) => <span key={x} className={`dfam dfam-${x}`}>{FAMILY[x] ?? x}</span>)}
                            <span>{f.insight.source || 'source not stated by the API'}</span>
                            {link && <span className="dlinked">linked</span>}
                            {off && <span className="doff">other fuel family than the scenario</span>}
                          </span>
                        </span>
                      </button>
                      {on && <Guard what="This finding"><FindingBody f={f} {...p} /></Guard>}
                    </li>
                  )
                })}
              </ol>
              <footer className="dpane-foot">
                <button className="dlink" onClick={p.onOpenPage}>Open the Findings page: every finding with its full chart and the chart builder →</button>
              </footer>
            </>
          )
        }}
      </Gate>
    </section>
  )
}

function FindingBody(p: Props & { f: FindingView }) {
  const { f } = p
  if (f.kind === 'change') return <ChangeBody f={f} onInvestigation={p.onInvestigation} invById={p.invById} />
  if (f.kind === 'auto') return <AutoBody f={f} onInvestigation={p.onInvestigation} invById={p.invById} />
  if (f.kind === 'text' || !f.spec) return <TextBody f={f} onInvestigation={p.onInvestigation} invById={p.invById} onOpenPage={p.onOpenPage} />
  const { insight: i, spec } = f
  const d = i.data
  const sources = f.sources.map((id) => p.invById.get(id)).filter(Boolean) as Investigation[]
  const rel = p.relationOf(f)
  const assumed = sources.filter((v) => v.stats?.pressure_assumed).map((v) => v.name)
  return (
    <div className="dfinding-body">
      <div className="dstatement">
        <Tag k="summary" />
        <p>{i.finding}</p>
      </div>
      <div className="dreadingnote">
        <h4>What the numbers establish</h4>
        <p>{spec.reading(d, sources)}</p>
      </div>
      {i.id === 'cobertura' && Array.isArray(d) && <CoverageChart data={d} habitats={p.habitats} scenarioO2={p.scenario.o2} family={p.scenario.family} onFamily={p.onFamily} pressureAssumed={assumed.length > 0} />}
      {i.id === 'saffire_gravidade' && Array.isArray(d) && <GravityPairs data={d} />}
      {i.id === 'flex_desfecho' && d?.groups && (<><FlexOutcomes data={d} /><FlexScatter data={d} onRecord={p.onRecord} /></>)}
      {i.id === 'cfig_ignicao' && Array.isArray(d) && <IgnitionBands data={d} />}
      <dl className="dfacts">
        <div><dt>Quantity</dt><dd>{spec.measure}</dd></div>
        <div><dt>Population</dt><dd>{spec.conditions}</dd></div>
        <div><dt>Sample size</dt><dd>{spec.n(d) || 'not stated in the response'}</dd></div>
        <div><dt>Investigations</dt><dd className="dchips">
          {f.sources.map((id) => (<button key={id} className="dchip" onClick={() => p.onInvestigation(id)} title="Open this investigation in the Investigations column">{p.invById.get(id)?.name ?? id}<span>{id}</span></button>))}
        </dd></div>
        <div><dt>Source</dt><dd>PSI experimental {f.sources.length === 1 ? 'table' : 'tables'} of {f.sources.map((id, k) => (<span key={id}>{k > 0 && ', '}<a href={psiUrl(id)} target="_blank" rel="noreferrer">{id} ↗</a></span>))}; statistic computed by <span className="dmono">/api/insights</span> ({i.id})</dd></div>
      </dl>
      <div className="dlimits">
        <h4>Limits of this reading</h4>
        <ul>{spec.limits(d, sources).map((t) => <li key={t}>{t}</li>)}</ul>
      </div>
      <div className={`dbridge dbridge-${rel.level}`}>
        <span className="dbridge-k">Next fire</span>
        <p>{rel.text}</p>
        {rel.proposals.length > 0 && <button className="dbtn" onClick={() => p.onNextFire(spec.variables, rel.proposals)}>Show {rel.proposals.length === 1 ? 'it' : `these ${rel.proposals.length}`} in the queue →</button>}
      </div>
    </div>
  )
}

type Small = { f: FindingView; invById: Map<string, Investigation>; onInvestigation: (id: string) => void }
const InvChips = ({ ids, invById, onInvestigation }: { ids: string[] } & Omit<Small, 'f'>) => (ids.length ? (
  <p className="dchips">{ids.map((id) => (<button key={id} className="dchip" onClick={() => onInvestigation(id)} disabled={!invById.has(id)} title={invById.has(id) ? 'Open in the Investigations column' : 'Not in the investigation catalog of this response'}>{invById.get(id)?.name ?? id}<span>{id}</span></button>))}</p>
) : null)

// "novidades": what the last ingestion added. Shown as a change in the archive, never as a physical result.
function ChangeBody({ f, invById, onInvestigation }: Small) {
  const d = (f.insight.data ?? {}) as { since?: string | null; new_investigations?: { ID?: string; Name?: string }[]; removed_investigations?: string[]; new_tests?: Record<string, number>; new_documents?: unknown[] }
  const tests = Object.entries(d.new_tests ?? {}).filter(([, n]) => typeof n === 'number')
  const since = d.since ? new Date(d.since) : null
  return (
    <div className="dfinding-body">
      <div className="dstatement"><Tag k="change" /><p>{f.insight.finding}</p></div>
      <dl className="dfacts">
        <div><dt>Compared with</dt><dd>{since && !Number.isNaN(since.getTime()) ? `the Atlas ingestion of ${since.toISOString().slice(0, 16).replace('T', ' ')} UTC` : 'previous ingestion: date not stated'}</dd></div>
        <div><dt>New investigations</dt><dd>{nf(d.new_investigations?.length ?? 0)}</dd></div>
        <div><dt>New tabulated tests</dt><dd>{tests.length ? tests.map(([id, n]) => `${nf(n)} in ${invById.get(id)?.name ?? id}`).join(' · ') : '0'}</dd></div>
        <div><dt>New documents</dt><dd>{nf(d.new_documents?.length ?? 0)}</dd></div>
        {(d.removed_investigations?.length ?? 0) > 0 && <div><dt>Left the PSI list</dt><dd>{d.removed_investigations!.join(', ')}</dd></div>}
        <div><dt>Source</dt><dd>{f.insight.source}; <span className="dmono">/api/insights</span> (novidades)</dd></div>
      </dl>
      <InvChips ids={[...(d.new_investigations ?? []).map((v) => v.ID ?? '').filter(Boolean), ...tests.map(([id]) => id)].filter((v, k, a) => a.indexOf(v) === k)} invById={invById} onInvestigation={onInvestigation} />
      <p className="dcap">This is a comparison between two Atlas ingestions. It says what the Atlas started to hold, not when NASA ran or published it.</p>
    </div>
  )
}

// "auto_<PSI-id>": statistics computed at ingestion for an investigation without a hand-written profile.
function AutoBody({ f, invById, onInvestigation }: Small) {
  const d = (f.insight.data ?? {}) as { n_tests?: number; n_plot?: number; o2?: number[]; pressure_atm?: number[]; outcomes?: Record<string, number>; varies?: string[]; fuels?: string[]; gravity?: number[] }
  const pair = (r?: number[]) => (Array.isArray(r) && r.length === 2 ? [r[0], r[1]] as [number, number] : null)
  const outs = Object.entries(d.outcomes ?? {}).filter(([, n]) => n > 0)
  return (
    <div className="dfinding-body">
      <div className="dstatement"><Tag k="derived">Automatic summary</Tag><p>{f.insight.finding}</p></div>
      <dl className="dfacts">
        <div><dt>Tabulated tests</dt><dd>{typeof d.n_tests === 'number' ? nf(d.n_tests) : 'unknown'}</dd></div>
        <div><dt>With O₂ and pressure</dt><dd>{typeof d.n_plot === 'number' ? nf(d.n_plot) : 'unknown'}</dd></div>
        <div><dt>O₂ tested</dt><dd>{o2Range(pair(d.o2)) ?? 'not tabulated'}</dd></div>
        <div><dt>Pressure</dt><dd>{psiRange(pair(d.pressure_atm)) ?? 'not tabulated'}</dd></div>
        <div><dt>Gravity</dt><dd>{Array.isArray(d.gravity) && d.gravity.length ? d.gravity.map(gLabel).join(' and ') : 'not stated in this card'}</dd></div>
        <div><dt>Fuels or samples</dt><dd>{d.fuels?.length ? d.fuels.slice(0, 6).join(' · ') : 'not tabulated'}</dd></div>
        <div><dt>Outcomes</dt><dd>{outs.length ? outs.map(([k, n]) => `${nf(n)} ${OUTCOME[k] ?? k}`).join(' · ') : 'not tabulated'}</dd></div>
        <div><dt>Source</dt><dd>{f.insight.source}; <span className="dmono">/api/insights</span> ({f.insight.id})</dd></div>
      </dl>
      <InvChips ids={f.sources} invById={invById} onInvestigation={onInvestigation} />
      <p className="dcap">No chart: this card has no hand-written analysis yet, so only what the ingestion counted is shown. Nobody on the team has reviewed it.</p>
    </div>
  )
}

// Any other insight: its own sentence and source. If its data is a list of rows, only the row count is stated.
function TextBody({ f, invById, onInvestigation, onOpenPage }: Small & { onOpenPage: () => void }) {
  const d = f.insight.data
  return (
    <div className="dfinding-body">
      <div className="dstatement"><Tag k="summary" /><p>{f.insight.finding}</p></div>
      <dl className="dfacts">
        <div><dt>Data returned</dt><dd>{Array.isArray(d) ? `${nf(d.length)} rows` : d && typeof d === 'object' ? `fields: ${Object.keys(d).join(', ')}` : 'none'}</dd></div>
        <div><dt>Source</dt><dd>{f.insight.source || 'not stated'}; <span className="dmono">/api/insights</span> ({f.insight.id})</dd></div>
      </dl>
      <InvChips ids={f.sources} invById={invById} onInvestigation={onInvestigation} />
      <p className="dcap">This screen has no reviewed chart for this finding, so it does not draw one. <button className="dlink" onClick={onOpenPage}>See it on the Findings page →</button></p>
    </div>
  )
}
