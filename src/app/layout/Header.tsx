// Cabeçalho: a marca, as etapas do test drive e os atalhos para as páginas do acervo.
import { STEPS, useAtlas } from '../../state'

export function Header() {
  const { step, setStep, view, setView, ignited } = useAtlas()
  return (
    <header className="top">
      <button className="brand" onClick={() => setView('drive')}><span className="brand-mark" />Extinction Atlas</button>
      {view === 'drive' ? (
        <ol className="stepper" aria-label="Test drive steps">
          {STEPS.map((s, i) => (
            <li key={s}>
              <button aria-current={step === i ? 'step' : undefined} className={i < step ? 'done' : ''} onClick={() => setStep(i)} disabled={i === 3 && !ignited}>
                <span className="n">{i + 1}</span><span className="l">{s}</span>
              </button>
            </li>
          ))}
        </ol>
      ) : <button className="ghost" onClick={() => setView('drive')}>← Back to the test drive</button>}
      <nav className="more" aria-label="Explore the archive">
        <button aria-pressed={view === 'achados'} onClick={() => setView('achados')}>Findings</button>
        <button aria-pressed={view === 'investigacoes'} onClick={() => setView('investigacoes')}>Investigations</button>
        <button aria-pressed={view === 'proximo'} onClick={() => setView('proximo')}>Next fire</button>
      </nav>
    </header>
  )
}
