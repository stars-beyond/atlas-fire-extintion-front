// Velocidade de propagação da chama no ar do cenário, pelo modelo neural da equipe (Atlas-MachineL).
// Só existe para o acrílico: o modelo foi treinado em filme fino de PMMA, em 0 g, nos ensaios do ZARM.
// A conta é da API (/api/predict/spread); aqui o número é mostrado com o que ele não garante.
import { useEffect, useState } from 'react'
import { api } from '../../api'
import { nf } from '../../lib/format'
import { useAtlas } from '../../state'
import type { Spread } from '../../types'

export function useSpread(): Spread | null {
  const { scenario, wind } = useAtlas()
  const [sp, setSp] = useState<Spread | null>(null)
  const applies = scenario.family === 'solido' && scenario.material === 'pmma'
  useEffect(() => {
    if (!applies) { setSp(null); return }
    let live = true
    const t = setTimeout(() => {
      api.spread(scenario, wind).then((r) => { if (live) setSp(r) }).catch(() => { if (live) setSp(null) })
    }, 120)
    return () => { live = false; clearTimeout(t) }
  }, [applies, scenario.o2, scenario.pressure_atm, scenario.gravity, wind])
  return applies ? sp : null
}

// As linhas da ficha técnica em Markdown.
export function spreadMarkdown(sp: Spread | null): string[] {
  if (!sp?.available) return []
  return ['', '## How fast it would spread (team model, not a NASA test)', `${sp.headline}. ${sp.compare}`, sp.detail,
    ...(sp.in_range ? [] : sp.out_of_range.map((o) => `- Outside the tested range: ${o}`)), ...sp.caveats.map((c) => `- ${c}`), sp.note]
}

export function SpreadSpeed() {
  return <SpreadCard sp={useSpread()} />
}

// `compact` (ficha técnica) deixa de fora o quadro "How far to trust this number".
export function SpreadCard({ sp, compact }: { sp: Spread | null; compact?: boolean }) {
  if (!sp || (!sp.available && sp.level !== 'fora')) return null
  const head = (
    <>
      <span className="eyebrow">Team model · not a NASA test</span>
      <h2>How fast it would spread</h2>
    </>
  )
  if (!sp.available) {
    return (
      <section className="spread">
        {head}
        <p className="hint"><span className="tag warn">No number</span> {sp.reason}</p>
      </section>
    )
  }
  const gravity = sp.gravity_ignored ? sp.caveats[0] : ''
  const rest = sp.gravity_ignored ? sp.caveats.slice(1) : sp.caveats
  return (
    <section className="spread">
      {head}
      <div className="result">
        <b>{nf(sp.v_mm_s, 1)} mm/s</b>
        <span>{sp.compare}</span>
      </div>
      <p className="hint">
        <span className={`tag${sp.in_range ? ' ok' : ' warn'}`}>{sp.in_range ? 'Within the tested range' : 'Outside the tested range'}</span>{' '}
        {sp.detail}{!sp.in_range && ' ' + sp.out_of_range.join(' ')}
      </p>
      {gravity && <p className="hint spread-g">{gravity}</p>}
      {!compact && (
        <details className="spread-more">
          <summary>How far to trust this number</summary>
          <p>{sp.note}</p>
          <ul>{rest.map((c) => <li key={c}>{c}</li>)}</ul>
          {sp.check && sp.check.length > 0 && (
            <div className="tbl-wrap">
              <table>
                <thead><tr><th>Oxygen</th><th>Pressure</th><th>Airflow</th><th>Measured</th><th>Model</th></tr></thead>
                <tbody>
                  {sp.check.map((r) => (
                    <tr key={r.trial}>
                      <td>{nf(r.o2_pct, 1)}%</td><td>{nf(r.pressure_kpa / 6.894757, 1)} psi</td><td>{nf(r.flow_cm_s, 0)} cm/s</td>
                      <td>{nf(r.measured_mm_s, 1)} mm/s</td><td>{nf(r.predicted_mm_s, 1)} mm/s</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {sp.model && (
            <p className="mono">
              Sample: {sp.model.sample} · data: ZARM drop tower, {sp.model.license}
              {sp.sources?.map((s) => <span key={s}><br />{s}</span>)}
            </p>
          )}
        </details>
      )}
    </section>
  )
}
