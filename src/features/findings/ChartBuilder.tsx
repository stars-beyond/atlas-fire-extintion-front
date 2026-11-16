// Monte seu gráfico: o construtor do dashboard COSMOEX FLAME, agora sobre todos os testes do Atlas.
// Escolha as variáveis, gere o gráfico e siga de um ponto até a linha original da tabela da NASA.
import { useEffect, useRef, useState } from 'react'
import { api } from '../../api'
import { download } from '../../lib/download'
import { nf } from '../../lib/format'
import { psiUrl } from '../../lib/url'
import { useAsync } from '../../lib/useAsync'
import { useAtlas } from '../../state'
import type { Dataset, Family } from '../../types'
import { ChartView } from './ChartView'
import { TYPE_LABEL, defaultConfig, isChartConfig, mismatch, unit, type ChartConfig, type ChartType } from './chartConfig'
import { useFilterOptions } from './useFilterOptions'

const STORAGE = 'atlas.chartConfig'

// A configuração salva neste navegador, se ainda puder ser desenhada com os datasets que a API publica hoje.
// problems: por que ela foi descartada (vazio quando não havia nada salvo ou quando ela vale).
function loadSaved(datasets: Dataset[]): { cfg: ChartConfig | null; problems: string[] } {
  let text: string | null = null
  try { text = localStorage.getItem(STORAGE) } catch { /* armazenamento indisponível */ }
  if (!text) return { cfg: null, problems: [] }
  let raw: unknown
  try { raw = JSON.parse(text) } catch { return { cfg: null, problems: ['they could not be read'] } }
  if (!isChartConfig(raw)) return { cfg: null, problems: ['they are not a complete chart configuration'] }
  const problems = mismatch(raw, datasets)
  return problems.length ? { cfg: null, problems } : { cfg: raw, problems: [] }
}

