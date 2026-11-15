// Passo 1 do configurador: escolher o ambiente (habitat), descrevê-lo em palavras ou ajustar o ar à mão.
import { useState } from 'react'
import { gLabel, nf, pct, psi } from '../../lib/format'
import { WIND_MAX, useAtlas } from '../../state'
import type { Habitat } from '../../types'

const ART: Record<string, JSX.Element> = {
  iss: (<><rect x="26" y="20" width="28" height="12" rx="6" /><path d="M8 14h14v24H8zM58 14h14v24H58zM22 26h4M54 26h4M15 14v24M65 14v24" /></>),
  lua: (<><path d="M14 40a26 20 0 0 1 52 0" /><path d="M4 40h72M34 40V30h12v10" /><circle cx="64" cy="12" r="5" /></>),
  rover: (<><rect x="16" y="18" width="46" height="16" rx="6" /><path d="M24 18v-6h18v6M50 22h8v6h-8z" /><circle cx="26" cy="40" r="6" /><circle cx="52" cy="40" r="6" /></>),
  marte: (<><path d="M18 40a22 18 0 0 1 44 0" /><path d="M4 40h72M10 40l8-10 6 6M56 34l8-8 10 14" /></>),
  traje: (<><rect x="26" y="8" width="28" height="24" rx="12" /><path d="M32 18h16v8H32zM28 32l-8 14M52 32l8 14M34 32v14M46 32v14" /></>),
  terra: (<><rect x="12" y="10" width="56" height="34" rx="3" /><path d="M22 18h10v18H22zM36 18h10v18H36zM50 18h8v18h-8zM25 23h4M39 23h4" /></>),
}

function Slider({ id, label, value, min, max, step, onChange, fmt }: { id: string; label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; fmt: (v: number) => string }) {
  return (
    <div className="slider">
      <div className="slider-top"><label htmlFor={id}>{label}</label><b>{fmt(value)}</b></div>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(+e.target.value)}
        style={{ ['--fill' as string]: `${((value - min) / (max - min)) * 100}%` }} />
    </div>
  )
}

function Describe() {
  const { describe } = useAtlas()
  const [text, setText] = useState('')
  const [state, setState] = useState<'idle' | 'busy' | 'none' | 'error'>('idle')
  const go = async () => {
    if (!text.trim()) return
    setState('busy')
    try { setState((await describe(text)) ? 'idle' : 'none') } catch { setState('error') }
  }
  return (
    <form className="describe" onSubmit={(e) => { e.preventDefault(); go() }}>
      <label htmlFor="desc">Or describe it in your own words</label>
      <div className="describe-row">
        <input id="desc" value={text} onChange={(e) => setText(e.target.value)} placeholder="E.g. lunar rover with 34% oxygen and Nomex seats" />
        <button className="cta" type="submit" disabled={!text.trim() || state === 'busy'}>{state === 'busy' ? 'Reading…' : 'Build'}</button>
      </div>
      {state === 'none' && <p className="hint">I could not find an environment or material in that sentence. Pick one of the cards above.</p>}
      {state === 'error' && <p className="hint bad">I could not read the sentence right now. Pick one of the cards above.</p>}
    </form>
  )
}

export function HabitatStep() {
  const { meta, scenario, setScenario, wind, setWind } = useAtlas()
  const [custom, setCustom] = useState(false)
  const pick = (h: Habitat) => setScenario({ o2: h.o2, pressure_atm: h.pressure_atm, gravity: h.gravity }, h.id)
  return (
    <div className="step">
      <header className="step-head">
        <span className="eyebrow">Step 1 of 4</span>
        <h1>Where will the crew live?</h1>
        <p>Each environment has its own air and gravity. That is what decides how fire behaves.</p>
      </header>
      <div className="options">
        {meta?.habitats.map((h) => (
          <button key={h.id} className="option" aria-pressed={scenario.habitat === h.id} onClick={() => pick(h)}>
            <svg viewBox="0 0 80 50" className="option-art" aria-hidden="true">{ART[h.id]}</svg>
            <span className="option-name">{h.name}</span>
            <span className="option-spec">{pct(h.o2)} O₂ · {psi(h.pressure_atm)} · {gLabel(h.gravity)}</span>
          </button>
        ))}
      </div>
      {meta?.habitats.find((h) => h.id === scenario.habitat) && <p className="hint">{meta.habitats.find((h) => h.id === scenario.habitat)!.note}</p>}
      <Describe />
      <button className="link" onClick={() => setCustom((c) => !c)} aria-expanded={custom}>{custom ? 'Close fine-tuning' : 'Set the air, gravity and airflow by hand'}</button>
      {custom && (
        <div className="sliders">
          <Slider id="o2" label="Oxygen" value={scenario.o2} min={0.1} max={1} step={0.005} fmt={(v) => pct(v, 1)} onChange={(v) => setScenario({ o2: v }, undefined, true)} />
          <Slider id="p" label="Pressure" value={scenario.pressure_atm} min={0.25} max={3} step={0.005} fmt={(v) => `${psi(v)} (${nf(v, 2)} atm)`} onChange={(v) => setScenario({ pressure_atm: v }, undefined, true)} />
          <Slider id="g" label="Gravity" value={scenario.gravity} min={0} max={1} step={0.005} fmt={(v) => gLabel(v)} onChange={(v) => setScenario({ gravity: v }, undefined, true)} />
          <Slider id="w" label="Ventilation airflow" value={wind} min={0} max={WIND_MAX} step={1} fmt={(v) => (v > 0 ? `${nf(v, 0)} cm/s` : 'off')} onChange={setWind} />
        </div>
      )}
    </div>
  )
}
