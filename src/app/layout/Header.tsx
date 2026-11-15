// Cabeçalho: a marca (que volta para a home), as etapas do 3D Lab e os atalhos para as páginas do acervo.
import { STEPS, useAtlas } from '../../state'

export function Header() {
  const { step, setStep, view, setView, ignited, goHome } = useAtlas()
  return (
    <header className="top">
      <div className="top-left">
        <button className="home-btn" onClick={goHome} aria-label="Back to home" title="Back to home">
          <svg viewBox="0 0 20 20" aria-hidden><path d="M12.5 4.5L7 10l5.5 5.5" /></svg>
          <span>Home</span>
        </button>
        <button className="brand" onClick={goHome} title="Atlas · Stars & Beyond (Home)">
          <img className="brand-logo" src="/logo-atlas-nav.png" alt="Atlas" />
          <span className="brand-text">
            <b>Extinction Atlas</b>
            <small>Stars &amp; Beyond</small>
          </span>
        </button>
      </div>
      {view === 'drive' && (
        <ol className="stepper" aria-label="3D Lab steps">
          {STEPS.map((s, i) => (
            <li key={s}>
              <button aria-current={step === i ? 'step' : undefined} className={i < step ? 'done' : ''} onClick={() => setStep(i)} disabled={i === 3 && !ignited}>
                <span className="n">{i + 1}</span><span className="l">{s}</span>
              </button>
            </li>
          ))}
        </ol>
      )}
      <nav className="more" aria-label="Explore the archive">
        <button aria-pressed={view === 'drive'} onClick={() => setView('drive')}>3D Lab</button>
        <button aria-pressed={view === 'achados'} onClick={() => setView('achados')}>Findings</button>
        <button aria-pressed={view === 'investigacoes'} onClick={() => setView('investigacoes')}>Investigations</button>
        <button aria-pressed={view === 'proximo'} onClick={() => setView('proximo')}>Next fire</button>
      </nav>
    </header>
  )
}
