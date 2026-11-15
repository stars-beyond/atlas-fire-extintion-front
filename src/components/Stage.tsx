// O palco: a chama no ambiente escolhido, ou o mapa 3D de todos os testes da NASA.
// A chama é uma ilustração. A forma segue a física conhecida (sem empuxo ela é uma esfera azul;
// com gravidade sobe em gota e amarela). O veredito vem dos testes, nunca do desenho.
import { useEffect, useRef, useState } from 'react'
import { API_BASE, FAMILY, OUTCOME, api, gLabel, nf, pct, psi, type Test, type TestDetail } from '../api'
import { LAB_MAT, materialOf, setLab, useAtlas, useLab, type MaterialOption } from '../store'
import { GraphStage } from './GraphStage'
import { HabitatStage } from './HabitatStage'
import { labCam, type LabCam } from '../scene/labCam'
import { SimTrustCard, useSimValidation } from './SimTrust'
import { LimitsStage } from './LimitsStage'
import { gapLabel } from './Gaps'
import { LEGENDS, createEngine, type ColorMode, type Engine, type MapView } from './map3d'

interface FlameProps { gravity: number; o2: number; strength: number; lit: boolean; mat: MaterialOption }

function FlameCanvas(props: FlameProps) {
  const ref = useRef<HTMLCanvasElement>(null)
  const p = useRef(props); p.current = props
  useEffect(() => {
    const c = ref.current!, g = c.getContext('2d')!
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
    let raf = 0, t = 0, energy = 0, flash = 0, wasLit = false
    const cur = { gravity: p.current.gravity, o2: p.current.o2, strength: p.current.strength }
    const parts: { x: number; y: number; vx: number; vy: number; life: number }[] = []
    const draw = () => {
      raf = requestAnimationFrame(draw)
      const dpr = Math.min(2, devicePixelRatio)
      const w = (c.width = Math.max(1, c.clientWidth * dpr)), h = (c.height = Math.max(1, c.clientHeight * dpr))
      const q = p.current
      for (const k of ['gravity', 'o2', 'strength'] as const) cur[k] += (q[k] - cur[k]) * (reduce ? 1 : 0.1)
      if (q.lit && !wasLit) flash = 1
      wasLit = q.lit
      energy += ((q.lit ? 1 : 0) - energy) * (reduce ? 1 : 0.07)
      flash *= 0.9
      t += reduce ? 0 : 0.016
      const G = cur.gravity, S = Math.min(w, h)
      const cx = w / 2, floor = h * 0.8
      g.clearRect(0, 0, w, h)

      // chão do estúdio
      const fl = g.createRadialGradient(cx, floor, 0, cx, floor, S * 0.75)
      fl.addColorStop(0, 'rgba(120,150,200,0.16)'); fl.addColorStop(1, 'rgba(120,150,200,0)')
      g.save(); g.translate(cx, floor); g.scale(1, 0.22); g.translate(-cx, -floor)
      g.fillStyle = fl; g.beginPath(); g.arc(cx, floor, S * 0.75, 0, 7); g.fill(); g.restore()

      // a amostra: o que pode pegar fogo
      const kind = q.mat.kind
      let ax = cx, ay = floor - S * 0.3
      g.fillStyle = q.mat.tint; g.strokeStyle = q.mat.tint; g.lineWidth = Math.max(1, S * 0.004)
      if (kind === 'tecido') {
        const sw = S * 0.11, sh = S * 0.3
        g.globalAlpha = 0.85; g.fillRect(cx - sw / 2, floor - sh, sw, sh); g.globalAlpha = 0.25; g.strokeStyle = '#0b1017'
        for (let y = floor - sh; y < floor; y += S * 0.018) { g.beginPath(); g.moveTo(cx - sw / 2, y); g.lineTo(cx + sw / 2, y); g.stroke() }
        g.globalAlpha = 1; ay = floor - sh
      } else if (kind === 'barra') {
        const sw = S * 0.045, sh = S * 0.3
        g.globalAlpha = 0.75; g.beginPath(); g.roundRect(cx - sw / 2, floor - sh, sw, sh, sw / 2); g.fill(); g.globalAlpha = 1; ay = floor - sh
      } else if (kind === 'gota') {
        ay = floor - S * 0.36
        g.globalAlpha = 0.5; g.beginPath(); g.moveTo(cx - S * 0.22, ay); g.lineTo(cx + S * 0.22, ay); g.stroke()   // a fibra que segura a gota
        g.globalAlpha = 0.9; g.beginPath(); g.arc(cx, ay, S * 0.022, 0, 7); g.fill(); g.globalAlpha = 1
      } else {
        const sw = S * 0.035, sh = S * 0.22
        g.globalAlpha = 0.8; g.fillRect(cx - sw / 2, floor - sh, sw, sh); g.globalAlpha = 1; ay = floor - sh
      }

      const power = Math.max(0.3, Math.min(1.5, (cur.o2 - 0.06) / 0.3)) * cur.strength * energy
      if (power > 0.02) {
        const R = S * 0.12 * (0.65 + 0.45 * power) * (1 - 0.25 * G)
        const cy0 = kind === 'gota' ? ay : ay - R * (0.35 - 0.2 * G)
        g.globalCompositeOperation = 'lighter'
        const n = 18
        for (let i = 0; i < n; i++) {
          const f = i / (n - 1)
          const flick = G * (Math.sin(t * 9 + i * 1.7) * 0.5 + Math.sin(t * 5.3 + i) * 0.5)
          const y = cy0 - f * S * 0.4 * G * (0.6 + 0.5 * power)
          const x = ax + flick * R * 0.25 * f
          const r = R * (1 - 0.72 * f * Math.min(1, G * 1.5)) * (1 + 0.035 * Math.sin(t * 3 + i))
          const warm = Math.min(1, G * 1.4) * (0.3 + 0.7 * f)
          const col = [Math.round(70 + 185 * warm), Math.round(150 + 65 * warm), Math.round(255 - 195 * warm)]
          const a = (0.16 + 0.2 * Math.min(1, power)) * (1 - 0.45 * f)
          const gr = g.createRadialGradient(x, y, 0, x, y, r)
          gr.addColorStop(0, `rgba(${col[0]},${col[1]},${col[2]},${a})`)
          gr.addColorStop(0.55, `rgba(${col[0]},${col[1]},${col[2]},${a * 0.45})`)
          gr.addColorStop(1, 'rgba(0,0,0,0)')
          g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill()
        }
        // casca azul: a zona de reação, nítida em 0 g
        g.strokeStyle = `rgba(160,210,255,${0.55 * (1 - Math.min(1, G * 1.6)) * Math.min(1, power)})`; g.lineWidth = Math.max(1.5, S * 0.006)
        g.beginPath(); g.arc(ax, cy0, R * 0.9, 0, 7); g.stroke()
        // reflexo no chão
        const warmAll = Math.min(1, G * 1.4)
        const rf = g.createRadialGradient(cx, floor, 0, cx, floor, S * 0.5)
        rf.addColorStop(0, `rgba(${Math.round(90 + 165 * warmAll)},${Math.round(160 + 30 * warmAll)},${Math.round(255 - 170 * warmAll)},${0.2 * Math.min(1, power)})`)
        rf.addColorStop(1, 'rgba(0,0,0,0)')
        g.save(); g.translate(cx, floor); g.scale(1, 0.18); g.translate(-cx, -floor); g.fillStyle = rf; g.beginPath(); g.arc(cx, floor, S * 0.5, 0, 7); g.fill(); g.restore()
        // fagulhas: sobem com a gravidade, flutuam sem ela
        if (!reduce && Math.random() < 0.35 * Math.min(1, power)) {
          const ang = Math.random() * Math.PI * 2
          parts.push({ x: ax + Math.cos(ang) * R * 0.5, y: cy0 + Math.sin(ang) * R * 0.5, vx: Math.cos(ang) * S * 0.0008 * (1 - G) + (Math.random() - 0.5) * S * 0.0006, vy: Math.sin(ang) * S * 0.0008 * (1 - G) - G * S * 0.004, life: 1 })
        }
        for (let i = parts.length - 1; i >= 0; i--) {
          const s = parts[i]; s.x += s.vx; s.y += s.vy; s.life -= 0.012
          if (s.life <= 0) { parts.splice(i, 1); continue }
          g.fillStyle = `rgba(${Math.round(150 + 105 * warmAll)},${Math.round(200 - 20 * warmAll)},${Math.round(255 - 170 * warmAll)},${0.5 * s.life})`
          g.beginPath(); g.arc(s.x, s.y, S * 0.004, 0, 7); g.fill()
        }
        if (flash > 0.02) {
          const ff = g.createRadialGradient(ax, cy0, 0, ax, cy0, S * 0.45)
          ff.addColorStop(0, `rgba(255,255,255,${0.7 * flash})`); ff.addColorStop(1, 'rgba(255,255,255,0)')
          g.fillStyle = ff; g.beginPath(); g.arc(ax, cy0, S * 0.45, 0, 7); g.fill()
        }
        g.globalCompositeOperation = 'source-over'
      } else parts.length = 0
    }
    draw()
    return () => cancelAnimationFrame(raf)
  }, [])
  return <canvas ref={ref} className="flame-canvas" role="img" aria-label="Ilustração da chama neste ambiente" />
}

