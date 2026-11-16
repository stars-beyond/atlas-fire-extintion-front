// A casca do app: a home (hub de roteamento) ou, com cabeçalho, o test drive (palco + passo + barra) ou uma das páginas do acervo.
import { Suspense, lazy, useEffect, type ReactNode } from 'react'
import { Stage } from '../features/stage/Stage'
import { FichaStep } from '../features/configurator/FichaStep'
import { HabitatStep } from '../features/configurator/HabitatStep'
import { MaterialStep } from '../features/configurator/MaterialStep'
import { TestDriveStep } from '../features/configurator/TestDrive'
import { Perguntar } from '../features/ask/Perguntar'
import { Hub } from '../features/home/Hub'
import { useAtlas } from '../state'
import { Header } from './layout/Header'
import { SpecBar } from './layout/SpecBar'

// As páginas do acervo só são baixadas quando abrem: a home e o 3D Lab não carregam os gráficos (recharts) nem o
// código do dashboard. Um pedaço que não chega (rede, ou versão antiga do site aberta depois de um deploy) cai no
// ErrorBoundary do app, que oferece recarregar.
const Dashboard = lazy(() => import('../features/dashboard/Dashboard').then((m) => ({ default: m.Dashboard })))
const Story = lazy(() => import('../features/story/Story').then((m) => ({ default: m.Story })))
const Achados = lazy(() => import('../features/findings/Achados').then((m) => ({ default: m.Achados })))
const Expedicoes = lazy(() => import('../features/investigations/Expedicoes').then((m) => ({ default: m.Expedicoes })))
const ProximoFogo = lazy(() => import('../features/next-fire/ProximoFogo').then((m) => ({ default: m.ProximoFogo })))
// Sempre com key={view}: trocar de página troca a fronteira inteira, em vez de deixar a página anterior montada e
// escondida enquanto a nova é baixada. E a mesma key antes e depois de o acervo chegar mantém o dashboard montado.
const Page = ({ children }: { children: ReactNode }) => (
  <Suspense fallback={<main className="page"><div className="page-in"><p className="hint">Loading…</p></div></main>}>{children}</Suspense>
)

export function App() {
  const { loadError, meta, view, step } = useAtlas()
  // a cena 3D (three.js) é o maior download da home e do 3D Lab: começa junto com o pedido do acervo, sem esperar por ele
  useEffect(() => { if (view === 'home' || view === 'drive') import('../features/stage/HabitatStage').catch(() => {}) }, [view])
  // The dashboard has its own unavailable state, so it opens even when the archive cannot be read.
  if (view === 'dashboard' && !meta) return <div className="shell browsing"><Header /><Page key={view}><Dashboard /></Page></div>
  // the story runs on the Mission Fire Engine, so it does not wait for the Atlas archive either
  if (view === 'historia' && !meta) return <div className="shell browsing"><Header /><Page key={view}><Story /></Page></div>
  if (loadError && !meta) {
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
  if (view === 'home') return <div className="shell home"><Hub /></div>
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
      ) : view === 'perguntar' ? <main className="page"><div className="page-in ask-page"><Perguntar /></div></main> : (
        <Page key={view}>{view === 'dashboard' ? <Dashboard /> : view === 'historia' ? <Story /> : view === 'achados' ? <Achados /> : view === 'proximo' ? <ProximoFogo /> : <Expedicoes />}</Page>
      )}
    </div>
  )
}
