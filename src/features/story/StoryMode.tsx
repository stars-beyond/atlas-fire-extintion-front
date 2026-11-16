// Modo história (portado do mission-fire-engine): a missão simulada pelo motor contada capítulo a capítulo, em tela
// cheia, com a cena 3D da rota. Cada capítulo pode perguntar ao RAG do Atlas o que a ciência diz sobre aquele
// momento e mostrar a chama prevista pelas redes da equipe (Atlas-MachineL) para o ar da cabine naquele instante.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../../api'
import { safeHref } from '../../lib/url'
import type { Answer, Scenario } from '../../types'
import { Markdown } from '../ask/Markdown'
import { buildChapters } from './chapters'
import { num, SEVERITY_LABEL } from './format'
import type { LabMaterial, SimResult } from './mfe'
import { createSpaceScene, type SpaceScene } from './scene'
import { StoryFlame } from './StoryFlame'

interface Props { result: SimResult; onExit: () => void }
type RagState = { loading: boolean; question: string; data?: Answer; error?: string }

const AUTO_MS = 9000
// material do componente vigiado no motor → material do acervo do Atlas usado como contexto da pergunta
const ATLAS_MATERIAL: Record<LabMaterial, string> = { pmma: 'pmma', algodao: 'sibal', retardante: 'nomex' }

