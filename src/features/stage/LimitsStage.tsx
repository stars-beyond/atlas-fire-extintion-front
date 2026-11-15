// Limites: onde a chama se sustenta e onde ela apaga, em oxigênio × vento.
// A leitura é uma só: de um lado da curva a chama queima, do outro apaga (por falta de ar embaixo, soprada
// pelo vento em cima). A curva é a que a NASA publicou para o bastão de acrílico do BASS-II; ela chega pronta
// da API, e a avaliação do cenário também. Os pontos são os testes reais, em duas cores: queimou ou apagou.
// O cenário é o ponto amarelo: dá para arrastá-lo pelo gráfico (ou usar os controles) e ver o veredito mudar.
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react'
import { api } from '../../api'
import { gLabel, nf } from '../../lib/format'
import { WIND_MAX, useAtlas } from '../../state'
import type { Assessment, FlamPoint, FlamTest, Flammability } from '../../types'

type State = FlamPoint['state']
const BURNED: State[] = ['queimou', 'vento_nao_apagou']
const WHAT: Record<State, string> = {
  queimou: 'Burned', vento_nao_apagou: 'Burned and was not blown out', apagou_pouco_ar: 'Went out for lack of air',
  apagou_vento: 'Blown out by the airflow', apagou_sozinha: 'Went out on its own', nao_sustentou: 'Did not sustain itself',
}
const FORM_SHORT: Record<string, string> = {
  'bastão de acrílico': 'Acrylic rod', 'tecido de algodão (SIBAL)': 'Cotton fabric', 'filme fino de acrílico': 'Thin acrylic film',
  'placa de acrílico': 'Acrylic slab', 'tecido Nomex': 'Nomex fabric', 'esfera de acrílico': 'Acrylic sphere', 'vela de cera': 'Wax candle',
}
const nTests = (n: number) => `${n} ${n === 1 ? 'test' : 'tests'}`
// geometry values come from the API in Portuguese (the ML pipeline uses them as keys); shown in English
const GEOMETRY: Record<string, string> = { 'contra o vento': 'opposed flow', 'a favor do vento': 'concurrent flow' }
const FORM_FOR: Record<string, string> = { pmma: 'bastão de acrílico', sibal: 'tecido de algodão (SIBAL)', nomex: 'tecido Nomex' }
const Y0 = 0.3, Y1 = 60          // faixa do eixo do vento, em cm/s (escala logarítmica)
const X0 = 11, X1 = 36           // faixa do eixo do oxigênio quando há curva, em %
const STATUS: Record<Assessment['status'], { color: string; text: string }> = {
  queima: { color: '--g1', text: 'The flame keeps burning' }, no_limite: { color: '--parcial', text: 'The flame is at the limit' }, nao_sustenta: { color: '--g0', text: 'The flame goes out' },
}

let cache: Promise<Flammability> | null = null

