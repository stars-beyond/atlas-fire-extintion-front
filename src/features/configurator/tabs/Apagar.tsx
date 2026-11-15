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
  const opts: [Agent, string][] = [['nenhum', 'Sem agente'], ['co2', 'CO₂'], ['he', 'Hélio']]
  const gas = agent === 'he' ? 'hélio' : 'CO₂'
  // o que o simulador mostra agora
  let status = '', detail = ''
  if (simulated && lab) {
    if (lab.igniting) { status = 'Acendendo'; detail = 'O ignitor está ligado.' }
    else if (lab.burning) { status = 'Queimando'; detail = `A chama libera cerca de ${nf(lab.hrr, 0)} W${lab.agent > 0.005 ? `, com ${pct(lab.agent)} de ${lab.agentKey === 'He' ? 'hélio' : 'CO₂'} no ar` : ''}${!vent ? ', sem ventilação' : ''}.` }
    else if (lab.out) { status = 'Apagou'; detail = `${lab.out.label && lab.out.dt != null ? `${nf(lab.out.dt, 1)} s de simulação depois d${lab.out.label}` : 'A chama não se sustentou'}${lab.out.agent > 0.005 ? `, com ${pct(lab.out.agent)} de ${lab.agentKey === 'He' ? 'hélio' : 'CO₂'} no ar` : ''}.` }
    else if (lab.measured) { status = 'Sem chama'; detail = 'A amostra não está queimando.' }
  }
  return (
    <div className="block">
      <h2>Tente apagar o fogo</h2>
      <p>Solte um gás na cabine, mude o vento ou corte a ventilação, e veja a chama responder no palco.</p>
      <div className="choice" role="group" aria-label="Agente supressor">
        {opts.map(([id, l]) => (<button key={id} aria-pressed={agent === id} onClick={() => setAgent(id)}>{l}</button>))}
      </div>
      {agent !== 'nenhum' && (
        <div className="slider">
          <div className="slider-top"><label htmlFor="conc">Quanto do ar vira {gas}</label><b>{pct(conc)}</b></div>
          <input id="conc" type="range" min={0} max={0.6} step={0.01} value={conc} onChange={(e) => setConc(+e.target.value)} style={{ ['--fill' as string]: `${(conc / 0.6) * 100}%` }} />
        </div>
      )}
      {simulated && (
        <div className="slider">
          <div className="slider-top"><label htmlFor="wind">Vento da ventilação</label><b>{wind > 0 ? `${nf(wind, 0)} cm/s` : 'cortada'}</b></div>
          <input id="wind" type="range" min={0} max={WIND_MAX} step={1} value={wind} onChange={(e) => setWind(+e.target.value)} style={{ ['--fill' as string]: `${(wind / WIND_MAX) * 100}%` }} />
        </div>
      )}
      {simulated && (
        <div className="choice two">
          <button aria-pressed={!vent} onClick={() => setVent(!vent)}>{vent ? 'Cortar a ventilação' : 'Religar a ventilação'}</button>
          <button onClick={reignite}>Acender de novo</button>
        </div>
      )}
      {status && (
        <div className="result">
          <b className={status === 'Queimando' || status === 'Acendendo' ? 'bad' : 'good'}>{status}</b>
          <span>{detail}</span>
        </div>
      )}
      {curve && agent !== 'nenhum' && (
        <p className="hint">
          <span className={`tag${curve.inside_tested ? ' ok' : ' warn'}`}>{curve.inside_tested ? 'Curva da NASA, dentro da faixa' : 'Curva da NASA, fora da faixa'}</span>{' '}
          {curve.status === 'queima'
            ? `Para o acrílico, só por diluir o oxigênio a chama apaga com ${curve.dilution_min[1] - curve.dilution_min[0] < 0.015 ? pct(curve.dilution_min[0], 0) : `${pct(curve.dilution_min[0], 0)} a ${pct(curve.dilution_min[1], 0)}`} de gás no ar. É conta de diluição: vale para qualquer gás inerte e não inclui o resfriamento extra do ${gas}.`
            : 'Para o acrílico, este ar já está no limite ou abaixo dele, mesmo sem agente.'}
        </p>
      )}
      {!simulated && prediction && agent !== 'nenhum' && (
        <div className="result">
          <b className={prediction.delta_pct < 0 ? 'good' : 'bad'}>{prediction.delta_pct > 0 ? '+' : ''}{nf(prediction.delta_pct, 0)}%</b>
          <span>{prediction.delta_pct < 0 ? 'A queima fica mais lenta.' : prediction.delta_pct > 0 ? 'A queima fica mais rápida.' : 'Sem efeito medido.'}</span>
        </div>
      )}
      {prediction && agent !== 'nenhum' && (
        <p className="hint">
          <span className={`tag${prediction.in_range ? ' ok' : ' warn'}`}>{prediction.in_range ? 'Dado da NASA, dentro da faixa' : 'Dado da NASA, fora da faixa'}</span>{' '}
          Nas gotas de heptano do experimento FLEX, {pct(conc)} de {gas} muda a taxa de queima em {prediction.delta_pct > 0 ? '+' : ''}{nf(prediction.delta_pct, 0)}% (de {nf(prediction.baseline_k_mm2_s, 2)} para {nf(prediction.k_mm2_s, 2)} mm²/s, modelo ajustado a {prediction.model.n} testes).
        </p>
      )}
      {simulated && <p className="hint">O simulador é um modelo de estudo. Só o oxigênio mínimo do acrílico foi comparado com a curva da NASA (veja "Quanto confiar", no palco); os tempos e os outros materiais, não. Quando ele discorda dos dados, valem os dados.</p>}
      {agent === 'nenhum' && !simulated && <p className="hint">O FLEX testou CO₂ e hélio em gotas de combustível. Escolha um para ver o efeito.</p>}
    </div>
  )
}