export function ChartBuilder() {
  const { setScenario, setStep, ignite } = useAtlas()
  // A lista de datasets. Só a falha dela impede o construtor de abrir; a falha de um gráfico ou de um registro
  // fica no cartão dele, com nova tentativa, e some quando outro é pedido.
  const list = useAsync(() => api.datasets().then((r) => ({ datasets: Array.isArray(r?.datasets) ? r.datasets : [], note: r?.note ?? '' })), [])
  const datasets = list.data?.datasets ?? [], note = list.data?.note ?? ''
  const [draft, setDraft] = useState<ChartConfig | null>(null)
  const [cfg, setCfg] = useState<ChartConfig | null>(null)
  const [dropped, setDropped] = useState<string[]>([])   // por que a configuração salva não foi usada
  const [picked, setPicked] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const chartRef = useRef<HTMLDivElement>(null)

  // configuração inicial, uma vez, quando a lista chega: a salva (se ainda vale para os datasets de hoje) ou a padrão
  useEffect(() => {
    if (draft || !list.data) return
    const ds = list.data.datasets
    const stored = loadSaved(ds)
    const first = ds.find((d) => d.psi === 'PSI-69') ?? ds[0]
    const start = stored.cfg ?? (first ? defaultConfig(first) : null)
    setDropped(stored.problems); setDraft(start); setCfg(start)
  }, [list.data]) // eslint-disable-line react-hooks/exhaustive-deps

  // o gráfico gerado: a API filtra, agrupa e calcula; a tela só desenha
  const built = useAsync(() => (cfg ? api.chart(cfg).then((r) => r.chart) : Promise.resolve(null)), [cfg])
  const chart = built.loading ? null : built.data
  // opções do filtro do rascunho (valores distintos da variável escolhida, calculados pela API)
  const filterOptions = useFilterOptions(draft)
  // o registro original do ponto escolhido
  const rec = useAsync(() => (picked ? api.test(picked) : Promise.resolve(null)), [picked])
  const detail = rec.loading ? null : rec.data

  const def = datasets.find((d) => d.id === draft?.dataset)
  const cdef = datasets.find((d) => d.id === cfg?.dataset)
  if (list.error) return <p className="empty">Could not load the chart builder data. {list.error} <button className="link" onClick={list.reload}>Try again</button></p>
  if (list.data && datasets.length === 0) return <p className="empty">The API publishes no dataset right now, so no chart can be built.</p>
  if (!draft || !cfg || !def || !cdef) return <p className="empty">Loading datasets…</p>

  const yv = cdef.numeric.find((v) => v.key === cfg.y), xv = cdef.numeric.find((v) => v.key === cfg.x)
  const setDataset = (id: string) => { const d = datasets.find((x) => x.id === id); if (d) setDraft(defaultConfig(d)) }
  const set = (patch: Partial<ChartConfig>) => setDraft({ ...draft, ...patch })

  const exportPng = () => {
    const svg = chartRef.current?.querySelector('svg'); if (!svg) return
    const xml = new XMLSerializer().serializeToString(svg)
    const css = getComputedStyle(document.documentElement)
    const resolved = xml.replace(/var\(--([\w-]+)\)/g, (_, n) => css.getPropertyValue(`--${n}`).trim() || '#888')
    const img = new window.Image()
    const { width, height } = svg.getBoundingClientRect()
    img.onload = () => {
      const c = document.createElement('canvas'); c.width = width * 2; c.height = height * 2
      const ctx = c.getContext('2d')!; ctx.fillStyle = css.getPropertyValue('--ink-1'); ctx.fillRect(0, 0, c.width, c.height)
      ctx.scale(2, 2); ctx.drawImage(img, 0, 0); download('atlas-chart.png', c.toDataURL('image/png'))
    }
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(resolved)
  }
  const t = detail?.test
  const drive = () => { if (t?.o2 != null && t?.pressure_atm != null) { setScenario({ o2: t.o2, pressure_atm: t.pressure_atm, gravity: t.gravity, family: (t.family === 'fumaca' ? 'todas' : t.family) as Family, material: t.family === 'solido' ? (t.material ?? '') : '' }); ignite(); setStep(2) } }

  return (
    <div className="builder">
      <form className="card builder-form" onSubmit={(e) => { e.preventDefault(); if (draft === cfg && built.error) built.reload(); setCfg(draft); setPicked(null) }}>
        <h2>Build your chart</h2>
        <label className="fld"><span>Dataset</span>
          <select value={draft.dataset} onChange={(e) => setDataset(e.target.value)}>
            {datasets.map((d) => (<option key={d.id} value={d.id}>{d.label} · {nf(d.rows)} {d.rows === 1 ? 'record' : 'records'}</option>))}
          </select></label>
        <label className="fld"><span>Chart type</span>
          <select value={draft.type} onChange={(e) => set({ type: e.target.value as ChartType })}>
            {(Object.keys(TYPE_LABEL) as ChartType[]).filter((k) => k !== 'bar' || def.categorical.length > 0).map((k) => (<option key={k} value={k}>{TYPE_LABEL[k]}</option>))}
          </select></label>
        {draft.type === 'scatter' && (
          <label className="fld"><span>X axis</span>
            <select value={draft.x} onChange={(e) => set({ x: e.target.value })}>{def.numeric.map((v) => (<option key={v.key} value={v.key}>{unit(v)}</option>))}</select></label>
        )}
        <label className="fld"><span>{draft.type === 'histogram' ? 'Variable' : 'Y axis'}</span>
          <select value={draft.y} onChange={(e) => set({ y: e.target.value })}>{def.numeric.map((v) => (<option key={v.key} value={v.key}>{unit(v)}</option>))}</select></label>
        {draft.type !== 'histogram' && def.categorical.length > 0 && (
          <label className="fld"><span>{draft.type === 'bar' ? 'Group by' : 'Color by'}</span>
            <select value={draft.group} onChange={(e) => set({ group: e.target.value })}>
              {draft.type === 'scatter' && <option value="">No grouping</option>}
              {def.categorical.map((v) => (<option key={v.key} value={v.key}>{v.label}</option>))}
            </select></label>
        )}
        {draft.type === 'histogram' && (
          <label className="fld"><span>Bins: {draft.bins}</span>
            <input type="range" min={3} max={20} value={draft.bins} onChange={(e) => set({ bins: +e.target.value })} style={{ ['--fill' as string]: `${((draft.bins - 3) / 17) * 100}%` }} /></label>
        )}
        {def.categorical.length > 0 && (
          <label className="fld"><span>Filter by</span>
            <select value={draft.filterKey} onChange={(e) => set({ filterKey: e.target.value, filterValue: '' })}>
              <option value="">No filter</option>{def.categorical.map((v) => (<option key={v.key} value={v.key}>{v.label}</option>))}
            </select>
            {draft.filterKey && (
              <select aria-label="Filter value" value={draft.filterValue} onChange={(e) => set({ filterValue: e.target.value })}>
                <option value="">All</option>{filterOptions.map((o) => (<option key={o}>{o}</option>))}
              </select>
            )}</label>
        )}
        <button className="cta" type="submit">Generate chart</button>
        <div className="builder-actions">
          <button type="button" className="ghost" disabled={!chart || chart.used + chart.missing === 0} onClick={() => download(`atlas-${cdef.id}.csv`, api.csvUrl(cfg))}>CSV</button>
          <button type="button" className="ghost" disabled={!chart || chart.used === 0} onClick={exportPng}>PNG</button>
          <button type="button" className="ghost" onClick={() => { try { localStorage.setItem(STORAGE, JSON.stringify(cfg)) } catch { /* armazenamento indisponível */ } setDropped([]); setSaved(true); setTimeout(() => setSaved(false), 1500) }}>{saved ? 'Saved' : 'Save'}</button>
        </div>
        {dropped.length > 0 && <p className="note">The chart settings saved in this browser were not used: {dropped.join('; ')}. The default chart is shown instead.</p>}
      </form>

      <div className="builder-main">
        <div className="card">
          <div className="sec-title">
            <h2>{TYPE_LABEL[cfg.type]} · {cfg.type === 'scatter' && xv ? `${xv.label} × ` : ''}{yv?.label}</h2>
            {chart && <span className="badges"><span className="pill">{nf(chart.used)} used</span><span className="pill" style={{ color: 'var(--parcial)', borderColor: 'var(--parcial)' }}>{nf(chart.missing)} missing</span></span>}
          </div>
          <div ref={chartRef}>
            {built.error ? <p className="empty">Could not load this chart. {built.error} <button type="button" className="link" onClick={built.reload}>Try again</button></p>
              : chart ? <ChartView chart={chart} xLabel={unit(xv)} yLabel={unit(yv)} onPick={cfg.type === 'scatter' ? setPicked : undefined} /> : <p className="empty">Loading records…</p>}
          </div>
          <dl className="kv">
            <dt>Dataset</dt><dd>{cdef.label}{cfg.filterKey && cfg.filterValue ? ` · filter: ${cfg.filterValue}` : ''}</dd>
            <dt>Source</dt><dd className="mono">{cdef.files.length <= 2 ? cdef.files.join(' · ') : `${cdef.files.length} PSI experiment tables`}</dd>
            {yv && (<><dt>Y column</dt><dd className="mono">“{yv.column}”{yv.unit ? ` · ${yv.unit}` : ''}</dd></>)}
            {cfg.type === 'scatter' && xv && (<><dt>X column</dt><dd className="mono">“{xv.column}”{xv.unit ? ` · ${xv.unit}` : ''}</dd></>)}
            <dt>Missing</dt><dd>Empty or text-only cells are left out; they never become zero.</dd>
          </dl>
          {cfg.type === 'scatter' && <p className="note">Click a point to open the original record.</p>}
        </div>

        <div className="card">
          <h2>From point to NASA record</h2>
          {!picked ? <p className="note">No point selected.</p>
            : rec.error ? <p className="note">Could not open this record. {rec.error} <button type="button" className="link" onClick={rec.reload}>Try again</button></p>
            : !detail ? <p className="note">Opening record…</p> : (
            <>
              <p className="mono">{detail.source}</p>
              <div className="tbl-wrap"><table><tbody>
                {Object.entries(detail.raw || {}).filter(([k]) => k).map(([k, v]) => (
                  <tr key={k}><td className="dim">{k}</td><td>{v === '' ? <span style={{ color: 'var(--parcial)' }}>empty</span> : String(v)}</td></tr>
                ))}
              </tbody></table></div>
              <div className="badges">
                <a href={psiUrl(t.investigation_id)} target="_blank" rel="noreferrer">Record {t.investigation_id} in NASA PSI</a>
                {t.o2 != null && t.pressure_atm != null && <button className="ghost" onClick={drive}>Test drive this condition</button>}
              </div>
            </>
          )}
        </div>
        {note && <p className="note">{note} Chart builder adapted from the team's COSMOEX FLAME dashboard.</p>}
      </div>
    </div>
  )
}