// A chama simulada: o Laboratório de chama 3D da equipe (lab3d) rodando num iframe, como uma camada por cima
// da cena 3D do habitat. O Atlas manda o cenário e a câmera da cena; o simulador pinta a chama dentro da bancada
// de ensaio do habitat, no mesmo ponto de vista, e devolve se ela está acesa e quanto calor libera.
function LabStage({ mat }: { mat: number }) {
  const { scenario, ignited, step, agent, conc, wind, igniteSeq, setLabOff } = useAtlas()
  const ref = useRef<HTMLIFrameElement>(null)
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const h = (e: MessageEvent) => {
      if (e.source !== ref.current?.contentWindow || e.origin !== location.origin) return
      const d = e.data
      if (d?.type === 'atlas:lab') { if (d.status === 'ready') setReady(true); else setLabOff(d.message || 'O simulador 3D não abriu neste navegador.') }
      else if (d?.type === 'atlas:metrics') setLab(d)
    }
    window.addEventListener('message', h)
    return () => { window.removeEventListener('message', h); setLab(null) }
  }, [setLabOff])
  // a câmera da cena chega a cada quadro; a página do simulador tem a mesma origem, então é uma chamada direta
  useEffect(() => {
    if (!ready) return
    const send = (c: LabCam) => { (ref.current?.contentWindow as (Window & { atlasCam?: (c: LabCam) => void }) | null | undefined)?.atlasCam?.(c) }
    labCam.send = send
    if (labCam.last) send(labCam.last)
    return () => { if (labCam.send === send) labCam.send = null }
  }, [ready])
  const lit = ignited && step >= 2
  useEffect(() => {
    if (!ready) return
    ref.current?.contentWindow?.postMessage({
      type: 'atlas:set', o2: scenario.o2 * 100, press: scenario.pressure_atm * 14.696, g: scenario.gravity, mat,
      material: materialOf(scenario).material,   // o simulador acha o material pelo id; o índice (mat) fica de reserva
      lit, agent, frac: conc, vent: wind > 0, wind, seq: igniteSeq,
    }, location.origin)
  }, [ready, scenario.o2, scenario.pressure_atm, scenario.gravity, mat, lit, agent, conc, wind, igniteSeq])
  return (
    <>
      <iframe ref={ref} className="lab-frame embed" src={`/lab3d/stage.html?embed=1&api=${encodeURIComponent(API_BASE)}`} title="Chama simulada em 3D" tabIndex={-1} />
      {!ready && <p className="lab-wait low">Preparando o simulador…</p>}
    </>
  )
}

