// A casca do app: cabeçalho, e o test drive (palco + passo + barra) ou uma das páginas do acervo.
import { Stage } from '../features/stage/Stage'
import { FichaStep } from '../features/configurator/FichaStep'
import { HabitatStep } from '../features/configurator/HabitatStep'
import { MaterialStep } from '../features/configurator/MaterialStep'
import { TestDriveStep } from '../features/configurator/TestDrive'
import { Achados } from '../features/findings/Achados'
import { Expedicoes } from '../features/investigations/Expedicoes'
import { ProximoFogo } from '../features/next-fire/ProximoFogo'
import { useAtlas } from '../state'
import { Header } from './layout/Header'
import { SpecBar } from './layout/SpecBar'

export function App() {
  const { loadError, meta, view, step } = useAtlas()
  if (loadError) {
    return (
      <div className="boot">
        <h1>The Atlas could not open the archive</h1>
        <p>{loadError}</p>
        <p>Check that the services are up with <span className="mono">docker compose ps</span>. On first start, loading the data takes a few minutes.</p>
        <button className="cta" onClick={() => location.reload()}>Try again</button>
      </div>
    )
  }
  if (!meta) return <div className="boot"><p>Opening the NASA archive…</p></div>
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
