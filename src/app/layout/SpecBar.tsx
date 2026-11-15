// Barra de resumo embaixo do test drive: o cenário escolhido, o selo de evidência e o botão do próximo passo.
import { Seal } from '../../components/Seal'
import { gLabel, pct, psi } from '../../lib/format'
import { materialOf, useAtlas } from '../../state'

export function SpecBar() {
  const { scenario, meta, verdict, ignited, step, setStep, restart } = useAtlas()
  const hab = meta?.habitats.find((h) => h.id === scenario.habitat)
  const next = ['Choose the material', 'Go to the test drive', 'See the spec sheet', 'New test drive'][step]
  return (
    <footer className="bar">
      <div className="bar-specs">
        <div><span>Environment</span><b>{hab ? hab.name : 'Custom'}</b></div>
        <div><span>Air</span><b>{pct(scenario.o2)} O₂ · {psi(scenario.pressure_atm)}</b></div>
        <div><span>Gravity</span><b>{gLabel(scenario.gravity)}</b></div>
        <div><span>Material</span><b>{materialOf(scenario).name}</b></div>
      </div>
      <div className="bar-ev">
        {ignited && verdict ? <Seal tier={verdict.tier} sub="NASA evidence" /> : <span className="bar-wait"><b>Evidence</b>shows up in the test drive</span>}
      </div>
      <div className="bar-nav">
        {step > 0 && <button className="ghost" onClick={() => setStep(step - 1)}>Back</button>}
        <button className="cta" disabled={step === 2 && !ignited} onClick={() => (step === 3 ? restart() : setStep(step + 1))}>{next}</button>
      </div>
    </footer>
  )
}