function LabHud() {
  const lab = useLab()
  if (!lab || !lab.lit) return null
  const label = lab.igniting ? 'Acendendo' : lab.burning ? 'Queimando' : lab.measured ? 'Sem chama' : 'Medindo'
  return (
    <div className={`lab-hud${lab.burning ? ' on' : ''}`} role="status">
      <b>{label}</b>
      {lab.burning && <span>≈ {nf(lab.hrr, 0)} W de calor</span>}
      {lab.agent > 0.005 && <span>{pct(lab.agent)} de {lab.agentKey === 'He' ? 'hélio' : 'CO₂'} no ar</span>}
    </div>
  )
}

// Como ler o mapa em cada ponto de vista. O prédio em 3D mostra o vazio da Lua e de Marte; as vistas chapadas
// servem para ler valores sem a perspectiva atrapalhar.
const MAP_VIEWS: [MapView, string, string][] = [
  ['persp', '3D', 'Cada ponto é um teste da NASA. Para os lados, o oxigênio; para o fundo, a pressão; cada andar é uma gravidade.'],
  ['frente', 'De frente', 'Oxigênio na horizontal, gravidade na vertical. Os andares da Lua e de Marte estão vazios: ninguém testou lá.'],
  ['topo', 'De cima', 'Oxigênio na horizontal, pressão na vertical, com todas as gravidades sobrepostas.'],
]

