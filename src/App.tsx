import { gLabel, pct, psi } from './api'
import { Seal } from './components/Seal'
import { Stage } from './components/Stage'
import { Achados } from './pages/Achados'
import { Expedicoes } from './pages/Expedicoes'
import { ProximoFogo } from './pages/ProximoFogo'
import { HabitatStep, MaterialStep } from './steps/Configure'
import { FichaStep } from './steps/Ficha'
import { TestDriveStep } from './steps/TestDrive'
import { STEPS, materialOf, useAtlas } from './store'

function Header() {
  const { step, setStep, view, setView, ignited } = useAtlas()
  return (
    <header className="top">
      <button className="brand" onClick={() => setView('drive')}><span className="brand-mark" />Atlas de Extinção</button>
      {view === 'drive' ? (
        <ol className="stepper" aria-label="Etapas do test drive">
          {STEPS.map((s, i) => (
            <li key={s}>
              <button aria-current={step === i ? 'step' : undefined} className={i < step ? 'done' : ''} onClick={() => setStep(i)} disabled={i === 3 && !ignited}>
                <span className="n">{i + 1}</span><span className="l">{s}</span>
              </button>
            </li>
          ))}
        </ol>
      ) : <button className="ghost" onClick={() => setView('drive')}>← Voltar ao test drive</button>}
      <nav className="more" aria-label="Explorar o acervo">
        <button aria-pressed={view === 'achados'} onClick={() => setView('achados')}>Achados</button>
        <button aria-pressed={view === 'investigacoes'} onClick={() => setView('investigacoes')}>Investigações</button>
        <button aria-pressed={view === 'proximo'} onClick={() => setView('proximo')}>Próximo fogo</button>
      </nav>
    </header>
  )
}

function SpecBar() {
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

export function App() {
  const { loadError, meta, view, step } = useAtlas()
  if (loadError) {
    return (
      <div className="boot">
        <h1>O Atlas não conseguiu abrir o acervo</h1>
        <p>{loadError}</p>
        <p>Confira se os serviços estão no ar com <span className="mono">docker compose ps</span>. Na primeira subida, a carga dos dados leva alguns minutos.</p>
        <button className="cta" onClick={() => location.reload()}>Tentar de novo</button>
      </div>
    )
  }
  if (!meta) return <div className="boot"><p>Abrindo o acervo da NASA…</p></div>
  return (
    <div className={`shell${view === 'drive' ? '' : ' browsing'}`}>
      <Header />
      {view === 'drive' ? (
        <>
          <main className="drive">
            <Stage />
            <div className="panel" key={step}>
              {step === 0 && <HabitatStep />}{step === 1 && <MaterialStep />}{step === 2 && <TestDriveStep />}{step === 3 && <FichaStep />}
            </div>
          </main>
          <SpecBar />
        </>
      ) : view === 'achados' ? <Achados /> : view === 'proximo' ? <ProximoFogo /> : <Expedicoes />}
    </div>
  )
}
