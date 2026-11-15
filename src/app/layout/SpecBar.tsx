// Barra de resumo embaixo do test drive: o cenário escolhido, o selo de evidência e o botão do próximo passo.
import { Seal } from '../../components/Seal'
import { gLabel, pct, psi } from '../../lib/format'
import { materialOf, useAtlas } from '../../state'

export function SpecBar() {
  const { scenario, meta, verdict, ignited, step, setStep, restart } = useAtlas()
  const hab = meta?.habitats.find((h) => h.id === scenario.habitat)
  const next = ['Escolher o material', 'Ir para o test drive', 'Ver a ficha técnica', 'Novo test drive'][step]
  return (
    <footer className="bar">
      <div className="bar-specs">
        <div><span>Ambiente</span><b>{hab ? hab.name : 'Personalizado'}</b></div>
        <div><span>Ar</span><b>{pct(scenario.o2)} O₂ · {psi(scenario.pressure_atm)}</b></div>
        <div><span>Gravidade</span><b>{gLabel(scenario.gravity)}</b></div>
        <div><span>Material</span><b>{materialOf(scenario).name}</b></div>
      </div>
      <div className="bar-ev">
        {ignited && verdict ? <Seal tier={verdict.tier} sub="evidência da NASA" /> : <span className="bar-wait"><b>Evidência</b>aparece no test drive</span>}
      </div>
      <div className="bar-nav">
        {step > 0 && <button className="ghost" onClick={() => setStep(step - 1)}>Voltar</button>}
        <button className="cta" disabled={step === 2 && !ignited} onClick={() => (step === 3 ? restart() : setStep(step + 1))}>{next}</button>
      </div>
    </footer>
  )
}
