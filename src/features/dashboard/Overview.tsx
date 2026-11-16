// Top of the dashboard: the reference scenario, the few metrics that are specific to it, and, kept apart and
// collapsed, the archive-wide counts and what "up to date" means here.
//
// Scenario metrics come from /api/verdict (coverage rule) and /api/flammability/assess (published-curve
// estimate). Archive counts come from /api/meta and are global: they are never presented as scenario metrics.
import { useState, type ReactNode } from 'react'
import { Seal } from '../../components/Seal'
import { FAMILY, TIER, gLabel, nf, pct, plain, psi } from '../../lib/format'
import { MATERIALS, WIND_MAX } from '../../state'
import type { Assessment, Habitat, Investigation, MatrixCell, Meta, Scenario, Tier, Verdict } from '../../types'
import { ClassLegend, Tag, type DataClass } from './ui'
import type { Async } from './useAsync'

export type IngestInfo = Meta['ingest'] & { table_sources?: Record<string, number>; fingerprint?: string; documents?: Record<string, number> }
export const utc = (d: Date | null | undefined, secs = false) => (d && !Number.isNaN(d.getTime()) ? d.toISOString().slice(0, secs ? 19 : 16).replace('T', ' ') + ' UTC' : null)
export const versionOf = (m: Meta | null) => { const i = m?.ingest as IngestInfo | undefined; return i ? (i.fingerprint ? i.fingerprint : `at:${i.at}`) : null }
// counters of the ingestion log, as the API keys them
const DOC_KEY: Record<string, string> = { lidos: 'read', baixados: 'downloaded', recursos: 'challenge resources', 'sem texto': 'without extractable text', 'falhou no PSI': 'failed at PSI' }

export function NumField({ label, unit, value, min, max, step, digits, onCommit, title }: { label: string; unit: string; value: number; min: number; max: number; step: number; digits: number; onCommit: (v: number) => void; title?: string }) {
  const shown = value.toFixed(digits).replace(/\.?0+$/, '')
  const [text, setText] = useState<string | null>(null)   // what is being typed; null = show the scenario value
  return (
    <label className="dnumf" title={title}>
      <span>{label}</span>
      <input type="number" inputMode="decimal" min={min} max={max} step={step} value={text ?? shown}
        onChange={(e) => { setText(e.target.value); const v = parseFloat(e.target.value); if (Number.isFinite(v) && v >= min && v <= max) onCommit(v) }}
        onBlur={() => setText(null)} />
      <i>{unit}</i>
    </label>
  )
}

interface Props {
  meta: Meta; invs: Investigation[]; scenario: Scenario; wind: number
  verdict: Async<{ verdict: Verdict; matrix: MatrixCell[] }>; assess: Async<{ available: boolean; assessment?: Assessment }>
  curveApplies: boolean; fuelName: string
  fetchedAt: Date | null; refreshing: boolean; refreshError: string | null; newer: string | null; lastCheck: { at: Date; ok: boolean } | null
  onRefresh: () => void
  onHabitat: (h: Habitat) => void; onFuel: (family: string, material?: string) => void; onScenario: (patch: Partial<Scenario>) => void; onWind: (v: number) => void
  onRecord: (id: string) => void
}

function Kpi({ label, tag, tagText, source, children, note }: { label: string; tag: DataClass; tagText?: string; source: string; children: ReactNode; note: string }) {
  return (
    <div className="dkpi">
      <div className="dkpi-top"><span className="dkpi-label">{label}</span><Tag k={tag}>{tagText}</Tag></div>
      <div className="dkpi-value">{children}</div>
      <p className="dkpi-note">{note}</p>
      <p className="dkpi-src">{source}</p>
    </div>
  )
}