function MapStage({ view }: { view: MapView }) {
  const { tests, invs, scenario, verdict, meta, selectedTest, selectTest, setScenario, gaps, selectedGap, selectGap } = useAtlas()
  const host = useRef<HTMLDivElement>(null), lab = useRef<HTMLDivElement>(null), eng = useRef<Engine | null>(null)
  const [tip, setTip] = useState<{ t: Test; x: number; y: number } | null>(null)
  const [mode, setMode] = useState<ColorMode>('familia')
  const fn = useRef({ selectTest, setScenario, selectGap }); fn.current = { selectTest, setScenario, selectGap }
  useEffect(() => {
    const e = createEngine(host.current!, lab.current!, {
      hover: (t, x, y) => setTip(t ? { t, x, y } : null),
      pick: (id) => fn.current.selectTest(id),
      habitat: (h) => fn.current.setScenario({ o2: h.o2, pressure_atm: h.pressure_atm, gravity: h.gravity }, h.id),
      place: (p) => fn.current.setScenario(p, ''),
      gap: (i) => fn.current.selectGap(i),
    })
    eng.current = e
    return () => { e.dispose(); eng.current = null }
  }, [])
  useEffect(() => { eng.current?.setData(tests) }, [tests])
  useEffect(() => {
    eng.current?.setStyle({ mode, family: scenario.family, hidden: new Set(), focusInv: null, near: new Set((verdict?.nearest ?? []).slice(0, 6).map((n) => n.test.id)) })
  }, [tests, scenario.family, verdict, mode])
  useEffect(() => { eng.current?.setProbe(scenario, verdict) }, [scenario, verdict, tests])
  useEffect(() => { eng.current?.setSelected(selectedTest) }, [selectedTest, tests])
  useEffect(() => { if (meta) eng.current?.setHabitats(meta.habitats, scenario.habitat || '') }, [meta, scenario.habitat])
  useEffect(() => { eng.current?.setGaps(gaps, selectedGap) }, [gaps, selectedGap])
  useEffect(() => { eng.current?.view(view) }, [view])
  const gap = selectedGap != null ? gaps[selectedGap] : null
  const invName = (id: string) => invs.find((i) => i.id === id)?.name ?? id
  return (
    <>
      <div ref={host} className="map-host" />
      <div ref={lab} className="map-labels" />
      <div className="map-legend">
        <div className="map-mode" role="group" aria-label="O que a cor dos pontos mostra">
          <button aria-pressed={mode === 'familia'} onClick={() => setMode('familia')}>Tipo</button>
          <button aria-pressed={mode === 'desfecho'} onClick={() => setMode('desfecho')}>Resultado</button>
        </div>
        {LEGENDS[mode].map(([label, v]) => <span key={label}><i style={{ background: `var(${v})` }} />{label}</span>)}
        <span><i style={{ background: 'var(--act)' }} />Seu cenário</span>
        {gaps.length > 0 && <span><i className="ring" />Falta testar</span>}
      </div>
      {gaps.length > 0 && (
        <aside className="map-gaps" aria-label="O que falta testar">
          <span className="cap">O que falta testar</span>
          {gaps.map((g, i) => (
            <button key={i} aria-pressed={selectedGap === i} onClick={() => selectGap(selectedGap === i ? null : i)}>
              <span className="n">{i + 1}</span><span>{gapLabel(g)}</span>
            </button>
          ))}
          {gap && (
            <div className="map-gap-why">
              <b>{gap.platform}</b>
              {gap.closes.map((c) => <span key={c}>{c}</span>)}
              <button className="link" onClick={() => setScenario({ o2: gap.o2, pressure_atm: gap.pressure_atm, gravity: gap.gravity }, '')}>Levar meu cenário até lá</button>
            </div>
          )}
        </aside>
      )}
      {tip && (
        <div className="map-tip" style={{ left: Math.min(tip.x + 14, (host.current?.clientWidth ?? 600) - 250), top: tip.y + 14 }}>
          <b>{invName(tip.t.inv)} · {tip.t.label}</b>
          <span>{FAMILY[tip.t.family]} · {pct(tip.t.o2!)} O₂ · {psi(tip.t.p!)} · {gLabel(tip.t.g)}</span>
          <span>Resultado: {OUTCOME[tip.t.outcome]}</span>
        </div>
      )}
    </>
  )
}

