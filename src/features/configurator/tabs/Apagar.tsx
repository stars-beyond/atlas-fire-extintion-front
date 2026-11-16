// Aba "Apagar" do test drive: soltar um agente, mudar o vento e ver a chama responder no palco.
import { useEffect, useState } from 'react'
import { api } from '../../../api'
import { nf, pct } from '../../../lib/format'
import { LAB_MAT, WIND_MAX, materialOf, useAtlas, useLab, type Agent } from '../../../state'
import type { Assessment } from '../../../types'

export function Apagar() {
  const { agent, setAgent, conc, setConc, prediction, vent, setVent, wind, setWind, reignite, scenario, labOff } = useAtlas()
  const lab = useLab()
  const simulated = LAB_MAT[materialOf(scenario).material] !== undefined && !labOff
  // quanto gás apaga a chama, pela curva publicada pela NASA (só existe para o acrílico); a conta é da API
  const [curve, setCurve] = useState<Assessment | null>(null)
  const hasCurve = scenario.family === 'solido' && scenario.material === 'pmma'
  useEffect(() => {
    if (!hasCurve) { setCurve(null); return }
    let live = true
    api.assess(scenario, wind, 'bastão de acrílico').then((r) => { if (live) setCurve(r.assessment ?? null) }).catch(() => { if (live) setCurve(null) })
    return () => { live = false }
  }, [hasCurve, scenario.o2, scenario.pressure_atm, scenario.gravity, wind])
  const opts: [Agent, string][] = [['nenhum', 'No agent'], ['co2', 'CO₂'], ['he', 'Helium']]
  const gas = agent === 'he' ? 'helium' : 'CO₂'
  // o que o simulador mostra agora
  let status = '', detail = ''
  if (simulated && lab) {
    if (lab.igniting) { status = 'Igniting'; detail = 'The igniter is on.' }
    else if (lab.burning) { status = 'Burning'; detail = `The flame releases about ${nf(lab.hrr, 0)} W${lab.agent > 0.005 ? `, with ${pct(lab.agent)} ${lab.agentKey === 'He' ? 'helium' : 'CO₂'} in the air` : ''}${!vent ? ', with no ventilation' : ''}.` }
    else if (lab.out) { status = 'Went out'; detail = `${lab.out.label && lab.out.dt != null ? `${nf(lab.out.dt, 1)} s of simulated time after ${lab.out.label}` : 'The flame did not sustain itself'}${lab.out.agent > 0.005 ? `, with ${pct(lab.out.agent)} ${lab.agentKey === 'He' ? 'helium' : 'CO₂'} in the air` : ''}.` }
    else if (lab.measured) { status = 'No flame'; detail = 'The sample is not burning.' }
  }
  return (
    <div className="block">
      <h2>Try to put out the fire</h2>
      <p>Release a gas into the cabin, change the airflow or cut the ventilation, and watch the flame respond on the stage.</p>
      <div className="choice" role="group" aria-label="Suppressant">
        {opts.map(([id, l]) => (<button key={id} aria-pressed={agent === id} onClick={() => setAgent(id)}>{l}</button>))}
      </div>
      {agent !== 'nenhum' && (
        <div className="slider">
          <div className="slider-top"><label htmlFor="conc">Share of the air replaced by {gas}</label><b>{pct(conc)}</b></div>
          <input id="conc" type="range" min={0} max={0.6} step={0.01} value={conc} onChange={(e) => setConc(+e.target.value)} style={{ ['--fill' as string]: `${(conc / 0.6) * 100}%` }} />
        </div>
      )}
      {simulated && (
        <div className="slider">
          <div className="slider-top"><label htmlFor="wind">Ventilation airflow</label><b>{wind > 0 ? `${nf(wind, 0)} cm/s` : 'off'}</b></div>
          <input id="wind" type="range" min={0} max={WIND_MAX} step={1} value={wind} onChange={(e) => setWind(+e.target.value)} style={{ ['--fill' as string]: `${(wind / WIND_MAX) * 100}%` }} />
        </div>
      )}
      {simulated && (
        <div className="choice two">
          <button aria-pressed={!vent} onClick={() => setVent(!vent)}>{vent ? 'Cut the ventilation' : 'Restore the ventilation'}</button>
          <button onClick={reignite}>Reignite</button>
        </div>
      )}
      {status && (
        <div className="result">
          <b className={status === 'Burning' || status === 'Igniting' ? 'bad' : 'good'}>{status}</b>
          <span>{detail}</span>
        </div>
      )}
      {curve && agent !== 'nenhum' && (
        <p className="hint">
          <span className={`tag${curve.inside_tested ? ' ok' : ' warn'}`}>{curve.inside_tested ? 'NASA curve, within tested range' : 'NASA curve, outside tested range'}</span>{' '}
          {curve.status === 'queima'
            ? `For acrylic, diluting the oxygen alone puts the flame out once gas makes up ${curve.dilution_min[1] - curve.dilution_min[0] < 0.015 ? pct(curve.dilution_min[0], 0) : `between ${pct(curve.dilution_min[0], 0)} and ${pct(curve.dilution_min[1], 0)}`} of the air. This is a dilution calculation: it holds for any inert gas and leaves out the extra cooling from ${gas}.`
            : 'For acrylic, this air is already at or below the limit, even without a suppressant.'}
        </p>
      )}
      {!simulated && prediction && agent !== 'nenhum' && (
        <div className="result">
          <b className={prediction.delta_pct < 0 ? 'good' : 'bad'}>{prediction.delta_pct > 0 ? '+' : ''}{nf(prediction.delta_pct, 0)}%</b>
          <span>{prediction.delta_pct < 0 ? 'Burning slows down.' : prediction.delta_pct > 0 ? 'Burning speeds up.' : 'No measured effect.'}</span>
        </div>
      )}
      {prediction && agent !== 'nenhum' && (
        <p className="hint">
          <span className={`tag${prediction.in_range ? ' ok' : ' warn'}`}>{prediction.in_range ? 'NASA data, within tested range' : 'NASA data, outside tested range'}</span>{' '}
          In the heptane droplets of the FLEX experiment, replacing {pct(conc)} of the air with {gas}{typeof prediction.o2_effective === 'number' ? ` (oxygen falls to ${pct(prediction.o2_effective, 1)})` : ''} changes the burning rate by {prediction.delta_pct > 0 ? '+' : ''}{nf(prediction.delta_pct, 0)}% (from {nf(prediction.baseline_k_mm2_s, 2)} to {nf(prediction.k_mm2_s, 2)} mm²/s; model fitted to {prediction.model.n} tests).
        </p>
      )}
      {simulated && <p className="hint">The simulator is a study model. Only the minimum oxygen for acrylic was checked against the NASA curve (see "How far to trust it" on the stage); the timings and the other materials were not. When it disagrees with the data, the data wins.</p>}
      {agent === 'nenhum' && !simulated && <p className="hint">FLEX tested CO₂ and helium on fuel droplets. Pick one to see the effect.</p>}
    </div>
  )
}
