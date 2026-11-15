// "O que falta testar": os ensaios que mais tirariam os habitats de exploração do escuro, para o material escolhido.
// A lista vem da API (/next-tests) e mora no store, porque aparece em três lugares: na aba "Falta testar" do
// test drive, na ficha técnica e no mapa (onde cada ensaio é um marcador numerado no andar em que ele seria feito).
import { TIER, gLabel, pct, psi, type NextTest, type Tier } from '../api'
import { materialOf, useAtlas } from '../store'

export const gapLabel = (n: NextTest) => `${pct(n.o2)} de O₂ · ${psi(n.pressure_atm)} · ${gLabel(n.gravity)}`
const TIER_BY_LABEL = Object.fromEntries((Object.keys(TIER) as Tier[]).map((t) => [TIER[t].label, t])) as Record<string, Tier>
// "Rover pressurizado: Terra incógnita → Só um limite"
function Close({ text }: { text: string }) {
  const m = text.match(/^(.*?):\s*(.*?)\s*→\s*(.*)$/)
  if (!m) return <li>{text}</li>
  return (
    <li>
      <b>{m[1]}</b>
      <span className={`gap-tier t-${TIER_BY_LABEL[m[2]] ?? ''}`}>{m[2]}</span>
      <span aria-label="passa a ser">→</span>
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
        {onMap && <button className="link no-print" onClick={onMap}>Ver no mapa</button>}
      </div>
    </article>
  )
}

export function Gaps({ limit }: { limit?: number }) {
  const { gaps, scenario, selectGap, setStageView, setView } = useAtlas()
  const mat = materialOf(scenario).name.toLowerCase()
  if (!gaps.length) return <p className="hint">Para {mat}, nenhum ensaio isolado melhora o nível de evidência dos habitats de exploração.</p>
  return (
    <div className="gaps">
      <p>Nenhum teste da NASA foi feito na gravidade da Lua ou de Marte. Estes são os ensaios com {mat} que mais reduzem esse vazio, do que mais ajuda para o que menos ajuda.</p>
      {gaps.slice(0, limit ?? gaps.length).map((n, i) => (<GapCard key={i} n={n} i={i} onMap={() => { selectGap(i); setStageView('mapa') }} />))}
      <button className="ghost no-print" onClick={() => setView('proximo')}>Abrir a fila completa, com a ficha de cada experimento</button>
      <p className="hint">Cada ensaio entra na lista pelo quanto melhora o selo de evidência dos habitats. A lista não confere se o equipamento atual alcança a condição.</p>
    </div>
  )
}