function TestCard() {
  const { selectedTest, selectTest } = useAtlas()
  const [d, setD] = useState<TestDetail | null>(null)
  useEffect(() => { setD(null); if (selectedTest) api.test(selectedTest).then(setD).catch(() => {}) }, [selectedTest])
  if (!selectedTest || !d) return null
  const t = d.test
  const mx = d.metrics || {}
  const fromReport = !!mx.outcome_source && !!mx.end
  const result = fromReport && t.outcome_raw
    ? t.outcome_raw.charAt(0).toUpperCase() + t.outcome_raw.slice(1) + (mx.limit_flow_cm_s != null ? `, com vento de ${mx.limit_flow_cm_s < 2 && mx.end === 'quench' ? 'menos de 2' : nf(mx.limit_flow_cm_s, mx.limit_flow_cm_s < 10 ? 1 : 0)} cm/s` : '')
    : `${OUTCOME[t.outcome]}${t.outcome_raw ? ` (${t.outcome_raw})` : ''}`
  return (
    <aside className="test-card" aria-label="Teste selecionado">
      <header><b>{d.investigation} · {t.label}</b><button className="x" onClick={() => selectTest(null)} aria-label="Fechar">×</button></header>
      <dl>
        <dt>O que queimou</dt><dd>{t.fuel || FAMILY[t.family]}</dd>
        <dt>Atmosfera</dt><dd>{t.o2 != null ? pct(t.o2, 1) : '–'} de O₂ · {t.pressure_atm != null ? psi(t.pressure_atm) : 'pressão não tabelada'} · {gLabel(t.gravity)}</dd>
        <dt>Resultado</dt><dd>{result}</dd>
        {fromReport && mx.comments && (<><dt>O que o relatório da NASA diz</dt><dd className="quote" lang="en">“{mx.comments}”</dd></>)}
        <dt>De onde vem</dt><dd className="mono">{fromReport ? `${mx.outcome_source} · ` : ''}{d.source}</dd>
      </dl>
    </aside>
  )
}

