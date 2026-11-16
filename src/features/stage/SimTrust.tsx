// Quanto confiar na chama simulada: a medição do simulador contra a curva publicada pela NASA.
// O simulador mede o oxigênio mínimo que sustenta a chama em vários ventos (banco de testes do lab3d);
// a API compara com a curva do BASS-II e devolve a tabela pronta. Aqui ela só é mostrada.
import { useEffect, useState } from 'react'
import { api } from '../../api'
import { fmtDate, gLabel, nf } from '../../lib/format'
import { useLabConfig, type LabConfig } from '../../lib/simConfig'
import { safeHref } from '../../lib/url'
import type { SimSpreadCheck, SimValidation } from '../../types'

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

// De onde vieram os parâmetros que o simulador aberto no palco está usando: os que a API publica ou os embutidos nele.
const WHY_EMBEDDED: Record<NonNullable<LabConfig['reason']>, string> = {
  timeout: 'the API configuration did not arrive in time', unavailable: 'the API did not deliver its configuration', invalid: 'the API configuration was refused as invalid',
}
function configLine(c: LabConfig) {
  const n = c.problems.length
  if (c.from === 'embedded') return `The simulator on this stage is running with its built-in parameters, not the ones the Atlas API publishes${c.reason ? ` (${WHY_EMBEDDED[c.reason]})` : ''}.`
  const rejected = n > 0 ? ` ${n} ${n === 1 ? 'value was' : 'values were'} refused by the simulator's range checks and ${n === 1 ? 'keeps its' : 'keep their'} built-in default.` : ''
  return (c.from === 'api' ? 'The simulator on this stage is running with the parameters the Atlas API publishes.' : 'The simulator on this stage is running with parameters from a configuration file.') + rejected
}

export function SimTrustCard({ v, onClose }: { v: SimValidation; onClose: () => void }) {
  const stale = v.stale.length > 0
  const cfg = useLabConfig()
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
        <dd className="mono"><a href={safeHref(v.url)} target="_blank" rel="noreferrer">{v.source}</a> · {v.equation}</dd>
        {cfg && (<><dt>Simulator parameters</dt><dd title={cfg.problems.length ? cfg.problems.join('\n') : undefined}>{configLine(cfg)}</dd></>)}
      </dl>
      {v.spread?.available && <SpreadCheck s={v.spread} />}
    </aside>
  )
}

// A segunda conferência: quão rápido a chama do simulador anda numa placa, contra ensaios reais de propagação.
// Os ensaios são do ZARM (fora da NASA); a comparação chega pronta da API.
function SpreadCheck({ s }: { s: SimSpreadCheck }) {
  return (
    <>
      <header className="sim-sub"><b>How fast the simulated flame spreads</b></header>
      <p className={s.stale.length > 0 ? 'sim-stale' : ''}>{s.headline}</p>
      <div className="tbl-wrap">
        <table>
          <thead><tr><th>Air</th><th>Airflow</th><th>Simulator</th><th>Real test</th><th>Ratio</th></tr></thead>
          <tbody>
            {s.rows.map((r) => (
              <tr key={r.trial}>
                <td>{nf(r.o2_pct, 1)}% · {nf(r.pressure_psi, 1)} psi</td>
                <td>{nf(r.flow_cm_s, 0)} cm/s</td>
                <td>{r.sim_mm_s != null ? `${nf(r.sim_mm_s, 1)} mm/s` : 'did not spread'}</td>
                <td>{nf(r.measured_mm_s, 1)} mm/s</td>
                <td className={r.ratio != null && r.ratio > 0.8 && r.ratio < 1.25 ? 'good' : 'bad'}>{r.ratio != null ? `${nf(r.ratio, 1)}×` : '–'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <dl>
        <dt>What this does not show</dt>
        <dd><ul>{s.caveats.map((c) => <li key={c}>{c}</li>)}</ul></dd>
        <dt>How it was measured</dt>
        <dd>Acrylic slab {nf(s.sample.length_cm * 10, 0)} mm long and {nf(s.sample.thickness_cm * 10, 1)} mm thick, in weightlessness, lit at its downstream edge. {s.criterion.charAt(0).toUpperCase() + s.criterion.slice(1)}. Measured on {fmtDate(new Date(s.date + 'T12:00:00'))}.</dd>
        <dt>Where the real tests come from</dt>
        <dd className="mono">{s.measured.what} · {s.measured.source} · {s.measured.license}</dd>
      </dl>
    </>
  )
}
