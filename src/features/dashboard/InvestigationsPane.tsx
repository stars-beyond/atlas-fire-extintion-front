// Column 2 · Investigations: which NASA experiments support the findings, under which conditions.
// The order is the API's investigation relevance score for the reference scenario (/api/rank): a weighted
// heuristic for "where to look first", shown with its four components. It is never called a risk.
import { useState } from 'react'
import { api } from '../../api'
import { FAMILY, OUTCOME, ROLE, gLabel, nf } from '../../lib/format'
import type { Dataset, InvDetail, Investigation, Meta, Ranked } from '../../types'
import { o2Range, psiRange, psiUrl, reasonText, type FindingView, type Focus, type Relation } from './links'
import { Empty, Failed, Gate, Guard, PaneHead, Pending, Section } from './ui'
import { useAsync, type Async } from './useAsync'

type Part = keyof Ranked['parts']
const PARTS: { k: Part; label: string; how: string }[] = [
  { k: 'proximidade', label: 'Closeness of tested conditions', how: 'Distance in O₂ and pressure between the scenario and the nearest tabulated test of the investigation. 1 when a test sits at the scenario atmosphere; it falls off as the nearest test moves away.' },
  { k: 'relevancia', label: 'Text relevance', how: 'Similarity between a description of the scenario and the catalog text of the investigation, from a sentence-embedding model, rescaled so the least similar investigation scores 0 and the most similar 1.' },
  { k: 'dados', label: 'Tabulated data', how: 'Whether O₂, pressure and outcome are tabulated per test, and how many rows the experimental table has.' },
  { k: 'enunciado', label: 'Role in the challenge statement', how: 'A fixed priority the team assigned from the NASA Space Apps challenge text. It does not change with the scenario.' },
]
const OUT_COLOR: Record<string, string> = { queimou: 'var(--g1)', extinguiu: 'var(--g0)', disrupcao: 'var(--gas)', nao_acendeu: 'var(--faint)', desconhecido: 'var(--ink-4)' }
const KIND: Record<string, string> = { voo: 'Flight experiment', solo: 'Ground experiment' }
type Filter = 'all' | 'outcome' | 'plot'

interface Props {
  rank: Async<{ ranking: Ranked[] }>
  invs: Investigation[]; invById: Map<string, Investigation>; meta: Meta
  scenarioText: string; scenarioO2: number; family: string
  focus: Focus; sources: string[]; basis: string | null
  selected: string | null
  findingsOf: (id: string) => FindingView[]
  relationOf: (v: Investigation) => Relation
  onSelect: (id: string) => void; onFinding: (id: string) => void; onNextFire: (proposals: string[]) => void; onOpenPage: () => void
  question: string; onQuestion: (q: string) => void; datasets: Dataset[] | null
}

