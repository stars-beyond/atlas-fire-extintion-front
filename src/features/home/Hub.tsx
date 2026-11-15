// Home / hub de roteamento: a cena orbital no topo, o título ATLAS, a busca e os cartões que levam a cada funcionalidade.
// O 3D Lab reúne todo o palco interativo (4 passos + vistas de Chama, Limites, Mapa e Grafo), enquanto os outros cartões
// levam às páginas do acervo. A busca filtra os cartões ou, se for uma frase de cenário, atualiza o cenário global.
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { api } from '../../api'
import { materialOf, STEPS, useAtlas } from '../../state'
import { Stage } from '../stage/Stage'

interface Card {
  id: string; title: string; icon: ReactNode; badge: string; color: string; desc: string
  steps?: string[]; current?: number
  keys: string[]; go: () => void
}

const norm = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
// frase de cenário (números, gases, lugares): vai para /api/scenario/infer em vez de só filtrar os cartões
const SCENARIO_HINT = /\d|%|\bo2\b|oxyg|oxig|pressur|press[aã]o|atm|psi|moon|lua|lunar|mars|marte|rover|iss|orbit|nomex|pmma|acryl|cotton|silicon|heptan|methan|metan|propan|ethylen|gravity|gravidade|habitat|suit|traje/i

// ícones geométricos de traço fino, todos no mesmo grid de 20 px
const I = {
  lab: <svg viewBox="0 0 20 20"><path d="M10 2.5l6.5 3.75v7.5L10 17.5l-6.5-3.75v-7.5z" /><path d="M10 10l6.5-3.75M10 10v7.5M10 10L3.5 6.25" /></svg>,
  findings: <svg viewBox="0 0 20 20"><path d="M3 17h14" /><rect x="4" y="10" width="2.6" height="5" /><rect x="8.7" y="6" width="2.6" height="9" /><rect x="13.4" y="3" width="2.6" height="12" /></svg>,
  invs: <svg viewBox="0 0 20 20"><circle cx="8.5" cy="8.5" r="5.5" /><path d="M12.6 12.6L17 17M6 8.5h5M8.5 6v5" /></svg>,
  next: <svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="7" strokeDasharray="2.2 2.2" /><path d="M10 6.5c1.8 1.6 2.4 3 2.4 4.2a2.4 2.4 0 01-4.8 0c0-1 .5-1.8 1.2-2.6" /></svg>,
  ask: <svg viewBox="0 0 20 20"><path d="M3.5 4.5h13v9h-7l-4 3v-3h-2z" /><path d="M7 8h6M7 10.5h4" /></svg>,
}

