// "O que aconteceu nos testes reais": quantos ensaios da NASA, feitos nesta mesma condição, queimaram até o fim.
// É a resposta mais direta à pergunta "isso queima?", e por isso fica logo abaixo do selo de evidência.
// É uma contagem de ensaios com desfecho tabelado, não uma probabilidade calculada. Só existe quando há teste
// na condição (selo "Medido"); nos outros casos não aparece, e os contadores de testes explicam o porquê.
import { nf } from '../../lib/format'
import type { Verdict } from '../../types'

type E = NonNullable<Verdict['empirical']>
const PARTS: [keyof E, string, string][] = [
  ['burned', 'queimaram até o fim', 'var(--g1)'], ['extinguished', 'acenderam e apagaram sozinhos', 'var(--g0)'],
  ['disrupted', 'gota estourou', 'var(--gas)'], ['no_ignition', 'não acenderam', 'var(--fumaca)'],
]

export function EmpiricalRate({ verdict, compact }: { verdict: Verdict; compact?: boolean }) {
  const e = verdict.empirical
  if (!e) return null
  return (
    <section className="emp" aria-label="O que aconteceu nos testes reais desta condição">
      <span className="eyebrow">Nos testes reais desta condição</span>
      {e.known > 0 ? (
        <>
          <div className="emp-head">
            <b>{e.burned} de {e.known}</b>
            <span>{e.burned === 1 ? 'queimou até o fim' : 'queimaram até o fim'}</span>
          </div>
          <div className="emp-bar" role="img" aria-label={e.headline}>
            {PARTS.map(([k, label, color]) => (e[k] as number) > 0 && (<i key={k} style={{ flex: e[k] as number, background: color }} title={`${e[k]} ${label}`} />))}
          </div>
          <ul className="emp-legend">
            {PARTS.map(([k, label, color]) => (e[k] as number) > 0 && (<li key={k}><i style={{ background: color }} />{nf(e[k] as number)} {label}</li>))}
            {e.unknown > 0 && <li><i className="hatch" />{nf(e.unknown)} sem desfecho tabelado</li>}
          </ul>
        </>
      ) : <p className="lead">{e.headline}</p>}
      {!compact && e.by_investigation.length > 1 && (
        <ul className="emp-by">
          {e.by_investigation.map((b) => (
            <li key={b.id}><b>{b.name}</b><span>{b.known > 0 ? `${b.burned} de ${b.known} até o fim` : `${b.total} sem desfecho tabelado`}</span></li>
          ))}
        </ul>
      )}
      <p className="hint">Contagem de ensaios reais, não probabilidade: junta amostras, tamanhos e montagens diferentes.</p>
    </section>
  )
}