export function InvestigationsPane(p: Props) {
  const [filter, setFilter] = useState<Filter>('all')
  const [famOnly, setFamOnly] = useState(false)
  const pass = (v: Investigation) => (filter === 'outcome' ? v.stats.has_outcome : filter === 'plot' ? v.stats.n_plot > 0 : true) && (!famOnly || p.family === 'todas' || v.family === p.family)
  const count = (f: Filter) => p.invs.filter((v) => (f === 'outcome' ? v.stats.has_outcome : f === 'plot' ? v.stats.n_plot > 0 : true)).length
  const w = p.meta.weights
  return (
    <section className="dpane" aria-label="Investigations">
      <PaneHead n="02" title="Investigations" question="Which experiments support that, under what conditions, and where is the original source?" />
      <Section title="Investigation relevance score" tag="heuristic" aside={p.scenarioText}>
        <details className="dhow">
          <summary>What the score means and how it is built</summary>
          <p>It orders the {p.invs.length} investigations by how useful each is likely to be for the reference scenario. <b>It is not a fire-risk, an ignition probability or a measure of scientific quality.</b> Score = weighted sum of four components, each from 0 to 1{p.family !== 'todas' ? `, then reduced by a fixed factor when the investigation burned a different fuel family than the one selected (${FAMILY[p.family]}); the factor is shown in each record` : ''}.</p>
          <ul>{PARTS.map((x, i) => (<li key={x.k}><i className={`dpart dpart-${i}`} /><b>{x.label} · {nf((w[x.k] ?? 0) * 100)}%</b><span>{x.how}{x.k === 'relevancia' ? ` Model: ${p.meta.ingest.embed_model}.` : ''}</span></li>))}</ul>
        </details>
        <QuestionBox value={p.question} onCommit={p.onQuestion} />
        <div className="dfilters" role="group" aria-label="Filter the list by tabulated evidence">
          {([['all', 'All'], ['outcome', 'With tabulated outcomes'], ['plot', 'With O₂ and pressure per test']] as [Filter, string][]).map(([f, l]) => (
            <button key={f} aria-pressed={filter === f} onClick={() => setFilter(f)}>{l} <span>{count(f)}</span></button>
          ))}
          {p.family !== 'todas' && <button aria-pressed={famOnly} onClick={() => setFamOnly(!famOnly)}>{FAMILY[p.family]} only <span>{p.invs.filter((v) => v.family === p.family).length}</span></button>}
        </div>
        <Gate r={p.rank} what="the relevance ranking">
          {({ ranking }) => {
            const rows = ranking.map((r, i) => ({ r, i, v: p.invById.get(r.id) })).filter((x) => x.v && pass(x.v)) as { r: Ranked; i: number; v: Investigation }[]
            // sources of the finding being traced come first, keeping their rank number
            const src = rows.filter((x) => p.sources.includes(x.r.id)), other = rows.filter((x) => !p.sources.includes(x.r.id))
            if (!rows.length) return <Empty>No investigation matches these filters.</Empty>
            return (
              <div className="dranks" role="list">
                <div className="dranks-head" aria-hidden="true"><span>#</span><span>Investigation</span><span>Relevance</span><span>Rows</span><span>O₂ tested</span></div>
                {src.length > 0 && <p className="dgroup">Sources of the selected finding</p>}
                {src.map((x) => <Row key={x.r.id} {...x} p={p} mark="source" />)}
                {src.length > 0 && other.length > 0 && <p className="dgroup">Other investigations, by relevance to the scenario</p>}
                {other.map((x) => <Row key={x.r.id} {...x} p={p} mark={p.focus?.kind === 'proposal' && x.r.id === p.basis ? 'basis' : undefined} />)}
              </div>
            )
          }}
        </Gate>
      </Section>
      {p.selected && p.invById.get(p.selected)
        ? <Guard what="The investigation record"><Record key={p.selected} v={p.invById.get(p.selected)!} p={p} ranked={p.rank.data?.ranking ?? []} /></Guard>
        : <Empty>Select an investigation to see its conditions, outcomes and sources.</Empty>}
      <footer className="dpane-foot"><button className="dlink" onClick={p.onOpenPage}>Open the Investigations page: full ranking table and complete record sheets →</button></footer>
    </section>
  )
}

