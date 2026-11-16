// Vista "Mapa" do palco: todos os testes da NASA em 3D, o cenário, os habitats e o que falta testar.
import { useEffect, useMemo, useRef, useState } from 'react'
import { gapLabel } from '../../components/Gaps'
import { MinButton } from '../../components/MinButton'
import { FAMILY, OUTCOME, gLabel, nf, pct, psi } from '../../lib/format'
import { useMinimized } from '../../lib/usePanel'
import { useAtlas } from '../../state'
import { LEGENDS, createEngine, type ColorMode, type Engine, type MapView } from '../../three/map3d'
import type { Test } from '../../types'

export function MapStage({ view }: { view: MapView }) {
  const { tests, external, invs, scenario, verdict, meta, selectedTest, selectTest, setScenario, gaps, selectedGap, selectGap } = useAtlas()
  // os ensaios de fora da NASA entram no mapa com cor própria; o resto do Atlas continua a contar só `tests`
  const all = useMemo(() => (external ? [...tests, ...external.tests] : tests), [tests, external])
  const host = useRef<HTMLDivElement>(null), lab = useRef<HTMLDivElement>(null), eng = useRef<Engine | null>(null)
  const [tip, setTip] = useState<{ t: Test; x: number; y: number } | null>(null)
  const [mode, setMode] = useState<ColorMode>('familia')
  // the legend and the list of gaps float over the map: both can be minimized to leave the 3D view free
  const [legendMin, toggleLegend] = useMinimized('map-legend')
  const [gapsMin, toggleGaps] = useMinimized('map-gaps')
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
  useEffect(() => { eng.current?.setData(all) }, [all])
  useEffect(() => {
    eng.current?.setStyle({ mode, family: scenario.family, hidden: new Set(), focusInv: null, near: new Set([...(verdict?.nearest ?? []).slice(0, 6).map((n) => n.test.id), ...(verdict?.external?.nearest ?? []).map((n) => n.id)]) })
  }, [all, scenario.family, verdict, mode])
  useEffect(() => { eng.current?.setProbe(scenario, verdict) }, [scenario, verdict, all])
  useEffect(() => { eng.current?.setSelected(selectedTest) }, [selectedTest, all])
  useEffect(() => { if (meta) eng.current?.setHabitats(meta.habitats, scenario.habitat || '') }, [meta, scenario.habitat])
  useEffect(() => { eng.current?.setGaps(gaps, selectedGap) }, [gaps, selectedGap])
  useEffect(() => { eng.current?.view(view) }, [view])
  const gap = selectedGap != null ? gaps[selectedGap] : null
  const invName = (id: string) => (external && id === external.id ? `${external.name} (outside NASA)` : invs.find((i) => i.id === id)?.name ?? id)
  return (
    <>
      <div ref={host} className="map-host" />
      <div ref={lab} className="map-labels" />
      <div className={`map-legend${legendMin ? ' min' : ''}`}>
        <MinButton min={legendMin} onToggle={toggleLegend} what="the map legend" label="Legend" />
        {!legendMin && (
          <>
            <div className="map-mode" role="group" aria-label="What the dot color shows">
              <button aria-pressed={mode === 'familia'} onClick={() => setMode('familia')}>Type</button>
              <button aria-pressed={mode === 'desfecho'} onClick={() => setMode('desfecho')}>Outcome</button>
            </div>
            {LEGENDS[mode].map(([label, v]) => <span key={label}><i style={{ background: `var(${v})` }} />{label}</span>)}
            {external && mode !== 'desfecho' && <span title={external.not_nasa}><i style={{ background: 'var(--ext)' }} />Outside NASA (ZARM)</span>}
            <span><i style={{ background: 'var(--act)' }} />Your scenario</span>
            {gaps.length > 0 && <span><i className="ring" />Untested</span>}
          </>
        )}
      </div>
      {gaps.length > 0 && (
        <aside className={`map-gaps${gapsMin ? ' min' : ''}`} aria-label="What still needs testing">
          <div className="panel-head">
            <span className="cap">What still needs testing</span>
            <MinButton min={gapsMin} onToggle={toggleGaps} what="the list of untested conditions" />
          </div>
          {!gapsMin && gaps.map((g, i) => (
            <button key={i} aria-pressed={selectedGap === i} onClick={() => selectGap(selectedGap === i ? null : i)}>
              <span className="n">{i + 1}</span><span>{gapLabel(g)}</span>
            </button>
          ))}
          {!gapsMin && gap && (
            <div className="map-gap-why">
              <b>{gap.platform}</b>
              {gap.closes.map((c) => <span key={c}>{c}</span>)}
              <button className="link" onClick={() => setScenario({ o2: gap.o2, pressure_atm: gap.pressure_atm, gravity: gap.gravity }, '')}>Move my scenario there</button>
            </div>
          )}
        </aside>
      )}
      {tip && (
        <div className="map-tip" style={{ left: Math.min(tip.x + 14, (host.current?.clientWidth ?? 600) - 250), top: tip.y + 14 }}>
          <b>{invName(tip.t.inv)} · {tip.t.label}</b>
          <span>{FAMILY[tip.t.family] ?? tip.t.family} · {pct(tip.t.o2!)} O₂ · {psi(tip.t.p!)} · {gLabel(tip.t.g)}</span>
          <span>Outcome: {OUTCOME[tip.t.outcome] ?? tip.t.outcome}{tip.t.spread_mm_s != null ? ` · spread ${nf(tip.t.spread_mm_s, 1)} mm/s` : ''}</span>
          {tip.t.external && <span>Not a NASA test: drop tower, thin acrylic film.</span>}
        </div>
      )}
    </>
  )
}
