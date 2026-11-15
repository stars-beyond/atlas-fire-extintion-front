// Vista "Mapa" do palco: todos os testes da NASA em 3D, o cenário, os habitats e o que falta testar.
import { useEffect, useRef, useState } from 'react'
import { gapLabel } from '../../components/Gaps'
import { FAMILY, OUTCOME, gLabel, pct, psi } from '../../lib/format'
import { useAtlas } from '../../state'
import { LEGENDS, createEngine, type ColorMode, type Engine, type MapView } from '../../three/map3d'
import type { Test } from '../../types'

export function MapStage({ view }: { view: MapView }) {
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