// An optional research question. The API embeds it and uses it for the text-relevance part of the score only.
function QuestionBox({ value, onCommit }: { value: string; onCommit: (q: string) => void }) {
  const [text, setText] = useState(value)
  return (
    <form className="dquestion" onSubmit={(e) => { e.preventDefault(); onCommit(text.trim()) }}>
      <label htmlFor="dq">Rank for a research question <span>(optional)</span></label>
      <div>
        <input id="dq" type="text" value={text} maxLength={240} placeholder="e.g. smoke detection in low airflow" onChange={(e) => setText(e.target.value)} />
        <button className="dbtn" type="submit" disabled={text.trim() === value}>Rank</button>
        {value && <button className="dbtn" type="button" onClick={() => { setText(''); onCommit('') }}>Clear</button>}
      </div>
      <p className="dcap">{value ? <>Ranking for: <b>“{value}”</b>. </> : null}The question changes only the <b>text relevance</b> component (semantic similarity to each investigation's catalog text). It does not change which conditions were tested, and it says nothing about ignition.</p>
    </form>
  )
}

function ScoreBar({ r, w }: { r: Ranked; w: Record<string, number> }) {
  return (
    <span className="dscore" role="img" aria-label={`Relevance score ${nf(r.score * 100)} of 100`}>
      <span className="dscore-bar">{PARTS.map((x, i) => (<i key={x.k} className={`dpart dpart-${i}`} style={{ width: `${r.parts[x.k] * (w[x.k] ?? 0) * 100}%` }} />))}</span>
      <b>{nf(r.score * 100)}</b>
    </span>
  )
}

function Row({ r, i, v, p, mark }: { r: Ranked; i: number; v: Investigation; p: Props; mark?: 'source' | 'basis' }) {
  const o2 = v.stats.o2, dec = v.stats.declared?.o2
  const band = o2 ?? dec ?? null
  return (
    <button role="listitem" className={`drank${p.selected === r.id ? ' on' : ''}${mark ? ' linked' : ''}${p.family !== 'todas' && v.family !== p.family ? ' off' : ''}`} aria-current={p.selected === r.id} onClick={() => p.onSelect(r.id)}>
      <span className="drank-n">{i + 1}</span>
      <span className="drank-name">
        <b>{r.name}{mark === 'source' && <em className="dlinked">source</em>}{mark === 'basis' && <em className="dlinked">queue basis</em>}</b>
        <span><i className={`dfamdot dfam-${v.family}`} />{FAMILY[v.family] ?? v.family} · {ROLE[v.role] ?? v.role}</span>
      </span>
      <ScoreBar r={r} w={p.meta.weights} />
      <span className="dnum">{v.stats.n_tests ? nf(v.stats.n_tests) : <span className="faint">none</span>}</span>
      <span className="do2">
        {band ? (
          <>
            <span className="do2-track" aria-hidden="true">
              <i className={o2 ? '' : 'declared'} style={{ left: `${band[0] * 100}%`, width: `${Math.max(1.5, (band[1] - band[0]) * 100)}%` }} />
              {p.scenarioO2 <= 1 && <u style={{ left: `${p.scenarioO2 * 100}%` }} />}
            </span>
            <span className="do2-t">{o2Range(band)}{!o2 && ' declared'}</span>
          </>
        ) : <span className="faint do2-t">not tabulated</span>}
      </span>
    </button>
  )
}

function conditions(v: Investigation): [string, string][] {
  const s = v.stats
  return [
    ['Safety role', ROLE[v.role] ?? v.role], ['Fuel family', FAMILY[v.family] ?? v.family],
    ['Scientific area', v.area || 'not stated'], ['Hardware', v.hardware || 'not stated'],
    ['Tabulated records', nf(s.n_tests)], ['With O₂ and pressure', nf(s.n_plot)],
    ['O₂ tested', o2Range(s.o2) ?? (s.declared?.o2 ? `${o2Range(s.declared.o2)} (declared, not per test)` : 'not tabulated')],
    ['Pressure', psiRange(s.pressure_atm) ?? (s.pressure_assumed ? 'cabin pressure (assumed, not tabulated)' : s.declared?.pressure_atm ? `${psiRange(s.declared.pressure_atm)} (declared)` : 'not tabulated')],
    ['Gravity', s.gravity?.length ? s.gravity.map(gLabel).join(' and ') : 'not tabulated'],
    ['Airflow', s.flow_cm_s ? (s.flow_cm_s[0] === s.flow_cm_s[1] ? `${nf(s.flow_cm_s[0], 1)} cm/s` : `${nf(s.flow_cm_s[0], 1)}–${nf(s.flow_cm_s[1], 1)} cm/s`) : 'not tabulated'],
    ['Outcome per test', s.has_outcome ? 'tabulated' : 'not tabulated'],
    ['Period', v.start_year ? `${v.start_year}–${v.end_year ?? 'ongoing'}` : 'not stated'],
  ]
}

function Record({ v, p, ranked }: { v: Investigation; p: Props; ranked: Ranked[] }) {
  const d: Async<InvDetail> = useAsync(() => api.investigation(v.id), [v.id])
  const [cmp, setCmp] = useState('')
  const s = v.stats
  const r = ranked.find((x) => x.id === v.id), pos = ranked.findIndex((x) => x.id === v.id)
  const outs = Object.entries(s.outcomes ?? {}).filter(([, n]) => n > 0)
  const total = outs.reduce((a, [, n]) => a + n, 0)
  // what the API applied on top of the weighted sum (the fuel-family reduction), read back from its own numbers
  const weighted = r ? PARTS.reduce((a, x) => a + r.parts[x.k] * (p.meta.weights[x.k] ?? 0), 0) : 0
  const factor = r && weighted > 0 ? r.score / weighted : 1
  const used = p.findingsOf(v.id)
  const rel = p.relationOf(v)
  const other = cmp ? p.invById.get(cmp) : undefined
  const A = conditions(v), B = other ? conditions(other) : null
  // column keys -> the label and unit the API publishes for this investigation's dataset, when it has one
  const ds = p.datasets?.find((x) => x.id === v.id)
  const defs = new Map([...(ds?.numeric ?? []), ...(ds?.categorical ?? [])].map((x) => [x.key, x]))
  const meas = (s.measurements ?? []).map((k) => { const x = defs.get(k); return x ? `${x.label}${x.unit ? ` (${x.unit})` : ''}` : null })
  const named = meas.filter(Boolean) as string[], unnamed = (s.measurements ?? []).filter((_, k) => !meas[k])
  return (
    <article className="drecord" aria-label={`Investigation record: ${v.name}`}>
      <header className="drecord-head">
        <span className="dkicker">Investigation record · {KIND[v.kind] ?? v.kind}</span>
        <h3>{v.name}{v.acronym && v.acronym !== v.name ? ` (${v.acronym})` : ''}</h3>
        {v.title && v.title !== v.name && <p className="drecord-sub">{v.title}</p>}
        <p className="drecord-ids"><a href={psiUrl(v.id)} target="_blank" rel="noreferrer">{v.id} on NASA PSI ↗</a>{d.data?.doi && <> · <a href={`https://doi.org/${d.data.doi}`} target="_blank" rel="noreferrer">DOI {d.data.doi} ↗</a></>}</p>
      </header>

      {r && (
        <Section title={`Relevance to the scenario · rank ${pos + 1} of ${ranked.length}`} tag="heuristic">
          <table className="dparts">
            <thead><tr><th>Component</th><th>Value</th><th>Weight</th><th>Points</th></tr></thead>
            <tbody>
              {PARTS.map((x, i) => (<tr key={x.k}><td><i className={`dpart dpart-${i}`} />{x.label}</td><td>{nf(r.parts[x.k], 2)}</td><td>{nf((p.meta.weights[x.k] ?? 0) * 100)}%</td><td>{nf(r.parts[x.k] * (p.meta.weights[x.k] ?? 0) * 100, 1)}</td></tr>))}
              {Math.abs(factor - 1) > 0.005 && <tr><td>Fuel-family factor <span className="faint">({FAMILY[v.family] ?? v.family}, scenario asks for {FAMILY[p.family] ?? p.family})</span></td><td>× {nf(factor, 2)}</td><td /><td /></tr>}
              <tr className="dparts-total"><td>Score</td><td /><td /><td>{nf(r.score * 100, 1)}</td></tr>
            </tbody>
          </table>
          {reasonText(r.reason, v) && <p className="dcap">{reasonText(r.reason, v)}</p>}
        </Section>
      )}

      <Section title="Tested conditions" tag="measured" aside={s.pressure_assumed ? 'pressure assumed' : undefined}>
        <dl className="dkv">{A.slice(4).map(([k, val]) => (<div key={k}><dt>{k}</dt><dd>{val}</dd></div>))}</dl>
        {s.fuels?.length > 0 && <p className="dcap"><b>Fuels or samples:</b> {s.fuels.slice(0, 6).join(' · ')}{s.fuels.length > 6 ? ` · and ${s.fuels.length - 6} more` : ''}</p>}
      </Section>

      <Section title="Tabulated outcomes" tag="measured" aside={total ? `${nf(total)} records` : undefined}>
        {total === 0 ? <Empty>No experimental table with rows was ingested for this investigation.</Empty> : (
          <>
            <div className="dstack tall" role="img" aria-label={outs.map(([k, n]) => `${OUTCOME[k] ?? k}: ${n}`).join(', ')}>
              {outs.map(([k, n]) => (<i key={k} style={{ flexGrow: n, background: OUT_COLOR[k] ?? 'var(--ink-4)' }} title={`${OUTCOME[k] ?? k}: ${n}`} />))}
            </div>
            <ul className="doutkey">{outs.map(([k, n]) => (<li key={k}><i className="dsw" style={{ background: OUT_COLOR[k] ?? 'var(--ink-4)' }} />{OUTCOME[k] ?? k} <b>{nf(n)}</b></li>))}</ul>
            {!s.has_outcome && <p className="dcap">The PSI table of this investigation does not record how each test ended.</p>}
          </>
        )}
        {named.length > 0 && <p className="dcap"><b>Quantities read from the table:</b> {named.join(' · ')}</p>}
        {unnamed.length > 0 && <p className="dcap"><b>{named.length ? 'Other columns' : 'Columns read from the table'}</b> (internal keys; the API publishes no label or unit for them): <span className="dmono">{unnamed.slice(0, 12).join(', ')}{unnamed.length > 12 ? `, +${unnamed.length - 12}` : ''}</span></p>}
      </Section>

      <Section title="Objective and sources">
        {d.error ? <Failed what="the investigation record" error={d.error} retry={d.reload} /> : !d.data ? <Pending what="the investigation record" /> : (
          <>
            {d.data.objective ? <details className="dobjective"><summary>{d.data.objective.split('\n')[0]}</summary>{d.data.objective.split('\n').slice(1).filter((l) => l.trim()).map((l, i) => <p key={i}>{l.trim()}</p>)}</details> : <p className="dcap">The PSI catalog has no objective text for this investigation.</p>}
            <dl className="dkv">
              <div><dt>Publications in the catalog</dt><dd>{nf(d.data.publications.length)}</dd></div>
              <div><dt>Documents indexed for search</dt><dd>{nf(d.data.documents.length)}</dd></div>
              <div><dt>Raw data on PSI</dt><dd>{nf(v.n_files)} files · {nf(v.total_gb, 1)} GB</dd></div>
            </dl>
            {([['Approach', d.data.approach], ['Hypothesis', d.data.hypothesis], ['Expected impact', d.data.impacts]] as [string, string][]).filter(([, t]) => t && t.trim()).map(([k, t]) => (
              <details key={k} className="dobjective"><summary>{k} <span className="faint">(from the PSI catalog)</span></summary>{t.split('\n').filter((l) => l.trim()).map((l, n) => <p key={n}>{l.trim()}</p>)}</details>
            ))}
            {d.data.documents.length > 0 && (
              <details className="dobjective"><summary>Documents indexed for search ({nf(d.data.documents.length)})</summary>
                <ul className="dpubs">{d.data.documents.map((x) => (<li key={x.file}>{String(x.title ?? x.file).split(' · ').pop()} <span>{x.category}{x.pages ? ` · ${nf(x.pages)} pages` : ''} · {x.file}</span></li>))}</ul>
                <p className="dcap">Document text is used for search and question answering elsewhere in the Atlas. It is never used on this screen as a measurement.</p>
              </details>
            )}
            {d.data.publications.length > 0 && (
              <ul className="dpubs">
                {d.data.publications.slice(0, 3).map((x, i) => (<li key={i}>{x.doi ? <a href={`https://doi.org/${x.doi}`} target="_blank" rel="noreferrer">{x.title}</a> : x.title}{x.authors && <span> {x.authors}</span>}</li>))}
                {d.data.publications.length > 3 && <li className="faint">{d.data.publications.length - 3} more on the Investigations page.</li>}
              </ul>
            )}
          </>
        )}
      </Section>

      <Section title="Where this investigation is used">
        {used.length ? <p className="dchips">{used.map((f) => (<button key={f.insight.id} className="dchip" onClick={() => p.onFinding(f.insight.id)}>Finding<span>{f.spec?.kicker ?? f.insight.title}</span></button>))}</p> : <p className="dcap">No finding on this screen is computed from its table.</p>}
        <div className={`dbridge dbridge-${rel.level}`}>
          <span className="dbridge-k">Next fire</span><p>{rel.text}</p>
          {rel.proposals.length > 0 && <button className="dbtn" onClick={() => p.onNextFire(rel.proposals)}>Show the queue →</button>}
        </div>
      </Section>

      <Section title="Compare conditions">
        <label className="dselect"><span>Compare {v.name} with</span>
          <select value={cmp} onChange={(e) => setCmp(e.target.value)}>
            <option value="">Choose an investigation…</option>
            {(ranked.length ? ranked.map((x) => p.invById.get(x.id)).filter(Boolean) as Investigation[] : p.invs).filter((x) => x.id !== v.id).map((x) => (<option key={x.id} value={x.id}>{x.name} · {x.id}</option>))}
          </select>
        </label>
        {B && other && (
          <div className="dtable-wrap">
            <table className="dtable dcompare">
              <thead><tr><th>Attribute</th><th>{v.name}</th><th>{other.name}</th></tr></thead>
              <tbody>{A.map(([k, va], i) => (<tr key={k} className={va === B[i][1] ? 'dsame' : 'ddiff'}><td>{k}</td><td>{va}</td><td>{B[i][1]}</td></tr>))}</tbody>
            </table>
            <p className="dcap">Rows that differ are marked. {A.filter(([, va], i) => va !== B[i][1]).length} of {A.length} attributes differ.</p>
          </div>
        )}
      </Section>
    </article>
  )
}
