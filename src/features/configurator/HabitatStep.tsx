// Passo 1 do configurador: escolher o ambiente (habitat), descrevê-lo em palavras ou ajustar o ar à mão.
import { useState } from 'react'
import { gLabel, pct, psi } from '../../lib/format'
import { useAtlas } from '../../state'
import type { Habitat } from '../../types'
import { FlameConditions } from './Conditions'

const ART: Record<string, JSX.Element> = {
  iss: (<><rect x="26" y="20" width="28" height="12" rx="6" /><path d="M8 14h14v24H8zM58 14h14v24H58zM22 26h4M54 26h4M15 14v24M65 14v24" /></>),
  lua: (<><path d="M14 40a26 20 0 0 1 52 0" /><path d="M4 40h72M34 40V30h12v10" /><circle cx="64" cy="12" r="5" /></>),
  rover: (<><rect x="16" y="18" width="46" height="16" rx="6" /><path d="M24 18v-6h18v6M50 22h8v6h-8z" /><circle cx="26" cy="40" r="6" /><circle cx="52" cy="40" r="6" /></>),
  marte: (<><path d="M18 40a22 18 0 0 1 44 0" /><path d="M4 40h72M10 40l8-10 6 6M56 34l8-8 10 14" /></>),
  traje: (<><rect x="26" y="8" width="28" height="24" rx="12" /><path d="M32 18h16v8H32zM28 32l-8 14M52 32l8 14M34 32v14M46 32v14" /></>),
  terra: (<><rect x="12" y="10" width="56" height="34" rx="3" /><path d="M22 18h10v18H22zM36 18h10v18H36zM50 18h8v18h-8zM25 23h4M39 23h4" /></>),
}

function Describe() {
  const { describe, askFromHub, scenario, meta } = useAtlas()
  const chosen = meta?.habitats.find((h) => h.id === scenario.habitat)
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
      {state === 'none' && (
        <>
          <p className="hint">I could not find an environment or material in that sentence, so {chosen ? <>your choice (<b>{chosen.name}</b>) stays as it is</> : 'nothing changed'}. If it is a question, ask it in the test drive.</p>
          <button className="cta" type="button" onClick={() => askFromHub(text)}>Ask this in the test drive</button>
        </>
      )}
      {state === 'error' && <p className="hint bad">The Atlas did not answer just now, so {chosen ? <>your choice (<b>{chosen.name}</b>) stays as it is</> : 'nothing changed'}. Try again in a moment.</p>}
    </form>
  )
}

export function HabitatStep() {
  const { meta, scenario, setScenario } = useAtlas()
  const chosen = meta?.habitats.find((h) => h.id === scenario.habitat)
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
      {chosen && <p className="hint">{chosen.note}</p>}
      <FlameConditions defaultOpen />
      <Describe />
    </div>
  )
}
