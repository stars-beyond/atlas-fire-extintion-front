// Passo 3: o test drive. Acender, ler o que a NASA sabe, tentar apagar e perguntar.
import { useEffect, useState } from 'react'
import { OUTCOME, api, gLabel, nf, pct, psi, type Assessment, type Citation } from '../api'
import { EmpiricalRate } from '../components/EmpiricalRate'
import { Gaps } from '../components/Gaps'
import { Markdown } from '../components/Markdown'
import { Seal } from '../components/Seal'
import { LAB_MAT, WIND_MAX, materialOf, useAtlas, useLab, type Agent, type LogEntry } from '../store'

type Tab = 'evidencia' | 'lacunas' | 'apagar' | 'perguntar'
// O selo já diz o nível; a frase fica só com a explicação.
export const plain = (h: string) => { const t = h.replace(/^[^:]{3,22}:\s*/, ''); return t.charAt(0).toUpperCase() + t.slice(1) }
const EXAMPLES = ['O que a NASA já sabe sobre este material?', 'Qual equação descreve a taxa de queima de uma gota?', 'O CO₂ apaga melhor que o hélio?', 'Como a fumaça é detectada em microgravidade?']

function Evidencia({ onGaps }: { onGaps: () => void }) {
  const { verdict, selectTest, setStageView } = useAtlas()
  if (!verdict) return <p className="hint">Consultando os testes da NASA…</p>
  return (
    <div className="block">
      <Seal tier={verdict.tier} big />
      <p className="lead">{plain(verdict.headline)}</p>
      <p>{verdict.explanation}</p>
      <EmpiricalRate verdict={verdict} />
      <div className="counts" aria-label="Quantos testes da NASA existem nesta atmosfera, por gravidade">
        <div><b>{verdict.same_g}</b><span>testes nesta gravidade</span></div>
        <div><b style={{ color: 'var(--g0)' }}>{verdict.zero_g}</b><span>em órbita (0 g)</span></div>
        <div><b style={{ color: 'var(--g1)' }}>{verdict.one_g}</b><span>no solo (1 g)</span></div>
      </div>
      {!verdict.empirical && (
        <button className="callout" onClick={onGaps}>
          <b>Ninguém queimou isto nesta condição.</b>
          <span>Por isso o Atlas não diz se queima: mostra os testes mais próximos e o que falta testar →</span>
        </button>
      )}
      <h2>Os testes mais parecidos com o seu</h2>
      <div className="list">
        {verdict.nearest.slice(0, 4).map((n) => (
          <button key={n.test.id} className="row" onClick={() => { selectTest(n.test.id); setStageView('mapa') }}>
            <span className="row-main"><b>{n.investigation} · {n.test.label}</b><span>{pct(n.test.o2)} de O₂ · {psi(n.test.pressure_atm)} · {gLabel(n.test.gravity)} · {OUTCOME[n.test.outcome]}</span></span>
            <span className={`tag${n.inside ? ' ok' : ''}`}>{n.inside ? 'mesma condição' : `${n.d_o2_pp > 0 ? '+' : '−'}${nf(Math.abs(n.d_o2_pp), 0)} pontos de O₂`}</span>
          </button>
        ))}
        {!verdict.nearest.length && <p className="hint">Nenhum teste deste tipo tem oxigênio e pressão tabelados.</p>}
      </div>
      <p className="hint">Toque num teste para vê-lo no mapa, com o arquivo e a linha de onde o dado saiu.</p>
    </div>
  )
}

