// "O que aconteceu nos testes reais": quantos ensaios da NASA, feitos nesta mesma condição, sustentaram a chama
// ("queimou" é a chama que se manteve na condição de partida; no BASS-II a maioria não consumiu a amostra).
// É a resposta mais direta à pergunta "isso queima?", e por isso fica logo abaixo do selo de evidência.
// É uma contagem de ensaios com desfecho tabelado, não uma probabilidade calculada. Só existe quando há teste
// na condição (selo "Medido"); nos outros casos não aparece, e os contadores de testes explicam o porquê.
import { nf } from '../../lib/format'
import type { Verdict } from '../../types'

type E = NonNullable<Verdict['empirical']>
const PARTS: [keyof E, string, string][] = [
  ['burned', 'sustained a flame', 'var(--g1)'], ['extinguished', 'ignited and went out on their own', 'var(--g0)'],
  ['disrupted', 'droplet burst', 'var(--gas)'], ['no_ignition', 'did not ignite', 'var(--fumaca)'],
]

export function EmpiricalRate({ verdict, compact }: { verdict: Verdict; compact?: boolean }) {
  const e = verdict.empirical
  if (!e) return null
  return (
    <section className="emp" aria-label="What happened in real tests at this condition">
      <span className="eyebrow">In real tests at this condition</span>
      {e.known > 0 ? (
        <>
          <div className="emp-head">
            <b>{e.burned} of {e.known}</b>
            <span>sustained a flame</span>
          </div>
          <div className="emp-bar" role="img" aria-label={e.headline}>
            {PARTS.map(([k, label, color]) => (e[k] as number) > 0 && (<i key={k} style={{ flex: e[k] as number, background: color }} title={`${e[k]} ${label}`} />))}
          </div>
          <ul className="emp-legend">
            {PARTS.map(([k, label, color]) => (e[k] as number) > 0 && (<li key={k}><i style={{ background: color }} />{nf(e[k] as number)} {label}</li>))}
            {e.unknown > 0 && <li><i className="hatch" />{nf(e.unknown)} with no tabulated outcome</li>}
          </ul>
        </>
      ) : <p className="lead">{e.headline}</p>}
      {!compact && e.by_investigation.length > 1 && (
        <ul className="emp-by">
          {e.by_investigation.map((b) => (
            <li key={b.id}><b>{b.name}</b><span>{b.known > 0 ? `${b.burned} of ${b.known} sustained a flame` : `${b.total} with no tabulated outcome`}</span></li>
          ))}
        </ul>
      )}
      <p className="hint">A count of real tests, not a probability: it pools different samples, sizes and setups.</p>
    </section>
  )
}
