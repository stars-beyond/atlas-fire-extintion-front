// "Create your dashboard": charts the user assembles over the data sets the API publishes.
// Nothing is aggregated here. The list of data sets and their variables comes from /api/datasets, and every
// series, group mean and histogram class comes from /api/datasets/{id}/chart, as on the Findings chart builder
// (whose ChartView, chartConfig and CSV export are reused). Only the CONFIGURATION of each chart is saved in
// the browser; the numbers are fetched again from the API every time, and a saved chart whose data set or
// variable no longer exists is reported instead of drawn.
import { useEffect, useState } from 'react'
import { api } from '../../api'
import { download } from '../../lib/download'
import { nf } from '../../lib/format'
import type { ChartConfig, ChartType, Dataset } from '../../types'
import { ChartView } from '../findings/ChartView'
import { CHART_TYPES as TYPES, TYPE_LABEL, defaultConfig, mismatch, unit } from '../findings/chartConfig'
import { useFilterOptions } from '../findings/useFilterOptions'
import { Empty, Failed, Guard, Pending } from './ui'
import { useAsync, type Async } from './useAsync'

const STORAGE = 'atlas.dashboard.widgets.v1'
const MAX = 8
interface Widget { id: string; cfg: ChartConfig }

function load(): Widget[] {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE) ?? '[]')
    return Array.isArray(raw) ? raw.filter((w) => w && typeof w.id === 'string' && w.cfg && typeof w.cfg.dataset === 'string').slice(0, MAX) : []
  } catch { return [] }
}
// mismatch() (why a saved configuration cannot be drawn now) lives with the chart configuration, where the
// Findings chart builder uses it too. Re-exported so imports from this file keep working.
export { mismatch } from '../findings/chartConfig'

