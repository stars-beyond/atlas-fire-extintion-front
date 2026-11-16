// "O que falta testar": os ensaios que mais tirariam os habitats de exploração do escuro, para o material escolhido.
// A lista vem da API (/next-tests) e mora no store, porque aparece em três lugares: na aba "Falta testar" do
// test drive, na ficha técnica e no mapa (onde cada ensaio é um marcador numerado no andar em que ele seria feito).
import { TIER, TIER_API_LABEL, gLabel, pct, psi } from '../lib/format'
import { materialOf, useAtlas } from '../state'
import type { NextTest, Tier } from '../types'

export const gapLabel = (n: NextTest) => `${pct(n.o2)} O₂ · ${psi(n.pressure_atm)} · ${gLabel(n.gravity)}`
const TIER_BY_LABEL = Object.fromEntries([['Terra incognita', 'sem_evidencia'], ...(Object.keys(TIER) as Tier[]).flatMap((t) => [[TIER_API_LABEL[t], t], [TIER[t].label, t]])]) as Record<string, Tier>
// "Rover pressurizado: Terra incógnita → Só um limite"
function Close({ text }: { text: string }) {
  const m = text.match(/^(.*?):\s*(.*?)\s*→\s*(.*)$/)
  if (!m) return <li>{text}</li>
  return (
    <li>
      <b>{m[1]}</b>
      <span className={`gap-tier t-${TIER_BY_LABEL[m[2]] ?? ''}`}>{m[2]}</span>
      <span aria-label="becomes">→</span>
      <span className={`gap-tier t-${TIER_BY_LABEL[m[3]] ?? ''}`}>{m[3]}</span>
    </li>
  )
}

export function GapCard({ n, i, onMap }: { n: NextTest; i: number; onMap?: () => void }) {
  const { selectedGap } = useAtlas()
  return (
    <article className={`gap${selectedGap === i ? ' on' : ''}`}>
      <span className="gap-rank">{i + 1}</span>
      <div className="gap-main">
        <b>{gapLabel(n)}</b>
        <span className="gap-where">{n.platform}</span>
        <ul className="gap-closes">{n.closes.map((c) => <Close key={c} text={c} />)}</ul>
        {onMap && <button className="link no-print" onClick={onMap}>Show on map</button>}
      </div>
    </article>
  )
}

export function Gaps({ limit }: { limit?: number }) {
  const { gaps, scenario, selectGap, setStageView, setView } = useAtlas()
  const mat = materialOf(scenario).noun
  if (!gaps.length) return <p className="hint">For {mat}, no single test would raise the evidence level of the exploration habitats.</p>
  return (
    <div className="gaps">
      <p>No NASA test has been run at lunar or Martian gravity. These are the {mat} tests that would close most of that gap, ordered from most to least helpful.</p>
      {gaps.slice(0, limit ?? gaps.length).map((n, i) => (<GapCard key={i} n={n} i={i} onMap={() => { selectGap(i); setStageView('mapa') }} />))}
      <button className="ghost no-print" onClick={() => setView('proximo')}>Open the full queue, with a spec sheet for each experiment</button>
      <p className="hint">Each test is ranked by how much it would improve the habitats' evidence seal. The list does not check whether current hardware can reach the condition.</p>
    </div>
  )
}