export function Hub() {
  const { scenario, meta, invs, step, described, setView, setStageView, inferScenario, askFromHub } = useAtlas()
  const mat = materialOf(scenario)
  const hab = meta?.habitats.find((h) => h.id === scenario.habitat)
  const [nDatasets, setNDatasets] = useState<number | null>(null)
  useEffect(() => { let live = true; api.datasets().then((r) => { if (live) setNDatasets(r.datasets.length) }).catch(() => {}); return () => { live = false } }, [])

  // um cartão por funcionalidade principal: o 3D Lab (4 passos + vistas Flame/Limits/Map/Graph) e as 3 páginas do acervo
  const cards: Card[] = [
    {
      id: 'lab', title: '3D Lab', icon: I.lab, badge: '4 steps', color: 'var(--g0)',
      desc: 'Choose habitat and material, run the test drive (flame, limits, 3D test map, evidence graph & RAG) and get the spec sheet.',
      steps: STEPS as unknown as string[], current: step,
      keys: ['3d', 'lab', 'laboratorio', 'laboratory', 'configurator', 'configurador', 'habitat', 'material', 'test drive', 'spec sheet', 'ficha', 'simulator', 'simulador', 'flame', 'chama', 'map', 'mapa', 'graph', 'grafo', 'limits', 'limites', 'ask', 'perguntar', 'rag'],
      go: () => { setStageView('chama'); setView('drive') },
    },
    {
      id: 'findings', title: 'Findings & Charts', icon: I.findings, badge: nDatasets !== null ? `${nDatasets} datasets` : 'Datasets', color: 'var(--parcial)',
      desc: 'Build custom cross-plots from NASA PSI experiment tables, read ready-made findings and inspect the data audit.',
      keys: ['findings', 'achados', 'charts', 'graficos', 'chart', 'datasets', 'audit', 'auditoria'],
      go: () => setView('achados'),
    },
    {
      id: 'invs', title: 'Investigations', icon: I.invs, badge: invs.length ? `${invs.length} studies` : 'PSI', color: 'var(--g1)',
      desc: 'Explore and compare NASA microgravity combustion experiments ranked by how much they matter to your scenario.',
      keys: ['investigations', 'investigacoes', 'expeditions', 'expedicoes', 'experiments', 'experimentos', 'psi', 'ranking', 'studies', 'compare'],
      go: () => setView('investigacoes'),
    },
    {
      id: 'next', title: 'Next Fire', icon: I.next, badge: 'Uncharted', color: 'var(--incognita)',
      desc: 'Priority queue of future experiments that most shorten the distance to lunar and Martian habitats.',
      keys: ['next', 'proximo', 'fogo', 'fire', 'gaps', 'lacunas', 'uncharted', 'incognita', 'queue'],
      go: () => setView('proximo'),
    },
  ]

  // ---- busca: nome de módulo filtra os cartões; frase de cenário atualiza o cenário; pergunta/Enter abre o Ask no 3D Lab
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<{ kind: 'idle' | 'busy' | 'ok' | 'miss'; text?: string }>({ kind: 'idle' })
  const nq = norm(q)
  const isQuestion = q.includes('?') || /^(what|why|how|when|where|which|who|can|does|do|is|are|will|would|could|should|por que|como|qual|quais|quando|onde|o que)\b/i.test(nq)
  const matches = nq && !isQuestion ? cards.filter((c) => norm(c.title).includes(nq) || c.keys.some((k) => k.includes(nq) || (nq.length >= 3 && nq.split(/\s+/).includes(k)))) : isQuestion ? [] : cards
  const isScenario = nq.length > 0 && !isQuestion && SCENARIO_HINT.test(q) && (matches.length === 0 || nq.split(/\s+/).length >= 3)
  const shown = isScenario || matches.length === 0 ? cards : matches
  const lastSent = useRef('')
  const run = async (text: string, andAsk = false) => {
    const trimmed = text.trim()
    if (!trimmed) return
    if (!andAsk && trimmed === lastSent.current) return
    lastSent.current = trimmed
    setStatus({ kind: 'busy' })
    try {
      const u = await inferScenario(trimmed)
      if (lastSent.current !== trimmed) return
      if (u) {
        setStatus({ kind: 'ok' })
      } else if (andAsk) {
        askFromHub(trimmed)
      } else {
        setStatus({ kind: 'miss', text: 'Press Enter to ask the Atlas in the 3D Lab →' })
      }
    } catch (e) {
      if (lastSent.current === trimmed) setStatus({ kind: 'miss', text: (e as Error).message || 'The Atlas API did not answer.' })
    }
  }
  useEffect(() => {
    if (!isScenario) { if (!nq) setStatus({ kind: 'idle' }); return }
    const t = setTimeout(() => run(q, false), 900)
    return () => clearTimeout(t)
  }, [q, isScenario]) // eslint-disable-line react-hooks/exhaustive-deps
  const submit = () => {
    if (!nq) return
    if (isQuestion) { askFromHub(q); return }
    if (matches.length === 1 && !isScenario) { matches[0].go(); return }
    if (isScenario) { lastSent.current = ''; run(q, true); return }
    askFromHub(q)
  }

  // a roda do mouse sobre a cena rola a página em vez de dar zoom (a captura no herói chega antes do OrbitControls)
  const hero = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = hero.current
    if (!el) return
    const h = (e: WheelEvent) => e.stopPropagation()
    el.addEventListener('wheel', h, { capture: true })
    return () => el.removeEventListener('wheel', h, { capture: true })
  }, [])

  return (
    <div className="hub">
      <div className="hub-hero" ref={hero}>
        <Stage hub onExplore={cards[0].go} />
        <div className="hub-brand">
          <img className="hub-logo" src="/logo-mark.png" alt="" aria-hidden />
          <h1 className="hub-title">ATLAS</h1>
          <span className="hub-sub">Stars &amp; Beyond · Extinction Atlas</span>
        </div>
      </div>
      <div className="hub-body">
        <form className="hub-search" role="search" onSubmit={(e) => { e.preventDefault(); submit() }}>
          <svg viewBox="0 0 20 20" aria-hidden><circle cx="8.5" cy="8.5" r="5.5" /><path d="M13 13l4.5 4.5" /></svg>
          <input value={q} onChange={(e) => setQ(e.target.value)} aria-label="Describe an environment, ask a question or search a module"
            placeholder="Describe an environment (e.g. 34% O2 on the Moon), ask a question or search a module..." />
          {q && <button type="button" className="hub-clear" aria-label="Clear" onClick={() => { setQ(''); lastSent.current = '' }}>×</button>}
          {nq && (matches.length === 0 || isQuestion) && (
            <button type="submit" className="hub-ask-btn" onClick={(e) => { e.preventDefault(); askFromHub(q) }}>Ask in 3D Lab →</button>
          )}
        </form>
        <div className="hub-status" aria-live="polite">
          {status.kind === 'busy' && <span className="mono">Reading your environment…</span>}
          {status.kind === 'miss' && <button type="button" className="link mono" onClick={() => askFromHub(q)}>{status.text}</button>}
          {status.kind === 'ok' && described.length > 0 && (
            <><span className="eyebrow">Scenario updated</span>{described.map((d) => <span key={d} className="pill">{d}</span>)}</>
          )}
          {status.kind === 'idle' && nq && !isScenario && matches.length === 0 && (
            <button type="button" className="link mono" onClick={() => askFromHub(q)}>Press Enter to ask "{q.trim()}" in the 3D Lab →</button>
          )}
          {status.kind === 'idle' && !nq && <span className="mono">{hab ? hab.name : 'Custom environment'} · {mat.name}</span>}
        </div>
        <nav className="hub-grid" aria-label="Atlas modules">
          {shown.map((c) => (
            <button key={c.id} className="hub-card" style={{ ['--c' as string]: c.color }} onClick={c.go}>
              <span className="hub-card-top">
                <span className="hub-icon" aria-hidden>{c.icon}</span>
                <span className="hub-card-title">{c.title}</span>
                <span className="hub-badge">{c.badge}</span>
              </span>
              <span className="hub-desc">{c.desc}</span>
              {c.steps && (
                <span className="hub-steps" aria-label="Steps">
                  {c.steps.map((st, i) => <span key={st} className={i === c.current ? 'on' : ''}><b>{i + 1}</b>{st}</span>)}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>
    </div>
  )
}
