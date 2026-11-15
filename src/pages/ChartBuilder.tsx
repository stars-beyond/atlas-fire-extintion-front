// Monte seu gráfico: o construtor do dashboard COSMOEX FLAME, agora sobre todos os testes do Atlas.
// Escolha as variáveis, gere o gráfico e siga de um ponto até a linha original da tabela da NASA.
import { useEffect, useRef, useState } from 'react'
import { api, nf, type BuiltChart, type Dataset, type Family, type TestDetail } from '../api'
import { ChartView } from '../components/ChartView'
import { TYPE_LABEL, defaultConfig, type ChartConfig, type ChartType } from '../lib/chartBuilder'
import { useAtlas } from '../store'

const STORAGE = 'atlas.chartConfig'
function download(name: string, href: string) { const a = document.createElement('a'); a.href = href; a.download = name; a.click() }
const unit = (v?: { label: string; unit?: string }) => (v ? (v.unit ? `${v.label} (${v.unit})` : v.label) : '')

export function ChartBuilder() {
  const { setScenario, setStep, ignite } = useAtlas()
  const [datasets, setDatasets] = useState<Dataset[]>([])
  const [note, setNote] = useState('')
  const [chart, setChart] = useState<BuiltChart | null>(null)
  const [filterOptions, setFilterOptions] = useState<string[]>([])
  const [draft, setDraft] = useState<ChartConfig | null>(null)
  const [cfg, setCfg] = useState<ChartConfig | null>(null)
  const [picked, setPicked] = useState<string | null>(null)
  const [detail, setDetail] = useState<TestDetail | null>(null)
  const [saved, setSaved] = useState(false)
  const [err, setErr] = useState('')
  const chartRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    api.datasets().then((r) => {
      setDatasets(r.datasets); setNote(r.note)
      let start: ChartConfig | null = null
      try { const s = localStorage.getItem(STORAGE); if (s) { const c = JSON.parse(s); if (r.datasets.some((d) => d.id === c.dataset)) start = c } } catch { /* sem configuração salva */ }
      const first = r.datasets.find((d) => d.psi === 'PSI-69') ?? r.datasets[0]
      if (!start && first) start = defaultConfig(first)
      setDraft(start); setCfg(start)
    }).catch((e) => setErr(e.message))
  }, [])

  // o gráfico gerado: a API filtra, agrupa e calcula; a tela só desenha
  useEffect(() => {
    if (!cfg) return
    let live = true
    setChart(null)
    api.chart(cfg).then((r) => { if (live) setChart(r.chart) }).catch((e) => { if (live) setErr(e.message) })
    return () => { live = false }
  }, [cfg])

  // opções do filtro do rascunho (valores distintos da variável escolhida, calculados pela API)
  useEffect(() => {
    if (!draft?.filterKey) { setFilterOptions([]); return }
    let live = true
    api.chart({ ...draft, filterValue: '' }).then((r) => { if (live) setFilterOptions(r.filter_options) }).catch(() => { if (live) setFilterOptions([]) })
    return () => { live = false }
  }, [draft?.dataset, draft?.filterKey]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { setDetail(null); if (picked) api.test(picked).then(setDetail).catch(() => {}) }, [picked])

  const def = datasets.find((d) => d.id === draft?.dataset)
  const cdef = datasets.find((d) => d.id === cfg?.dataset)
  if (err) return <p className="empty">Não foi possível carregar os dados do construtor. {err}</p>
  if (!draft || !cfg || !def || !cdef) return <p className="empty">Carregando os conjuntos de dados…</p>

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
      ctx.scale(2, 2); ctx.drawImage(img, 0, 0); download('atlas-grafico.png', c.toDataURL('image/png'))
    }
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(resolved)
  }
  const t = detail?.test
  const drive = () => { if (t?.o2 != null && t?.pressure_atm != null) { setScenario({ o2: t.o2, pressure_atm: t.pressure_atm, gravity: t.gravity, family: (t.family === 'fumaca' ? 'todas' : t.family) as Family, material: t.family === 'solido' ? (t.material ?? '') : '' }); ignite(); setStep(2) } }

  return (
    <div className="builder">
      <form className="card builder-form" onSubmit={(e) => { e.preventDefault(); setCfg(draft); setPicked(null) }}>
        <h2>Monte seu gráfico</h2>
        <label className="fld"><span>Conjunto de dados</span>
          <select value={draft.dataset} onChange={(e) => setDataset(e.target.value)}>
            {datasets.map((d) => (<option key={d.id} value={d.id}>{d.label} · {nf(d.rows)} registros</option>))}
          </select></label>
        <label className="fld"><span>Tipo de gráfico</span>
          <select value={draft.type} onChange={(e) => set({ type: e.target.value as ChartType })}>
            {(Object.keys(TYPE_LABEL) as ChartType[]).filter((k) => k !== 'bar' || def.categorical.length > 0).map((k) => (<option key={k} value={k}>{TYPE_LABEL[k]}</option>))}
          </select></label>
        {draft.type === 'scatter' && (
          <label className="fld"><span>Eixo X</span>
            <select value={draft.x} onChange={(e) => set({ x: e.target.value })}>{def.numeric.map((v) => (<option key={v.key} value={v.key}>{unit(v)}</option>))}</select></label>
        )}
        <label className="fld"><span>{draft.type === 'histogram' ? 'Variável' : 'Eixo Y'}</span>
          <select value={draft.y} onChange={(e) => set({ y: e.target.value })}>{def.numeric.map((v) => (<option key={v.key} value={v.key}>{unit(v)}</option>))}</select></label>
        {draft.type !== 'histogram' && def.categorical.length > 0 && (
          <label className="fld"><span>{draft.type === 'bar' ? 'Agrupar por' : 'Cor por'}</span>
            <select value={draft.group} onChange={(e) => set({ group: e.target.value })}>
              {draft.type === 'scatter' && <option value="">Sem agrupamento</option>}
              {def.categorical.map((v) => (<option key={v.key} value={v.key}>{v.label}</option>))}
            </select></label>
        )}
        {draft.type === 'histogram' && (
          <label className="fld"><span>Classes: {draft.bins}</span>
            <input type="range" min={3} max={20} value={draft.bins} onChange={(e) => set({ bins: +e.target.value })} style={{ ['--fill' as string]: `${((draft.bins - 3) / 17) * 100}%` }} /></label>
        )}
        {def.categorical.length > 0 && (
          <label className="fld"><span>Filtrar por</span>
            <select value={draft.filterKey} onChange={(e) => set({ filterKey: e.target.value, filterValue: '' })}>
              <option value="">Sem filtro</option>{def.categorical.map((v) => (<option key={v.key} value={v.key}>{v.label}</option>))}
            </select>
            {draft.filterKey && (
              <select aria-label="Valor do filtro" value={draft.filterValue} onChange={(e) => set({ filterValue: e.target.value })}>
                <option value="">Todos</option>{filterOptions.map((o) => (<option key={o}>{o}</option>))}
              </select>
            )}</label>
        )}
        <button className="cta" type="submit">Gerar gráfico</button>
        <div className="builder-actions">
          <button type="button" className="ghost" disabled={!chart || chart.used + chart.missing === 0} onClick={() => download(`atlas-${cdef.id}.csv`, api.csvUrl(cfg))}>CSV</button>
          <button type="button" className="ghost" onClick={exportPng}>PNG</button>
          <button type="button" className="ghost" onClick={() => { try { localStorage.setItem(STORAGE, JSON.stringify(cfg)) } catch { /* armazenamento indisponível */ } setSaved(true); setTimeout(() => setSaved(false), 1500) }}>{saved ? 'Salvo' : 'Salvar'}</button>
        </div>
      </form>

      <div className="builder-main">
        <div className="card">
          <div className="sec-title">
            <h2>{TYPE_LABEL[cfg.type]} · {cfg.type === 'scatter' && xv ? `${xv.label} × ` : ''}{yv?.label}</h2>
            {chart && <span className="badges"><span className="pill">{nf(chart.used)} usados</span><span className="pill" style={{ color: 'var(--parcial)', borderColor: 'var(--parcial)' }}>{nf(chart.missing)} ausentes</span></span>}
          </div>
          <div ref={chartRef}>
            {chart ? <ChartView chart={chart} xLabel={unit(xv)} yLabel={unit(yv)} onPick={cfg.type === 'scatter' ? setPicked : undefined} /> : <p className="empty">Carregando os registros…</p>}
          </div>
          <dl className="kv">
            <dt>Conjunto</dt><dd>{cdef.label}{cfg.filterKey && cfg.filterValue ? ` · filtro: ${cfg.filterValue}` : ''}</dd>
            <dt>Origem</dt><dd className="mono">{cdef.files.length <= 2 ? cdef.files.join(' · ') : `${cdef.files.length} tabelas experimentais do PSI`}</dd>
            {yv && (<><dt>Coluna Y</dt><dd className="mono">“{yv.column}”{yv.unit ? ` · ${yv.unit}` : ''}</dd></>)}
            {cfg.type === 'scatter' && xv && (<><dt>Coluna X</dt><dd className="mono">“{xv.column}”{xv.unit ? ` · ${xv.unit}` : ''}</dd></>)}
            <dt>Ausentes</dt><dd>Células vazias ou só com texto ficam de fora, nunca viram zero.</dd>
          </dl>
          {cfg.type === 'scatter' && <p className="note">Clique num ponto para abrir o registro original.</p>}
        </div>

        <div className="card">
          <h2>Do ponto ao registro da NASA</h2>
          {!picked ? <p className="note">Nenhum ponto selecionado.</p> : !detail ? <p className="note">Abrindo o registro…</p> : (
            <>
              <p className="mono">{detail.source}</p>
              <div className="tbl-wrap"><table><tbody>
                {Object.entries(detail.raw || {}).filter(([k]) => k).map(([k, v]) => (
                  <tr key={k}><td className="dim">{k}</td><td>{v === '' ? <span style={{ color: 'var(--parcial)' }}>vazio</span> : String(v)}</td></tr>
                ))}
              </tbody></table></div>
              <div className="badges">
                <a href={`https://psi.nasa.gov/physci/repo/data/investigations/${t.investigation_id}`} target="_blank" rel="noreferrer">Registro {t.investigation_id} no NASA PSI</a>
                {t.o2 != null && t.pressure_atm != null && <button className="ghost" onClick={drive}>Fazer o test drive nesta condição</button>}
              </div>
            </>
          )}
        </div>
        {note && <p className="note">{note} Construtor de gráficos vindo do dashboard COSMOEX FLAME da equipe.</p>}
      </div>
    </div>
  )
}