export function Stage() {
  const { scenario, ignited, prediction, stageView, setStageView, meta, step, agent, labOff } = useAtlas()
  const mat = materialOf(scenario)
  const hab = meta?.habitats.find((h) => h.id === scenario.habitat)
  const labMat = LAB_MAT[mat.material]
  const useLab3d = labMat !== undefined && !labOff
  // a medição do simulador contra a curva da NASA: só existe para o material que tem curva publicada
  const val = useSimValidation()
  const [trust, setTrust] = useState(false)
  const compared = !!val?.available && LAB_MAT[val.sample.material] === labMat && val.stale.length === 0
  // O palco da chama é a cena 3D do habitat, do começo ao fim. No passo do habitat ela aparece de longe; depois,
  // a câmera desce até a câmara de teste, onde a chama do simulador é pintada. "far" é a pessoa pedindo o plano geral.
  const [far, setFar] = useState(false)
  const [credits, setCredits] = useState<string[]>([])
  const [mapView, setMapView] = useState<MapView>('persp')
  useEffect(() => { setFar(false) }, [step])
  const inScene = stageView === 'chama' && step === 0
  const near = step >= 1 && !far
  // de onde vem a chama da câmara: ilustração no passo do habitat; simulador quando ele conhece o material;
  // senão, ilustração só depois de acender
  const flame = step === 0 ? 'sketch' : useLab3d ? 'sim' : ignited && step >= 2 ? 'sketch' : 'off'
  const strength = agent !== 'nenhum' && prediction && prediction.baseline_k_mm2_s > 0 ? Math.max(0.12, Math.min(1.4, Math.pow(prediction.k_mm2_s / prediction.baseline_k_mm2_s, 3))) : 1
  return (
    <section className={`stage v-${stageView}`} aria-label="Palco">
      {stageView === 'limites' ? <LimitsStage /> : stageView === 'grafo' ? <GraphStage /> : stageView === 'mapa' ? <MapStage view={mapView} />
        : (
          <>
            <HabitatStage near={near} flame={flame} onCredits={setCredits} />
            {step >= 1 && useLab3d && <LabStage mat={labMat} />}
          </>
        )}
      <div className="stage-top">
        {stageView === 'chama' ? (
          <div className="stage-title">
            <span className="eyebrow">{inScene ? 'Onde o ensaio acontece' : hab ? hab.name : 'Ambiente personalizado'}</span>
            <span className="stage-mat">{inScene ? (hab ? hab.name : 'Ambiente personalizado') : mat.name}</span>
            {step >= 1 && <button className="scene-back" onClick={() => setFar((f) => !f)}>{far ? 'Entrar no habitat' : 'Ver o lugar de longe'}</button>}
            {(inScene || far) && credits.length > 0 && <span className="scene-credit">Modelos: {credits.join('; ')}.</span>}
          </div>
        ) : stageView === 'mapa' ? (
          <div className="stage-explain">
            <span className="eyebrow">Mapa · o que a NASA já queimou</span>
            <p>{MAP_VIEWS.find((v) => v[0] === mapView)![2]}</p>
            <div className="map-mode" role="group" aria-label="Ponto de vista do mapa">
              {MAP_VIEWS.map(([id, l]) => <button key={id} aria-pressed={mapView === id} onClick={() => setMapView(id)}>{l}</button>)}
            </div>
          </div>
        ) : stageView === 'grafo' ? (
          <div className="stage-explain">
            <span className="eyebrow">Grafo · os parentes do seu cenário</span>
            <p>Seu cenário fica no centro, ligado aos testes mais parecidos com ele; por fora, o que esses testes têm em comum. Toque numa bola para seguir a ligação.</p>
          </div>
        ) : (
          <div className="stage-explain">
            <span className="eyebrow">Limites · queima ou apaga?</span>
            <p>À direita da curva a chama se sustenta; à esquerda, apaga. Arraste o ponto amarelo para testar outro ar.</p>
          </div>
        )}
        <div className="toggle" role="group" aria-label="O que mostrar no palco">
          <button aria-pressed={stageView === 'chama'} onClick={() => setStageView('chama')}>Chama</button>
          <button aria-pressed={stageView === 'limites'} onClick={() => setStageView('limites')}>Limites</button>
          <button aria-pressed={stageView === 'mapa'} onClick={() => setStageView('mapa')}>Mapa</button>
          <button aria-pressed={stageView === 'grafo'} onClick={() => setStageView('grafo')}>Grafo</button>
        </div>
      </div>
      {stageView === 'chama' && (
        <>
          {useLab3d && !inScene && <LabHud />}
          <div className="stage-foot">
          <div className="gauges compact" aria-label="Atmosfera do ambiente">
            <div><b>{pct(scenario.o2, scenario.o2 * 100 % 1 ? 1 : 0)}</b><span>oxigênio</span></div>
            <div><b>{nf(scenario.pressure_atm * 14.696, 1)}</b><span>psi de pressão</span></div>
            <div><b>{scenario.gravity <= 0.005 ? '0' : nf(scenario.gravity, 2)} g</b><span>gravidade</span></div>
          </div>
          <p className="stage-hint">
            <span className="hint-long">{inScene
              ? 'O ponto de luz marca a bancada de ensaio dentro do habitat. Clique em outro habitat da cena para ir até ele; arraste para girar. O lugar é ilustrativo.'
              : useLab3d
              ? compared
                ? `A chama é do simulador (o lugar é ilustrativo). Sem gravidade, o oxigênio mínimo dela fica a ${nf(val!.rms_o2, 1)} ponto da curva da NASA; os tempos não são fiéis. O veredito vem dos testes da NASA.`
                : `A chama é do simulador (o lugar é ilustrativo)${mat.material === 'nomex' ? ', com parâmetros hipotéticos para o Nomex' : ''}, sem comparação com dados da NASA para este material. O veredito vem dos testes da NASA.`
              : labOff ? 'Ilustração: o simulador 3D não abriu neste navegador. A chama desenhada só segue a gravidade.'
              : 'Ilustração: o simulador 3D ainda não tem este material. A chama desenhada só segue a gravidade.'}</span>
            <span className="hint-short">
              {inScene ? 'O ponto de luz marca onde o ensaio acontece.'
                : useLab3d ? (compared ? 'Chama do simulador; lugar ilustrativo. O veredito vem dos testes da NASA.' : 'Chama do simulador, sem comparação com a NASA neste material.')
                : 'Ilustração: a chama desenhada só segue a gravidade.'}
            </span>
            {useLab3d && !inScene && val?.available && <>{' '}<button className="link" onClick={() => setTrust((t) => !t)} aria-expanded={trust}>Quanto confiar</button></>}
          </p>
          </div>
          {trust && val?.available && <SimTrustCard v={val} onClose={() => setTrust(false)} />}
        </>
      )}
      <TestCard />
    </section>
  )
}