export default function StoryMode({ result, onExit }: Props) {
  const stage = useRef<HTMLDivElement>(null)
  const scene = useRef<SpaceScene | null>(null)
  const chapters = useMemo(() => buildChapters(result), [result])
  const s = result.series, n = s.t_day.length
  const [k, setK] = useState(0)
  const [cursor, setCursor] = useState(chapters[0].index)
  const [traveling, setTraveling] = useState(true)
  const [auto, setAuto] = useState(false)
  const [answers, setAnswers] = useState<Record<string, RagState>>({})
  const [draft, setDraft] = useState('')
  const [webgl, setWebgl] = useState(true)
  const [flameFor, setFlameFor] = useState<string | null>(null)
  const [openCite, setOpenCite] = useState<number | null>(null)
  const cursorRef = useRef(cursor); cursorRef.current = cursor
  const ch = chapters[k]
  const answer = answers[ch.id]

  useEffect(() => {
    if (!stage.current) return
    const sc = createSpaceScene(stage.current, result, { onPickEvent: () => {}, onPickIndex: () => {}, onHover: () => {} },
      { viewOffset: { x: -0.17, y: 0.02 }, mobileViewOffset: { x: 0, y: 0.26 }, craftLabel: false })
    if (!sc) { setWebgl(false); setTraveling(false); return }
    scene.current = sc
    sc.setCursor(chapters[0].index)
    sc.intro()
    const t = window.setTimeout(() => setTraveling(false), 2600)
    return () => { window.clearTimeout(t); sc.dispose(); scene.current = null }
  }, [result, chapters])

  useEffect(() => { scene.current?.setCursor(cursor) }, [cursor])

  // viagem entre capítulos: o tempo corre da amostra atual até a do próximo momento, com a câmera acompanhando
  const travel = useRef(0)
  const go = useCallback((next: number) => {
    if (next < 0 || next >= chapters.length) return
    const id = ++travel.current
    const from = cursorRef.current, to = chapters[next].index
    const span = Math.abs(s.t_day[to] - s.t_day[from]) / (s.t_day[n - 1] || 1)
    const ms = Math.min(5200, 1300 + span * 6000)
    setK(next); setDraft(''); setOpenCite(null); setTraveling(true)
    scene.current?.setSelected(chapters[next].event?.id ?? null)
    if (!scene.current) { setCursor(to); setTraveling(false); return }
    // o voo dura a viagem toda e termina no enquadramento do destino (calculado a cada quadro)
    scene.current.setCameraMode(chapters[next].camera, true, Math.max(1.8, ms / 1000))
    const t0 = performance.now()
    const step = (now: number) => {
      if (id !== travel.current) return
      const p = Math.min(1, (now - t0) / ms), e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2
      setCursor(Math.round(from + (to - from) * e))
      if (p < 1) requestAnimationFrame(step)
      else { setTraveling(false); scene.current?.setCursor(to); scene.current?.setCameraMode(chapters[next].camera, true, 0.5) }
    }
    requestAnimationFrame(step)
  }, [chapters, s.t_day, n])

  // Autoplay: each chapter stays AUTO_MS on screen and then the story moves on by itself. It waits while the craft
  // is travelling and holds while an answer is open in the chapter (so nobody loses what they are reading), and it
  // ends at the last chapter. The button shows the time running, and the card says when autoplay is on hold.
  useEffect(() => {
    if (!auto || traveling || answer) return
    if (k >= chapters.length - 1) { setAuto(false); return }
    const t = window.setTimeout(() => go(k + 1), AUTO_MS)
    return () => window.clearTimeout(t)
  }, [auto, traveling, answer, k, chapters.length, go])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return
      if (e.key === 'Escape') onExit()
      else if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); go(k + 1) }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); go(k - 1) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go, k, onExit])

  // a tela de trás fica fora da rolagem enquanto a história está aberta
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  // pergunta ao RAG do Atlas com o ar da cabine naquele instante como cenário (o Atlas usa fração de O₂ e atm)
  async function ask(question: string) {
    const id = ch.id, i = ch.index
    setAuto(false); setOpenCite(null)
    setAnswers((a) => ({ ...a, [id]: { loading: true, question } }))
    const scenario: Scenario = {
      o2: s.oxygen_pct[i] / 100, pressure_atm: s.pressure_kpa[i] / 101.325, gravity: s.gravity_g[i],
      family: 'solido', material: ATLAS_MATERIAL[result.config.spacecraft.component.material] ?? 'pmma',
    }
    try {
      const data = await api.ask(question, scenario)
      setAnswers((a) => ({ ...a, [id]: { loading: false, question, data } }))
    } catch (e) {
      setAnswers((a) => ({ ...a, [id]: { loading: false, question, error: (e as Error).message || 'The Atlas could not answer.' } }))
    }
  }

  const progress = s.t_day[cursor] / (s.t_day[n - 1] || 1)
  const last = k >= chapters.length - 1
  // Play on the last chapter starts the story again from the first one, instead of switching itself off at once
  const togglePlay = () => { if (!auto && last) go(0); setAuto(!auto) }

  return (
    <div className="story" role="dialog" aria-modal="true" aria-label={`Mission story: ${result.label}`}>
      <div className="story-stage" ref={stage} aria-hidden="true" />
      {!webgl && <p className="story-nogl">This browser has no WebGL; the story continues without the 3D scene.</p>}
      <div className="story-vignette" aria-hidden="true" />

      <header className="story-top">
        <div className="story-brand">
          <span className="story-eyebrow">Extinction Atlas · Mission story</span>
          <span className="story-mission">{result.label}</span>
        </div>
        <div className="story-top-actions">
          <button type="button" className="story-ghost story-play" aria-pressed={auto} onClick={togglePlay}
            title={auto ? 'Pause the automatic walk through the chapters' : `Play the story: each chapter stays ${AUTO_MS / 1000} seconds on screen, then the next one opens${last ? ' (starts again from chapter 1)' : ''}`}>
            {auto ? '❚❚ Pause' : '▶ Play'}
            {auto && !traveling && !answer && <i key={k} className="story-auto" style={{ animationDuration: `${AUTO_MS}ms` }} aria-hidden="true" />}
          </button>
          <button type="button" className="story-ghost" onClick={onExit}>Exit ✕</button>
        </div>
      </header>

      <div className={`story-day mono${traveling ? ' moving' : ''}`} aria-live="off">
        Day {num(s.t_day[cursor], s.t_day[cursor] < 10 ? 1 : 0)}
        <small>{s.habitat[cursor]}</small>
      </div>

      <article key={ch.id} className={`story-card${traveling ? ' hidden' : ''}${ch.severity ? ` sev-${ch.severity}` : ''}`} aria-live="polite">
        <span className="story-kicker">{ch.kicker}{ch.severity && ch.severity !== 'info' ? ` · ${SEVERITY_LABEL[ch.severity]}` : ''}</span>
        <h2>{ch.title}</h2>
        <p className="story-body">{ch.body}</p>
        {ch.facts.length > 0 && (
          <dl className="story-facts">
            {ch.facts.map((f) => <div key={f.label}><dt>{f.label}</dt><dd className={`mono ${f.tone ?? ''}`}>{f.value}</dd></div>)}
          </dl>
        )}
        {ch.notes.length > 0 && <ul className="story-notes">{ch.notes.map((t) => <li key={t}>{t}</li>)}</ul>}
        {ch.tag && <span className="story-tag">{ch.tag}</span>}
        {ch.flame && (
          flameFor === ch.id
            ? <div className="story-flame">
                <StoryFlame o2={ch.flame.o2} p={ch.flame.p} flow={ch.flame.flow} />
                <p className="story-fine">Flame predicted by the team's trained model (Atlas-MachineL) on the reference thin PMMA sample, in this atmosphere, in microgravity. A model prediction, not a measurement.</p>
              </div>
            : <button type="button" className="story-flame-btn" onClick={() => setFlameFor(ch.id)}>◐ Show the flame predicted by the trained model</button>
        )}

        <section className="story-rag">
          {!answer && (
            <button type="button" className="story-ask" onClick={() => ask(ch.question)} title={ch.question}>
              <span>✦</span> What does science say about this moment?
            </button>
          )}
          {answer?.loading && <p className="story-thinking"><i /><i /><i /> Searching NASA reports and writing with citations…</p>}
          {answer?.error && <p className="story-error">{answer.error}</p>}
          {answer?.data && (
            <div className="story-answer">
              <p className="story-q">“{answer.question}”</p>
              <Markdown text={answer.data.answer} onCite={(c) => setOpenCite((o) => (o === c ? null : c))} />
              {answer.data.citations.length > 0 && (
                <ol className="story-sources">
                  {answer.data.citations.map((c) => (
                    <li key={c.n} value={c.n} className={openCite === c.n ? 'open' : ''}>
                      {safeHref(c.url) ? <a href={safeHref(c.url)} target="_blank" rel="noreferrer">{c.title}</a> : c.title}
                      {c.where && <span> · {c.where}</span>}
                      {openCite === c.n && c.text && <q>{c.text}</q>}
                    </li>
                  ))}
                </ol>
              )}
              {answer.data.warning && <p className="story-fine">{answer.data.warning}</p>}
            </div>
          )}
          {auto && answer && !answer.loading && !last && (
            <p className="story-fine story-hold">Autoplay is on hold while this answer is open. <button type="button" onClick={() => go(k + 1)}>Continue to the next chapter</button></p>
          )}
          {answer && !answer.loading && (
            <form className="story-followup" onSubmit={(e) => { e.preventDefault(); if (draft.trim()) ask(draft.trim()) }}>
              <input value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={400} placeholder="Ask something else about this moment…" aria-label="Question to the Atlas" />
              <button type="submit" className="story-go" disabled={!draft.trim()}>Ask</button>
            </form>
          )}
        </section>

        <nav className="story-nav">
          <button type="button" className="story-ghost" onClick={() => go(k - 1)} disabled={k === 0}>← Previous</button>
          <span className="mono story-count">{k + 1} / {chapters.length}</span>
          {k < chapters.length - 1
            ? <button type="button" className="story-go" onClick={() => go(k + 1)}>Next →</button>
            : <button type="button" className="story-go" onClick={onExit}>Finish</button>}
        </nav>
      </article>

      <footer className="story-progress">
        <div className="story-track">
          <span className="story-fill" style={{ width: `${progress * 100}%` }} />
          {chapters.map((c, j) => (
            <button key={c.id} type="button" className={`story-dot${j === k ? ' on' : ''}${j < k ? ' done' : ''}${c.severity ? ` sev-${c.severity}` : ''}`}
              style={{ left: `${(s.t_day[c.index] / (s.t_day[n - 1] || 1)) * 100}%` }} onClick={() => go(j)}
              aria-label={`${c.kicker}: ${c.title}`} title={`${c.title} · day ${num(s.t_day[c.index], 0)}`} />
          ))}
        </div>
        <span className="story-help">← → to navigate · Esc to exit · drag the scene to rotate</span>
      </footer>
    </div>
  )
}
