// "Quem estudou isso": as investigações da NASA mais úteis para o cenário, uma por cartão.
// Cada cartão responde a três perguntas: quem é, quão perto chegou do cenário e por que entrou na lista.
// A nota vem da API em quatro partes; aqui elas viram quatro medidores, em vez de uma frase corrida.
import { FAMILY, ROLE } from '../../lib/format'
import { useAtlas } from '../../state'
import type { Ranked } from '../../types'

const PARTS: [keyof Ranked['parts'], string][] = [
  ['proximidade', 'Close to your scenario'], ['dados', 'Tabulated data'], ['relevancia', 'Relevance'], ['enunciado', 'Cited in the challenge'],
]
const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1)

export function Studies({ limit = 4 }: { limit?: number }) {
  const { ranking, rankingState, retryEvidence, selectInv, setView } = useAtlas()
  const list = ranking.slice(0, limit)
  // a lista em memória é a de outro cenário e a deste não veio: melhor o aviso do que a lista errada
  if (rankingState === 'failed') return <p className="hint bad">Could not rank the investigations for this scenario. <button className="link" onClick={retryEvidence}>Try again</button></p>
  if (!list.length) return <p className="hint">Finding the investigations…</p>
  const stale = rankingState === 'updating'
  return (
    <ol className={`studies${stale ? ' stale' : ''}`} aria-busy={stale}>
      {list.map((r, i) => {
        // a API manda os motivos numa frase só, separados por ponto e vírgula: o primeiro é a distância até o cenário
        const [near = '', ...why] = (r.reason ?? '').replace(/\.$/, '').split(';').map((t) => t.trim()).filter(Boolean)
        return (
          <li key={r.id}>
            <button className="study" onClick={() => { selectInv(r.id); setView('investigacoes') }} aria-label={`${r.name}: open the investigation`}>
              <span className="study-rank">{i + 1}</span>
              <span className="study-head">
                <b>{r.name}</b>
                <span className="study-tags"><span className="pill">{ROLE[r.role] ?? r.role}</span><span className="pill">{FAMILY[r.family] ?? r.family}</span></span>
              </span>
              {near && <span className={`study-near${r.parts.proximidade > 0.9 ? ' ok' : ''}`}>{cap(near)}</span>}
              {why.length > 0 && <ul className="study-why">{why.map((w) => <li key={w}>{cap(w)}</li>)}</ul>}
              <span className="study-meters">
                {PARTS.map(([k, label]) => (
                  <span key={k} title={`${label}: ${Math.round(r.parts[k] * 100)}%`}>
                    <i><i style={{ width: `${Math.round(r.parts[k] * 100)}%` }} /></i>{label}
                  </span>
                ))}
              </span>
            </button>
          </li>
        )
      })}
    </ol>
  )
}
