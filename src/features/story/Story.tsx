// Página do modo história: as missões de referência do Mission Fire Engine. Escolher uma abre a história em tela
// cheia. O motor roda na API do Atlas e calcula na hora; sem ele, as missões que o motor calculou e foram publicadas
// com o site (public/story/). A página diz qual das duas está em uso.
import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { loadMissions, type MissionList, type SimResult } from './mfe'

// three.js e a cena da rota só são baixados quando a história abre
const StoryMode = lazy(() => import('./StoryMode'))

// ordem de apresentação: as jornadas mais completas primeiro; o resto segue a ordem do motor
const FIRST = ['demo-lunar', 'demo-marte']
// an unreadable date becomes '' instead of throwing (toISOString raises RangeError on an invalid date)
const day = (iso: string) => { const d = new Date(iso); return iso && !Number.isNaN(d.getTime()) ? d.toISOString().slice(0, 10) : '' }

export function Story() {
  const [list, setList] = useState<MissionList | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [running, setRunning] = useState<string | null>(null)
  const [result, setResult] = useState<SimResult | null>(null)

  const boot = useCallback(() => {
    setError(null)
    loadMissions().then(setList).catch((e) => setError(e.message))
  }, [])
  useEffect(boot, [boot])

  const open = useCallback(async (id: string) => {
    if (!list) return
    setRunning(id); setError(null)
    try {
      setResult(await list.open(id))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setRunning(null)
    }
  }, [list])

  const missions = list ? [...list.missions].sort((a, b) => (FIRST.indexOf(a.id) + 1 || 99) - (FIRST.indexOf(b.id) + 1 || 99)) : []
  const live = list?.source.kind === 'live'

  return (
    <main className="page story-page">
      <div className="page-in">
        <header className="story-head">
          <span className="eyebrow">Mission story</span>
          <h1>Follow a mission, chapter by chapter</h1>
          <p className="dim">
            Pick a reference mission. The Mission Fire Engine simulates the trip hour by hour (trajectory, cabin atmosphere,
            thermal margins and declared failures), and the story walks through its key moments in 3D. At each one you can ask
            the Atlas what NASA's experiments say, and see the flame the team's trained model predicts for that cabin air.
          </p>
        </header>

        {error && (
          <div className="story-down" role="alert">
            <b>The story could not open</b>
            <p>{error}</p>
            <button type="button" className="story-retry" onClick={list ? () => setError(null) : boot}>Try again</button>
          </div>
        )}

        {!list && !error && <p className="hint">Loading the missions…</p>}

        {list && (
          <div className="story-missions">
            {missions.map((m) => (
              <button key={m.id} type="button" className="story-mission-card" onClick={() => open(m.id)} disabled={running !== null} aria-busy={running === m.id}>
                <span className="story-mission-name">{m.name}</span>
                <span className="story-mission-desc">{m.description}</span>
                <span className="story-mission-go">{running === m.id ? (live ? 'Simulating the mission…' : 'Loading the mission…') : 'Start the story →'}</span>
              </button>
            ))}
          </div>
        )}

        <p className="hint story-disclaimer">
          {list?.source.kind === 'snapshot' && <>Missions computed by the Mission Fire Engine (commit <span className="mono">{list.source.commit}</span> of {day(list.source.commitDate)}) on {day(list.source.generatedAt)} and published with this site. </>}
          {list?.source.kind === 'live' && <>Missions simulated now by the Mission Fire Engine on the Atlas API. </>}
          The engine is an experimental research aid, not flight safety software: thermal margins, evidence levels and model
          predictions are not fire probabilities. Mission and event texts are written by the engine and shown here in English.
        </p>
      </div>

      {result && (
        <Suspense fallback={<div className="story story-loading">Preparing the story…</div>}>
          <StoryMode key={result.simulation_id} result={result} onExit={() => setResult(null)} />
        </Suspense>
      )}
    </main>
  )
}