export function LimitsStage() {
  const { scenario, setScenario, selectTest, selectedTest, wind, setWind, meta, setView } = useAtlas()
  const host = useRef<HTMLDivElement>(null), top = useRef<HTMLDivElement>(null), svg = useRef<SVGSVGElement>(null)
  const [size, setSize] = useState({ w: 600, h: 400, top: 40 })
  const [data, setData] = useState<Flammability | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<string | null>(null)
  const [hover, setHover] = useState<{ t: FlamTest; p: FlamPoint; x: number; y: number } | null>(null)
  const [as, setAs] = useState<Assessment | null>(null)
  const [why, setWhy] = useState(false)
  const [drag, setDrag] = useState(false)

  useEffect(() => {
    cache ??= api.flammability()
    cache.then(setData).catch((e) => { cache = null; setError(String(e.message || e)) })
  }, [])
  // mede antes de pintar, para o gráfico já nascer no tamanho certo do palco
  useLayoutEffect(() => {
    const el = host.current!
    const measure = () => setSize((s) => {
      const n = { w: el.clientWidth || 600, h: el.clientHeight || 400, top: top.current?.offsetHeight || 40 }
      return n.w === s.w && n.h === s.h && n.top === s.top ? s : n
    })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el); if (top.current) ro.observe(top.current)
    return () => ro.disconnect()
  }, [data, as?.status])
  // a amostra segue o material escolhido no test drive, até a pessoa trocar aqui
  useEffect(() => { setForm(null) }, [scenario.material])

  const forms = data?.forms ?? []
  const wanted = form ?? FORM_FOR[scenario.material || ''] ?? forms[0]?.form
  const active = forms.some((f) => f.form === wanted) ? wanted : forms[0]?.form
  const tests = useMemo(() => (data?.tests ?? []).filter((t) => t.form === active), [data, active])
  // still: o vento desse ponto ficou abaixo do que o medidor distingue (menos de 2 cm/s, estimado pela calibração do ventilador)
  const points = useMemo(() => tests.flatMap((t) => t.points.filter((p) => p.flow_cm_s != null).map((p) => ({ t, p, still: !!p.flow_range && p.flow_cm_s! < 2 }))), [tests])
  const bound = data?.boundaries?.find((b) => b.form === active) ?? null

  useEffect(() => {
    if (!bound) { setAs(null); return }
    let live = true
    const t = setTimeout(() => { api.assess(scenario, wind, bound.form).then((r) => { if (live) setAs(r.assessment ?? null) }).catch(() => { if (live) setAs(null) }) }, 60)
    return () => { live = false; clearTimeout(t) }
  }, [bound, scenario.o2, scenario.pressure_atm, scenario.gravity, wind])
  useEffect(() => { if (!bound) setWhy(false) }, [bound])

  const { w, h } = size
  // palco baixo (painel pequeno ou celular): o seletor sobe para a linha do alternador, os controles saem
  // (fica o arraste no gráfico) e o veredito vira uma linha no rodapé
  const compact = h < 360
  const STRIP = 18   // faixa sob o gráfico para os testes com o ar quase parado, que o medidor não distingue
  const m = compact ? { l: 40, r: 14, t: 66, b: 56 + STRIP } : { l: 50, r: 18, t: 104 + size.top + 22, b: (bound ? 104 : 46) + STRIP }
  const plotW = Math.max(0, w - m.l - m.r), plotH = Math.max(0, h - m.t - m.b)
  const o2s = points.map((q) => q.p.o2)
  const scO2 = scenario.o2 * 100
  const x0 = bound ? X0 : Math.floor(Math.min(14, ...o2s) - 0.6), x1 = bound ? X1 : Math.ceil(Math.max(22, ...o2s) + 0.6)
  const X = (o2: number) => m.l + ((Math.min(x1, Math.max(x0, o2)) - x0) / (x1 - x0)) * plotW
  const Y = (u: number) => h - m.b - ((Math.log(Math.min(Y1, Math.max(Y0, u))) - Math.log(Y0)) / (Math.log(Y1) - Math.log(Y0))) * plotH
  const yTicks = compact ? [1, 2, 5, 20, 50] : [0.5, 1, 2, 5, 10, 20, 50]
  const step = x1 - x0 > 14 ? 4 : 2
  const xTicks = Array.from({ length: Math.floor((x1 - x0) / step) + 2 }, (_, i) => Math.ceil(x0 / step) * step + i * step).filter((v) => v <= x1)
  const r = w < 520 ? 3.4 : 4.2

  // a curva chega amostrada da API; aqui só o trecho que cabe no eixo do vento
  const curve = useMemo(() => (bound?.curve ?? []).filter((c) => c.flow_cm_s >= Y0 * 0.9 && c.flow_cm_s <= Y1), [bound])
  const path = (dx: number) => curve.map((c, i) => `${i ? 'L' : 'M'}${X(c.o2 + dx).toFixed(1)},${Y(c.flow_cm_s).toFixed(1)}`).join(' ')
  const right = w - m.r, bottom = h - m.b
  const burnZone = curve.length ? `${path(0)} L${right},${m.t} L${right},${bottom} Z` : ''
  const testedMax = bound?.tested.o2[1] ?? 0
  const partial = scenario.gravity > 0.005
  const hab = meta?.habitats.find((x) => x.id === scenario.habitat)?.name ?? 'Your scenario'
  const windText = wind > 0 ? `airflow ${nf(wind, wind < 5 && wind % 1 ? 1 : 0)} cm/s` : 'ventilation off'

  // arrastar no gráfico leva o cenário até ali: oxigênio na horizontal, vento na vertical
  const moveTo = (ev: RPointerEvent) => {
    const box = svg.current!.getBoundingClientRect()
    const fx = Math.min(1, Math.max(0, (ev.clientX - box.left - m.l) / Math.max(1, plotW)))
    const fy = Math.min(1, Math.max(0, (h - m.b - (ev.clientY - box.top)) / Math.max(1, plotH)))
    const o2 = Math.round((x0 + fx * (x1 - x0)) * 2) / 2
    const u = Math.exp(Math.log(Y0) + fy * (Math.log(Y1) - Math.log(Y0)))
    setWind(u < 0.4 ? 0 : u < 5 ? Math.round(u * 2) / 2 : Math.round(u))
    if (Math.abs(o2 - scO2) > 0.01) setScenario({ o2: o2 / 100 }, undefined, true)
  }
  const onDown = (ev: RPointerEvent) => { if (!bound || ev.button !== 0) return; (ev.currentTarget as Element).setPointerCapture(ev.pointerId); setDrag(true); setHover(null); moveTo(ev) }
  const onMove = (ev: RPointerEvent) => { if (drag) moveTo(ev) }
  const onUp = () => setDrag(false)

  const st = as ? STATUS[as.status] : null
  const verdict = as && st ? (
    <button className="limits-verdict" style={{ borderColor: `var(${st.color})` }} aria-expanded={why} onClick={() => setWhy((v) => !v)}>
      <b style={{ color: `var(${st.color})` }}>{st.text}</b>
      <span>{hab} · {nf(scO2, scO2 % 1 ? 1 : 0)}% oxygen · {windText}{partial ? ` · ${gLabel(scenario.gravity)}` : ''} · {as.inside_tested ? 'within the tested band' : 'estimate'} · see why</span>
    </button>
  ) : <span className="limits-hint">{bound ? '' : 'NASA only published the curve for the acrylic rod. For this sample, here are the tests.'}</span>

  return (
    <div ref={host} className={`limits${compact ? ' compact' : ''}`}>
      {error && <p className="lab-wait">Could not load the outcomes: {error}</p>}
      {data && !data.available && <p className="lab-wait">The outcomes have not been loaded into the database yet.</p>}
      {data?.available && (
        <>
          <svg ref={svg} className="limits-svg" width={w} height={h} role="img"
            aria-label={`Limits for ${FORM_SHORT[active] ?? active}: ${tests.length} NASA ${tests.length === 1 ? 'test' : 'tests'} by oxygen and airflow.${as && st ? ` ${hab}: ${st.text.toLowerCase()}. ${as.detail}` : ''}`}>
            <defs>
              <pattern id="limits-hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <line x1="0" y1="0" x2="0" y2="8" stroke="var(--ink-0)" strokeWidth="3" strokeOpacity=".55" />
              </pattern>
              <clipPath id="limits-clip"><rect x={m.l} y={m.t} width={plotW} height={plotH} /></clipPath>
            </defs>
            {/* as duas zonas: apaga (fundo) e queima (à direita da curva) */}
            {bound && curve.length > 0 && (
              <g clipPath="url(#limits-clip)">
                <rect x={m.l} y={m.t} width={plotW} height={plotH} className="limits-out" />
                <path d={burnZone} className="limits-burn" />
                {/* à direita do último teste ninguém queimou um sólido: a zona continua, mas riscada */}
                {x1 > testedMax + 0.5 && <rect x={X(testedMax)} y={m.t} width={Math.max(0, right - X(testedMax))} height={plotH} fill="url(#limits-hatch)" />}
                <path d={`${path(-bound.band_o2)} ${curve.slice().reverse().map((c) => `L${X(c.o2 + bound.band_o2).toFixed(1)},${Y(c.flow_cm_s).toFixed(1)}`).join(' ')} Z`} className="limits-band" />
                <path d={path(0)} className="limits-curve" />
              </g>
            )}
            {yTicks.map((v) => (
              <g key={v}>
                <line x1={m.l} x2={right} y1={Y(v)} y2={Y(v)} className="limits-grid" />
                <text x={m.l - 8} y={Y(v) + 4} textAnchor="end">{nf(v, v < 1 ? 1 : 0)}</text>
              </g>
            ))}
            {/* faixa do ar quase parado: só o oxigênio desses testes é confiável, então eles ficam fora do gráfico */}
            <rect x={m.l} y={bottom + 3} width={plotW} height={STRIP - 4} className="limits-still" />
            <text x={m.l - 8} y={bottom + STRIP - 4} textAnchor="end">≈0</text>
            {!compact && <text x={right - 4} y={bottom + STRIP - 5} textAnchor="end" className="limits-stilltxt">near-still air: below what the meter can resolve</text>}
            {xTicks.map((v) => <text key={v} x={X(v)} y={bottom + STRIP + 14} textAnchor="middle">{v}%{v === xTicks[0] ? ' O₂' : ''}</text>)}
            <text x={m.l} y={m.t - (compact ? 6 : 9)} className="limits-axis">airflow, cm/s</text>
            {bound && curve.length > 0 && (
              <g className="limits-zones">
                <text x={m.l + 8} y={m.t + 18} className="out">GOES OUT · airflow blows the flame off</text>
                <text x={m.l + 8} y={bottom - 9} className="out">GOES OUT · not enough air</text>
                <text x={X(18.4)} y={Y(1.1) + 4} className="burn">BURNS</text>
                {x1 > testedMax + 0.5 && (
                  <>
                    <line x1={X(testedMax)} x2={X(testedMax)} y1={m.t} y2={bottom} className="limits-edge" />
                    <text x={(X(testedMax) + right) / 2} y={bottom - 7} textAnchor="middle" className="void">no tests here</text>
                  </>
                )}
              </g>
            )}
            {/* área de arraste: fica por baixo dos pontos, que continuam clicáveis */}
            {bound && <rect x={m.l} y={m.t} width={plotW} height={plotH} className={`limits-drag${drag ? ' on' : ''}`} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} />}
            {points.map(({ t, p, still }, i) => {
              const x = X(p.o2), y = still ? bottom + STRIP / 2 + 1 : Y(p.flow_cm_s!)
              const on = selectedTest === t.atlas_id, burned = BURNED.includes(p.state)
              return (
                <g key={t.test + i} transform={`translate(${x},${y})`} className="limits-pt" style={drag ? { pointerEvents: 'none' } : undefined}
                  onPointerEnter={() => setHover({ t, p, x, y })} onPointerLeave={() => setHover(null)}
                  onClick={() => t.atlas_id && selectTest(t.atlas_id)}>
                  <circle r={9} fill="transparent" />
                  {on && <circle r={r + 5} fill="none" stroke="var(--act)" strokeWidth={1.6} />}
                  <circle r={r} fill={burned ? 'var(--g1)' : 'var(--g0)'} stroke="var(--ink-0)" strokeWidth={0.8} />
                </g>
              )
            })}
            {as && bound && (
              <g className="limits-scn" style={{ pointerEvents: 'none' }}>
                {/* com gravidade, o vento natural soma-se ao da ventilação: a barra vai até onde ele pode chegar */}
                {partial && <line x1={X(scO2)} x2={X(scO2)} y1={Y(as.flow_cm_s[0])} y2={Y(as.flow_cm_s[1])} className="range" />}
                {partial && <line x1={X(scO2) - 6} x2={X(scO2) + 6} y1={Y(as.flow_cm_s[1])} y2={Y(as.flow_cm_s[1])} className="range" />}
                <circle cx={X(scO2)} cy={Y(as.flow_cm_s[0])} r={drag ? 9 : 7} />
                <text x={X(scO2) + (X(scO2) > right - 120 ? -12 : 12)} y={Y(as.flow_cm_s[0]) + (Y(as.flow_cm_s[0]) > bottom - 24 ? -10 : 18)} textAnchor={X(scO2) > right - 120 ? 'end' : 'start'}>
                  {scO2 > x1 ? `${hab} (${nf(scO2, 0)}%) →` : hab}
                </text>
              </g>
            )}
          </svg>
          <div ref={top} className="limits-top">
            <label>
              <span className="cap">Sample</span>
              <select value={active} onChange={(e) => setForm(e.target.value)}>
                {forms.map((f) => <option key={f.form} value={f.form}>{FORM_SHORT[f.form] ?? f.form} · {nTests(f.n)}</option>)}
              </select>
            </label>
            {!compact && verdict}
          </div>
          {compact && verdict}
          {!compact && bound && (
            <div className="limits-ctl">
              <div className="slider">
                <div className="slider-top"><label htmlFor="limO2">Oxygen</label><b>{nf(scO2, scO2 % 1 ? 1 : 0)}%</b></div>
                <input id="limO2" type="range" min={X0} max={X1} step={0.5} value={Math.min(X1, Math.max(X0, scO2))} onChange={(e) => setScenario({ o2: +e.target.value / 100 }, undefined, true)}
                  style={{ ['--fill' as string]: `${((Math.min(X1, Math.max(X0, scO2)) - X0) / (X1 - X0)) * 100}%` }} />
              </div>
              <div className="slider">
                <div className="slider-top"><label htmlFor="limW">Airflow</label><b>{wind > 0 ? `${nf(wind, wind < 5 && wind % 1 ? 1 : 0)} cm/s` : 'off'}</b></div>
                <input id="limW" type="range" min={0} max={WIND_MAX} step={1} value={wind} onChange={(e) => setWind(+e.target.value)} style={{ ['--fill' as string]: `${(wind / WIND_MAX) * 100}%` }} />
              </div>
            </div>
          )}
          <div className="limits-legend">
            <span><i style={{ background: 'var(--g1)' }} />Burned</span>
            <span><i style={{ background: 'var(--g0)' }} />Went out</span>
            {bound && <span><svg width="18" height="12" viewBox="0 0 18 12" aria-hidden="true"><path d="M1,6 L17,6" className="limits-curve" /></svg>NASA curve</span>}
            {bound && <span><i className="scn" />Your scenario (drag)</span>}
          </div>
          {why && as && bound && st && (
            <aside className="test-card limits-why" aria-label="How this reading was made">
              <header><b>{st.text}</b><button className="x" onClick={() => setWhy(false)} aria-label="Close">×</button></header>
              <dl>
                <dt>What the curve says</dt><dd>{as.detail}</dd>
                {partial && (
                  <><dt>Airflow taken into account</dt><dd>
                    {nf(as.forced_cm_s, 0)} cm/s from ventilation, plus {nf(as.buoyant_cm_s[0], 0)} to {nf(as.buoyant_cm_s[1], 0)} cm/s of buoyant flow that gravity drives around the flame. That is the bar above the dot.
                  </dd></>
                )}
                {as.outside.length > 0 && (<><dt>Why this is an estimate</dt><dd><ul>{as.outside.map((o) => <li key={o}>{o}</li>)}</ul></dd></>)}
                <dt>How far to trust the curve</dt>
                <dd>
                  {bound.check.blowoff.n} blowoff extinctions read from the appendix lie on average {nf(bound.check.blowoff.rms_diff_o2, 1)} O₂ percentage points from it (the worst, {nf(bound.check.blowoff.max_abs_diff_o2, 1)}). The light band around the curve is that wide.
                  {` At 1 g, NASA measured ${nf(bound.buoyancy.earth_check.o2, 1)}% O₂ at the limit; the curve gives ${nf(bound.buoyancy.earth_check.curve_o2, 1)}%.`}
                </dd>
                {as.outside.length > 0 && (<><dt>How to settle it</dt><dd><button className="link" onClick={() => setView('proximo')}>See the queue of experiments that would close these caveats</button></dd></>)}
                <dt>Source</dt><dd className="mono"><a href={bound.published.url} target="_blank" rel="noreferrer">{bound.published.source}</a> · {bound.published.equation}</dd>
              </dl>
            </aside>
          )}
          {hover && !drag && (
            <div className="map-tip" style={{ left: Math.max(8, Math.min(hover.x + 14, w - 250)), top: Math.max(8, hover.y > h - 150 ? hover.y - 86 : hover.y + 14) }}>
              <b>{data.name} · {hover.t.test}</b>
              <span>{WHAT[hover.p.state]} at {nf(hover.p.o2, 1)}% O₂ and {hover.p.flow_range && hover.p.flow_cm_s! < 2 ? 'near-still air (under 2 cm/s)' : `an airflow of ${nf(hover.p.flow_cm_s!, hover.p.flow_cm_s! < 10 ? 1 : 0)} cm/s`}</span>
              <span>{hover.t.material}{hover.t.geometry ? ` · flame: ${GEOMETRY[hover.t.geometry] ?? hover.t.geometry}` : ''} · tap to open</span>
            </div>
          )}
        </>
      )}
    </div>
  )
}