export function Overview(p: Props) {
  const { meta, scenario } = p
  const ing = meta.ingest as IngestInfo
  const custom = !meta.habitats.some((h) => h.id === scenario.habitat)
  const tol = meta.tolerances
  const tolText = `±${nf(tol.o2 * 100)} O₂ points, ±${nf(tol.pressure * 100)}% pressure`
  const v = p.verdict.data?.verdict, near = v?.nearest?.[0]
  const a = p.assess.data?.assessment
  const busy = (r: Async<unknown>) => (r.loading ? ' busy' : '')
  const fail = (r: Async<unknown>, what: string) => <span className="dkpi-fail">{r.error ? `Not available: ${r.error}` : `Loading ${what}…`} {r.error && <button className="dlink" onClick={r.reload}>Retry</button>}</span>
  const limit = a ? (a.limit_o2[1] - a.limit_o2[0] < 0.1 ? `${nf(a.limit_o2[0], 1)}%` : `${nf(a.limit_o2[0], 1)}–${nf(a.limit_o2[1], 1)}%`) : ''
  const withOutcome = p.invs.filter((x) => x.stats?.has_outcome).length
  const src = (o?: Record<string, number>) => Object.entries(o ?? {}).map(([k, n]) => `${nf(n)} from ${k}`).join(', ')
  const consistent = ing.tests === meta.counts.tests && ing.investigations === meta.counts.investigations
  return (
    <header className="dctx">
      <div className="dctx-top">
        <div className="dctx-title">
          <h1>Scientific intelligence dashboard</h1>
          <p>Findings, the investigations behind them, and the experiments still missing. NASA PSI combustion archive.</p>
        </div>
        <div className={`dfresh${p.newer || p.refreshError ? ' warn' : ''}`}>
          <dl>
            <div title="ingest.at in /api/meta: when the Atlas last built the data set this API is serving. It is not the date of any NASA experiment, and not proof that PSI has nothing newer."><dt>Atlas ingestion served by the API</dt><dd>{utc(new Date(ing.at)) ?? 'not reported'}</dd></div>
            <div title="ingest.fingerprint in /api/meta: a hash of the catalogs, tables and documents that went into this data set. It changes only when the content changes."><dt>Data-set version</dt><dd className="dmono">{ing.fingerprint ? ing.fingerprint.slice(0, 12) : 'not provided'}</dd></div>
            <div title="When this browser tab last received the catalog from the API."><dt>Fetched by this view</dt><dd>{utc(p.fetchedAt, true) ?? 'not yet'}</dd></div>
          </dl>
          <button className="dbtn drefresh" onClick={p.onRefresh} disabled={p.refreshing}>{p.refreshing ? 'Refreshing…' : 'Refresh data'}</button>
        </div>
      </div>
      {p.newer && <p className="dalert" role="status">The API is now serving a different data set (ingestion of {utc(new Date(p.newer)) ?? p.newer}). What is on screen is the previous one. <button className="dlink" onClick={p.onRefresh}>Refresh data</button></p>}
      {p.refreshError && <p className="dalert" role="alert">The last refresh failed ({p.refreshError}). What is on screen was fetched at {utc(p.fetchedAt, true) ?? 'an earlier time'} and has not been re-verified. <button className="dlink" onClick={p.onRefresh}>Try again</button></p>}

      <div className="dctx-row">
        <span className="dctx-k">Reference scenario</span>
        <div className="dseg" role="group" aria-label="Reference environment">
          {meta.habitats.map((h) => (<button key={h.id} aria-pressed={scenario.habitat === h.id} title={h.note} onClick={() => p.onHabitat(h)}>{h.name}</button>))}
          {custom && <button aria-pressed="true" disabled title="O₂, pressure or gravity was edited, so the scenario no longer matches a preset environment">Custom</button>}
        </div>
        <NumField label="O₂" unit="%" value={scenario.o2 * 100} min={1} max={100} step={0.5} digits={1} onCommit={(x) => p.onScenario({ o2: x / 100 })} title="Oxygen mole fraction, in percent" />
        <NumField label="Pressure" unit="psi" value={scenario.pressure_atm * 14.696} min={1.5} max={88} step={0.1} digits={1} onCommit={(x) => p.onScenario({ pressure_atm: x / 14.696 })} title="Total pressure (1 atm = 14.696 psi)" />
        <NumField label="Gravity" unit="g" value={scenario.gravity} min={0} max={1} step={0.01} digits={3} onCommit={(x) => p.onScenario({ gravity: x })} title="In Earth gravities" />
        <NumField label="Airflow" unit="cm/s" value={p.wind} min={0} max={WIND_MAX} step={1} digits={1} onCommit={p.onWind} title="Forced ventilation at the flame. It changes the acrylic-rod curve estimate only." />
        <label className="dselect inline"><span>Fuel</span>
          <select value={`${scenario.family}:${scenario.material || ''}`} onChange={(e) => { const [f, m] = e.target.value.split(':'); p.onFuel(f, m) }}>
            <option value="todas:">All fuels</option>
            <option value="solido:">Solids · any material</option>
            {MATERIALS.filter((m) => m.family === 'solido').map((m) => (<option key={m.id} value={`solido:${m.material}`}>Solids · {m.name}</option>))}
            <option value="gota:">Liquid fuel droplets</option>
            <option value="gas:">Gas flames</option>
          </select>
        </label>
        <details className="dprov">
          <summary>What each control changes</summary>
          <div>
            <table className="dtable deffects">
              <thead><tr><th>Control</th><th>Coverage</th><th>Ranking</th><th>Findings</th><th>Curve estimate</th><th>BASS-II queue</th><th>Material gaps</th></tr></thead>
              <tbody>
                <tr><td>O₂</td><td>yes</td><td>yes: closeness</td><td>reference line only</td><td>yes</td><td>no</td><td>no</td></tr>
                <tr><td>Pressure</td><td>yes</td><td>yes: closeness</td><td>no</td><td>caveat only: the curve has no pressure term</td><td>no</td><td>no</td></tr>
                <tr><td>Gravity</td><td>yes</td><td>text relevance only</td><td>no</td><td>yes: airflow range</td><td>no</td><td>no</td></tr>
                <tr><td>Airflow</td><td>no</td><td>no</td><td>no</td><td>yes</td><td>no: fixed reference</td><td>no</td></tr>
                <tr><td>Fuel</td><td>yes</td><td>family only</td><td>marks other families</td><td>no: acrylic rod only</td><td>scope warning only</td><td>yes</td></tr>
              </tbody>
            </table>
            <p>Findings are global: they are computed over the whole archive and never recomputed for a scenario. Editing O₂, pressure or gravity turns the environment into "Custom"; the airflow and the fuel are kept when you change environment.</p>
            <ClassLegend />
          </div>
        </details>
      </div>

      <div className="dkpis" aria-label={`Metrics for the reference scenario: ${pct(scenario.o2, 1)} O₂, ${psi(scenario.pressure_atm)}, ${gLabel(scenario.gravity)}, ${p.fuelName}`}>
        <Kpi label="Evidence coverage" tag="rule" source="/api/verdict · tier"
          note={`Whether tabulated NASA tests exist for ${p.fuelName} within ${tolText} of the scenario. Coverage is not a statement that the scenario is safe or unsafe.`}>
          {v ? <span className={`dkpi-seal${busy(p.verdict)}`}><Seal tier={v.tier} sub={TIER[v.tier as Tier]?.short ?? ''} /></span> : fail(p.verdict, 'coverage')}
        </Kpi>
        <Kpi label="Tabulated tests in this atmosphere" tag="derived" tagText="Count" source="/api/verdict · same_g, zero_g, one_g"
          note={`Counts tabulated tests of ${p.fuelName} within ${tolText}, split by gravity. Only records with both O₂ and pressure can be counted; it is not every test NASA ran.`}>
          {v ? (
            <span className={`dkpi-num${busy(p.verdict)}`}><b>{nf(v.same_g)}</b><span>at {gLabel(scenario.gravity)}</span><small>{nf(v.zero_g)} at 0 g · {nf(v.one_g)} at 1 g</small></span>
          ) : fail(p.verdict, 'the test count')}
        </Kpi>
        <Kpi label="Nearest tabulated test" tag="measured" source={near ? `${near.test.source_file}, row ${near.test.source_row}` : '/api/verdict · nearest[0]'}
          note="Signed difference of the nearest test from the scenario: O₂ in percentage points, pressure in percent of the scenario pressure. Gravity is given as tested.">
          {v ? (near ? (
            <span className={`dkpi-num${busy(p.verdict)}`}>
              <b className="small">{near.investigation} {near.test.label}</b>
              <span>{near.d_o2_pp >= 0 ? '+' : '−'}{nf(Math.abs(near.d_o2_pp), 1)} O₂ pts · {near.d_pressure_pct >= 0 ? '+' : '−'}{nf(Math.abs(near.d_pressure_pct))}% pressure · tested at {gLabel(near.test.gravity)}</span>
              <small>{near.test.assumed?.includes('pressure_atm') ? 'pressure assumed (cabin), not measured · ' : ''}<button className="dlink" onClick={() => p.onRecord(near.test.id)}>open the source row</button></small>
            </span>
          ) : <span className="dkpi-fail">No tabulated test of this fuel has both O₂ and pressure.</span>) : fail(p.verdict, 'the nearest test')}
        </Kpi>
        <Kpi label="O₂ needed to sustain a flame · acrylic rod" tag="curve" source={a ? `/api/flammability/assess · ${a.source}` : '/api/flammability/assess'}
          note={p.curveApplies
            ? `Read from NASA's published BASS-II boundary at ${nf(p.wind)} cm/s of forced airflow. An estimate from a curve, not a measurement of this environment.`
            : `Reference only: the curve is for the acrylic rod, not for ${p.fuelName}. Read at ${nf(p.wind)} cm/s of forced airflow.`}>
          {a ? (
            <span className={`dkpi-num${busy(p.assess)}${p.curveApplies ? '' : ' ref'}`}>
              <b>{limit}</b><span>± {nf(a.band_o2, 1)} O₂ pts</span>
              <small>{a.inside_tested ? 'inside the tested range' : `outside tested conditions · ${a.outside.length} not covered`}</small>
            </span>
          ) : p.assess.data && !p.assess.data.available ? <span className="dkpi-fail">No published boundary is available from the API.</span> : fail(p.assess, 'the curve estimate')}
        </Kpi>
      </div>

      {v && (
        <details className="devidence">
          <summary>Coverage detail: {plain(v.headline)}</summary>
          <div>
            <p>{v.explanation}</p>
            {v.empirical && <p><Tag k="derived">Empirical count</Tag> {v.empirical.headline} <span className="faint">{v.empirical.caveat}</span></p>}
            <p className="dcap">Partial gravity: the archive holds tests at 0 g and at 1 g only. "Bounded" means both exist in this atmosphere; it is not an interpolated result for the Moon or Mars.</p>
            <ul className="dmatrix" aria-label="Coverage level by fuel family at this atmosphere and gravity">
              {(p.verdict.data?.matrix ?? []).map((m) => (
                <li key={m.family}>
                  <button className={scenario.family === m.family ? 'on' : ''} aria-pressed={scenario.family === m.family} onClick={() => p.onFuel(scenario.family === m.family ? 'todas' : m.family)} title="Set the fuel to this family">
                    <i className={`dtier t-${m.tier}`} aria-hidden="true" />
                    <span>{FAMILY[m.family] ?? m.family}</span>
                    <b>{TIER[m.tier as Tier]?.label ?? m.label}</b>
                    <em>{nf(m.n)} {m.n === 1 ? 'test' : 'tests'}</em>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </details>
      )}

      <details className="darchive">
        <summary>Archive overview <span>global · not filtered by the scenario</span></summary>
        <div>
          <dl className="dstatus" aria-label="Archive totals from /api/meta">
            <div title="counts.investigations in /api/meta"><dt>Investigations</dt><dd>{nf(meta.counts.investigations)}</dd></div>
            <div title="counts.tests in /api/meta: rows read from the PSI experimental tables"><dt>Tabulated records</dt><dd>{nf(meta.counts.tests)}</dd></div>
            <div title="counts.plot in /api/meta: records with both O₂ and pressure"><dt>With O₂ and pressure</dt><dd>{nf(meta.counts.plot)}</dd></div>
            <div title="Investigations whose table records how each test ended (stats.has_outcome in /api/investigations)"><dt>Investigations with tabulated outcomes</dt><dd>{nf(withOutcome)}<small> of {nf(p.invs.length)}</small></dd></div>
            <div title="counts.chunks in /api/meta: text passages indexed for search. Text, never a measurement."><dt>Document passages (search only)</dt><dd>{nf(meta.counts.chunks)}</dd></div>
          </dl>
          <dl className="dkv">
            <div><dt>Sources of this ingestion</dt><dd>Catalogs: {src(ing.catalog_sources) || 'not reported'}. Tables: {src(ing.table_sources) || 'not reported'}.{ing.documents ? ` Documents: ${Object.entries(ing.documents).map(([k, n]) => `${nf(n)} ${DOC_KEY[k] ?? k}`).join(', ')}.` : ''}</dd></div>
            <div><dt>Counts against the ingestion log</dt><dd>{consistent ? 'The served counts equal the counts the ingestion recorded.' : 'The served counts differ from the counts the ingestion recorded.'} This is internal consistency only.</dd></div>
            <div><dt>Document search</dt><dd>{meta.qdrant?.enabled ? 'An external vector store is enabled.' : 'PostgreSQL + pgvector; the former Qdrant store is disabled in this API.'} Passages are used for search and question answering elsewhere in the Atlas and are never treated here as experimental measurements.</dd></div>
            <div><dt>Last check of the API by this view</dt><dd>{p.lastCheck ? `${utc(p.lastCheck.at, true)} · ${p.lastCheck.ok ? 'answered' : 'no answer'}` : 'only the initial load so far'}. The version is checked every 5 minutes while the tab is visible; the data is re-fetched only on Refresh.</dd></div>
          </dl>
          <div className="dfourstates">
            <h4>What "up to date" does and does not mean here</h4>
            <ol>
              <li><b>NASA PSI.</b> Whether NASA has published newer files is not checked by this screen and cannot be shown.</li>
              <li><b>Atlas ingestion.</b> The time above is when the Atlas last built a data set whose content differed from the previous one. An ingestion that finds nothing new leaves it unchanged.</li>
              <li><b>Published API.</b> The version is the fingerprint the API reports for the data set it is serving right now.</li>
              <li><b>This view.</b> "Fetched by this view" is when this tab last read it. Use Refresh data to read it again.</li>
            </ol>
          </div>
        </div>
      </details>
    </header>
  )
}
