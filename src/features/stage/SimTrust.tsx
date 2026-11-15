// Quanto confiar na chama simulada: a medição do simulador contra a curva publicada pela NASA.
// O simulador mede o oxigênio mínimo que sustenta a chama em vários ventos (banco de testes do lab3d);
// a API compara com a curva do BASS-II e devolve a tabela pronta. Aqui ela só é mostrada.
import { useEffect, useState } from 'react'
import { api } from '../../api'
import { fmtDate, gLabel, nf } from '../../lib/format'
import type { SimValidation } from '../../types'

let cache: Promise<SimValidation> | null = null
export function useSimValidation() {
  const [v, setV] = useState<SimValidation | null>(null)
  useEffect(() => {
    cache ??= api.simValidation()
    cache.then(setV).catch(() => { cache = null })
  }, [])
  return v
}

const gName = (g: number) => (g <= 0.005 ? '0 g' : Math.abs(g - 0.165) < 0.01 ? 'Moon' : Math.abs(g - 0.378) < 0.01 ? 'Mars' : g >= 0.95 ? 'Earth' : gLabel(g))

export function SimTrustCard({ v, onClose }: { v: SimValidation; onClose: () => void }) {
  const stale = v.stale.length > 0
  return (
    <aside className="test-card limits-why sim-trust" aria-label="How far to trust the simulated flame">
      <header><b>How far to trust the simulated flame</b><button className="x" onClick={onClose} aria-label="Close">×</button></header>
      <p className={stale ? 'sim-stale' : ''}>{v.headline}</p>
      <div className="tbl-wrap">
        <table>
          <thead><tr><th>Gravity</th><th>Airflow</th><th>Simulator</th><th>NASA</th><th>Difference</th></tr></thead>
          <tbody>
            {v.rows.map((r) => (
              <tr key={`${r.gravity}-${r.wind_cm_s}`}>
                <td>{gName(r.gravity)}</td>
                <td>{nf(r.wind_cm_s, 0)} cm/s</td>
                <td>{nf(r.sim_o2, 1)}%</td>
                <td>{r.nasa_o2[1] - r.nasa_o2[0] < 0.05 ? `${nf(r.nasa_o2[0], 1)}%` : `${nf(r.nasa_o2[0], 1)}–${nf(r.nasa_o2[1], 1)}%`}</td>
                <td className={r.inside ? 'good' : 'bad'}>{r.diff_o2 != null ? `${r.diff_o2 >= 0.05 ? '+' : r.diff_o2 <= -0.05 ? '−' : ''}${nf(Math.abs(r.diff_o2), 1)}` : r.inside ? 'in band' : 'out of band'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <dl>
        <dt>How to read it</dt>
        <dd>Each row is the lowest oxygen level at which the acrylic flame still sustains itself, in the simulator and on the curve NASA published. {v.how}</dd>
        <dt>What the simulation does not guarantee</dt>
        <dd><ul>{v.caveats.map((c) => <li key={c}>{c}</li>)}</ul></dd>
        <dt>How it was measured</dt>
        <dd>Acrylic sphere, {nf(v.sample.radius_cm * 20, 0)} mm in diameter, at {nf(v.pressure_psi, 1)} psi. {v.criterion.charAt(0).toUpperCase() + v.criterion.slice(1)}. Measured on {fmtDate(new Date(v.date + 'T12:00:00'))}.</dd>
        <dt>Where the curve comes from</dt>
        <dd className="mono"><a href={v.url} target="_blank" rel="noreferrer">{v.source}</a> · {v.equation}</dd>
      </dl>
    </aside>
  )
}