export function CustomDashboard({ datasets, ingestAt, tick, onRecord }: { datasets: Async<{ datasets: Dataset[]; note: string }>; ingestAt: string | null; tick: number; onRecord: (id: string) => void }) {
  const [widgets, setWidgets] = useState<Widget[]>(load)
  const [draft, setDraft] = useState<ChartConfig | null>(null)
  const [saved, setSaved] = useState(true)
  const list = datasets.data?.datasets ?? []
  useEffect(() => {
    try { localStorage.setItem(STORAGE, JSON.stringify(widgets)); setSaved(true) } catch { setSaved(false) }
  }, [widgets])
  useEffect(() => { if (!draft && list.length) setDraft(defaultConfig(list[0])) }, [list.length]) // eslint-disable-line react-hooks/exhaustive-deps
  // distinct values of the chosen filter variable, computed by the API
  const options = useFilterOptions(draft)

  const def = list.find((d) => d.id === draft?.dataset)
  const set = (patch: Partial<ChartConfig>) => draft && setDraft({ ...draft, ...patch })
  const add = () => { if (draft && widgets.length < MAX) setWidgets([...widgets, { id: `w${Date.now().toString(36)}`, cfg: draft }]) }
  const move = (i: number, by: number) => setWidgets((w) => { const j = i + by; if (j < 0 || j >= w.length) return w; const c = w.slice(); [c[i], c[j]] = [c[j], c[i]]; return c })
  const remove = (id: string) => setWidgets((w) => w.filter((x) => x.id !== id))
  const draftProblems = draft && list.length ? mismatch(draft, list) : []

  return (
    <section className="dcustom" aria-label="Create your dashboard">
      <header className="dcustom-head">
        <div className="dpane-title"><span className="dpane-n">04</span><h2>Create your dashboard</h2></div>
        <p className="dpane-q">Build your own charts over the data sets the API publishes. The API does the filtering, grouping and statistics; this screen only draws. Your chart settings are kept in this browser; the numbers are fetched again each time.</p>
      </header>
      {datasets.error ? <Failed what="the list of data sets" error={datasets.error} retry={datasets.reload} /> : !datasets.data ? <Pending what="the list of data sets" />
        : list.length === 0 ? <Empty>The API publishes no data set right now, so no chart can be built.</Empty> : (
          <div className="dcustom-grid">
            <form className="dcustom-form" onSubmit={(e) => { e.preventDefault(); add() }}>
              <h3>Add a chart</h3>
              {draft && def && (
                <>
                  <label className="dselect"><span>Data set</span>
                    <select value={draft.dataset} onChange={(e) => { const d = list.find((x) => x.id === e.target.value); if (d) setDraft(defaultConfig(d)) }}>
                      {list.map((d) => (<option key={d.id} value={d.id}>{d.label} · {nf(d.rows)} records</option>))}
                    </select></label>
                  <label className="dselect"><span>Chart type</span>
                    <select value={draft.type} onChange={(e) => { const type = e.target.value as ChartType; set({ type, group: type === 'bar' && !draft.group ? def.categorical[0]?.key ?? '' : draft.group }) }}>
                      {TYPES.filter((k) => k !== 'bar' || def.categorical.length > 0).map((k) => (<option key={k} value={k}>{TYPE_LABEL[k]}</option>))}
                    </select></label>
                  {draft.type === 'scatter' && (
                    <label className="dselect"><span>X axis</span>
                      <select value={draft.x} onChange={(e) => set({ x: e.target.value })}>{def.numeric.map((v) => (<option key={v.key} value={v.key}>{unit(v)} · n = {nf(v.n)}</option>))}</select></label>
                  )}
                  <label className="dselect"><span>{draft.type === 'histogram' ? 'Variable' : 'Y axis'}</span>
                    <select value={draft.y} onChange={(e) => set({ y: e.target.value })}>{def.numeric.map((v) => (<option key={v.key} value={v.key}>{unit(v)} · n = {nf(v.n)}</option>))}</select></label>
                  {draft.type !== 'histogram' && def.categorical.length > 0 && (
                    <label className="dselect"><span>{draft.type === 'bar' ? 'Group by' : 'Colour by'}</span>
                      <select value={draft.group} onChange={(e) => set({ group: e.target.value })}>
                        {draft.type === 'scatter' && <option value="">No grouping</option>}
                        {def.categorical.map((v) => (<option key={v.key} value={v.key}>{v.label}</option>))}
                      </select></label>
                  )}
                  {draft.type === 'histogram' && (
                    <label className="dselect"><span>Classes: {draft.bins}</span><input type="range" min={3} max={20} value={draft.bins} onChange={(e) => set({ bins: +e.target.value })} /></label>
                  )}
                  {def.categorical.length > 0 && (
                    <label className="dselect"><span>Filter</span>
                      <select value={draft.filterKey} onChange={(e) => set({ filterKey: e.target.value, filterValue: '' })}>
                        <option value="">No filter</option>{def.categorical.map((v) => (<option key={v.key} value={v.key}>{v.label}</option>))}
                      </select>
                      {draft.filterKey && (
                        <select aria-label="Filter value" value={draft.filterValue} onChange={(e) => set({ filterValue: e.target.value })}>
                          <option value="">All values</option>{options.map((o) => (<option key={o}>{o}</option>))}
                        </select>
                      )}</label>
                  )}
                  {draftProblems.length > 0 && <p className="dcap dwarntext">Cannot be added: {draftProblems.join('; ')}.</p>}
                  <button className="dbtn dprimary" type="submit" disabled={widgets.length >= MAX || draftProblems.length > 0}>Add to my dashboard</button>
                  <p className="dcap">{widgets.length} of {MAX} charts.{saved ? '' : ' This browser refused to store the settings, so they will be lost on reload.'}</p>
                </>
              )}
            </form>
            <div className="dwidgets">
              {widgets.length === 0 && <Empty>No chart yet. Choose a data set and variables on the left and add your first chart. Nothing is shown here until you do.</Empty>}
              {widgets.map((w, i) => (
                <Guard key={w.id} what="This chart">
                  <WidgetCard w={w} i={i} last={i === widgets.length - 1} datasets={list} ingestAt={ingestAt} tick={tick} onMove={move} onRemove={remove} onRecord={onRecord}
                    onReset={(d) => setWidgets((all) => all.map((x) => (x.id === w.id ? { ...x, cfg: defaultConfig(d) } : x)))} />
                </Guard>
              ))}
              {datasets.data.note && <p className="dcap">{datasets.data.note}</p>}
            </div>
          </div>
        )}
    </section>
  )
}