function Apagar() {
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

function Entry({ e }: { e: LogEntry }) {
  const { selectTest, setStageView } = useAtlas()
  const [open, setOpen] = useState<number | null>(null)
  const a = e.answer
  const onCite = (c: Citation) => { setOpen((o) => (o === c.n ? null : c.n)); if (c.test_id) { selectTest(c.test_id); setStageView('mapa') } }
  return (
    <article className="qa">
      <h3>{e.question}</h3>
      {e.pending && !e.partial && <p className="hint">{e.verdict ? `Evidência: ${e.verdict.label}. Lendo os relatórios da NASA…` : 'Lendo os testes e os relatórios da NASA…'}</p>}
      {e.pending && e.partial && (<><div className="streaming"><Markdown text={e.partial} onCite={() => {}} /></div><p className="hint">Escrevendo… as fontes aparecem no fim.</p></>)}
      {e.error && <p className="hint bad">Não consegui responder: {e.error}. Tente de novo.</p>}
      {a && (
        <>
          <Markdown text={a.answer} onCite={(n) => { const c = a.citations.find((x) => x.n === n); if (c) onCite(c) }} />
          {a.warning && <p className="hint">{a.warning}</p>}
          {a.citations.length > 0 && (
            <div className="sources">
              <span className="eyebrow">Fontes</span>
              {a.citations.map((c) => (
                <button key={c.n} className={`source${open === c.n ? ' open' : ''}`} onClick={() => onCite(c)}>
                  <span className="cite">{c.n}</span>
                  <span>
                    <b>{c.title}</b><span className="mono">{c.where}</span>
                    {open === c.n && (
                      <>
                        <span className="excerpt">{c.text}</span>
                        {c.note && <span className="excerpt"><span className="tag warn">{c.note}</span></span>}
                        {c.warnings?.map((w) => (<span key={w} className="excerpt">Aviso: {w}</span>))}
                        {c.url && <a className="excerpt" href={c.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>Abrir a fonte oficial</a>}
                      </>
                    )}
                  </span>
                </button>
              ))}
            </div>
          )}
          <p className="hint">{a.mode === 'rag' ? `Respondido pelo RAG da equipe sobre ${nf(a.sources.rag_trechos ?? 0)} trechos de documentos da NASA. Texto gerado por IA a partir das fontes acima.`
            : a.mode === 'si' ? 'Texto redigido por IA a partir das fontes acima.' : 'Resposta montada só com os dados, sem texto gerado.'}{a.abstained ? ' Este assunto está fora do acervo.' : ''}</p>
        </>
      )}
    </article>
  )
}

function Perguntar() {
  const { log, ask } = useAtlas()
  const [q, setQ] = useState('')
  const send = () => { if (q.trim()) { ask(q); setQ('') } }
  return (
    <div className="block">
      <h2>Pergunte ao Atlas</h2>
      <p>Ele responde com o que está nos testes e relatórios da NASA, e mostra a fonte de cada frase.</p>
      <div className="askbox">
        <textarea value={q} onChange={(e) => setQ(e.target.value)} placeholder="Escreva sua pergunta" aria-label="Sua pergunta"
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }} />
        <button className="cta" onClick={send} disabled={!q.trim()}>Perguntar</button>
      </div>
      {log.length === 0 && <div className="chips">{EXAMPLES.map((x) => (<button key={x} onClick={() => ask(x)}>{x}</button>))}</div>}
      {log.map((e) => (<Entry key={e.id} e={e} />))}
    </div>
  )
}

export function TestDriveStep() {
  const { ignited, ignite, scenario, meta, setStageView, described } = useAtlas()
  const [tab, setTab] = useState<Tab>('evidencia')
  const mat = materialOf(scenario)
  const hab = meta?.habitats.find((h) => h.id === scenario.habitat)
  if (!ignited) {
    return (
      <div className="step">
        <header className="step-head">
          <span className="eyebrow">Passo 3 de 4</span>
          <h1>Pronto para o test drive</h1>
          <p>Vamos acender <b>{mat.name.toLowerCase()}</b> {hab ? <>em <b>{hab.name.toLowerCase()}</b></> : 'no seu ambiente'}: {pct(scenario.o2)} de oxigênio, {psi(scenario.pressure_atm)}, {gLabel(scenario.gravity)}.</p>
        </header>
        {described.length > 0 && <div className="badges"><span className="eyebrow">Entendi da sua descrição</span>{described.map((d) => (<span key={d} className="pill">{d}</span>))}</div>}
        <button className="ignite" onClick={() => { setStageView('chama'); ignite() }}>
          <span className="ignite-dot" />Acender
        </button>
        <p className="hint">A chama no palco é uma simulação de estudo. O que vale é o que vem depois: o que a NASA já testou nessa condição.</p>
      </div>
    )
  }
  const tabs: [Tab, string][] = [['evidencia', 'Evidência'], ['lacunas', 'Falta testar'], ['apagar', 'Apagar'], ['perguntar', 'Perguntar']]
  return (
    <div className="step">
      <header className="step-head tight">
        <span className="eyebrow">Passo 3 de 4 · test drive</span>
        <div className="tabs" role="tablist">
          {tabs.map(([id, l]) => (<button key={id} role="tab" aria-selected={tab === id} onClick={() => { setTab(id); if (id === 'apagar') setStageView('chama') }}>{l}</button>))}
        </div>
      </header>
      {tab === 'evidencia' && <Evidencia onGaps={() => setTab('lacunas')} />}
      {tab === 'lacunas' && <div className="block"><h2>O que falta testar</h2><Gaps /></div>}
      {tab === 'apagar' && <Apagar />}
      {tab === 'perguntar' && <Perguntar />}
    </div>
  )
}