function WidgetCard({ w, i, last, datasets, ingestAt, tick, onMove, onRemove, onRecord, onReset }: {
  w: Widget; i: number; last: boolean; datasets: Dataset[]; ingestAt: string | null; tick: number
  onMove: (i: number, by: number) => void; onRemove: (id: string) => void; onRecord: (id: string) => void; onReset: (d: Dataset) => void
}) {
  const { cfg } = w
  const problems = mismatch(cfg, datasets)
  const d = datasets.find((x) => x.id === cfg.dataset)
  const chart = useAsync(() => (problems.length ? Promise.resolve(null) : api.chart(cfg)), [JSON.stringify(cfg), problems.length, tick])
  const xv = d?.numeric.find((v) => v.key === cfg.x), yv = d?.numeric.find((v) => v.key === cfg.y)
  const gv = d?.categorical.find((v) => v.key === cfg.group), fv = d?.categorical.find((v) => v.key === cfg.filterKey)
  const c = chart.data?.chart
  const title = `${TYPE_LABEL[cfg.type] ?? cfg.type} · ${cfg.type === 'scatter' && xv ? `${xv.label} × ` : ''}${yv?.label ?? cfg.y}`
  const controls = (
    <span className="dwidget-ctl">
      <button className="dbtn" onClick={() => onMove(i, -1)} disabled={i === 0} aria-label={`Move chart ${i + 1} up`}>↑</button>
      <button className="dbtn" onClick={() => onMove(i, 1)} disabled={last} aria-label={`Move chart ${i + 1} down`}>↓</button>
      <button className="dbtn" onClick={() => onRemove(w.id)} aria-label={`Remove chart ${i + 1}`}>Remove</button>
    </span>
  )
  if (problems.length) {
    return (
      <article className="dwidget dwidget-bad">
        <header><div><span className="dkicker">Chart {i + 1} · saved settings no longer valid</span><h3>{title}</h3></div>{controls}</header>
        <p>This chart was saved against an earlier version of the data and cannot be drawn now: {problems.join('; ')}. Nothing is shown in its place.</p>
        {d && <button className="dbtn" onClick={() => onReset(d)}>Reset to the default chart of {d.label}</button>}
      </article>
    )
  }
  const mixed = d && d.id === 'todos'
  return (
    <article className="dwidget">
      <header>
        <div><span className="dkicker">Chart {i + 1} · {d?.label}</span><h3>{title}</h3></div>
        {controls}
      </header>
      {mixed && !cfg.filterKey && cfg.type !== 'bar' && !cfg.group && <p className="dcap dwarntext">This data set pools every investigation and fuel family. Without a grouping or a filter the chart mixes experiments that are not comparable.</p>}
      {chart.error ? <Failed what="this chart" error={chart.error} retry={chart.reload} /> : !c ? <Pending what="the chart" /> : (
        <>
          <div className="dwidget-chart">
            <ChartView chart={c} xLabel={unit(xv)} yLabel={unit(yv)} height={280} onPick={cfg.type === 'scatter' ? onRecord : undefined} />
          </div>
          <dl className="dkv">
            <div><dt>Records</dt><dd><b>{nf(c.used)}</b> used · <b>{nf(c.missing)}</b> left out because the cell is empty or not a number (never counted as zero) · {nf(d?.rows ?? 0)} in the data set</dd></div>
            <div><dt>Variables</dt><dd>{cfg.type === 'scatter' && xv ? <>X: {unit(xv)}, column “{xv.column}”. </> : null}{yv ? <>{cfg.type === 'histogram' ? 'Variable' : 'Y'}: {unit(yv)}, column “{yv.column}”.</> : null}{gv && cfg.type !== 'histogram' ? <> {cfg.type === 'bar' ? 'Mean per' : 'Coloured by'} {gv.label}.</> : null}</dd></div>
            <div><dt>Filter</dt><dd>{fv && cfg.filterValue ? `${fv.label} = ${cfg.filterValue}` : 'none'}</dd></div>
            <div><dt>Source</dt><dd className="dmono">{d ? (d.files.length <= 2 ? d.files.join(' · ') : `${d.files.length} PSI experimental tables`) : ''}</dd></div>
            <div><dt>Computed by</dt><dd><span className="dmono">/api/datasets/{cfg.dataset}/chart</span>{ingestAt ? `, Atlas ingestion of ${ingestAt}` : ''}</dd></div>
          </dl>
          <p className="dwidget-foot">
            {cfg.type === 'scatter' && <span className="dcap">Click a point to open its row in the PSI table.</span>}
            {cfg.type === 'bar' && <span className="dcap">Bars are unadjusted means per group; group sizes differ.</span>}
            <button className="dbtn" disabled={c.used + c.missing === 0} onClick={() => download(`atlas-${cfg.dataset}.csv`, api.csvUrl(cfg))}>Download CSV</button>
          </p>
        </>
      )}
    </article>
  )
}
