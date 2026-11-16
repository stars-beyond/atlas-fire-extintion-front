// Estado do test drive: o cenário escolhido, o passo atual e o que já foi revelado.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { api } from '../api'
import { labBlocker } from '../lib/gpu'
import type { ExternalSet, Investigation, MatrixCell, Meta, NextTest, Prediction, Ranked, Scenario, Test, Verdict } from '../types'
import { STEPS, VENT_CM_S, WIND_MAX } from './materials'
import { readRoute, routeHash } from './route'
import { loadScenario, sameScenario, saveScenario } from './scenario'
import type { Agent, DriveTab, EvidenceState, LogEntry, StageView, View } from './types'

interface Ctx {
  meta: Meta | null; invs: Investigation[]; tests: Test[]; loadError: string | null
  // ensaios de fora da NASA (torre de queda do ZARM): fora de `tests`, para nada os contar como testes da NASA
  external: ExternalSet | null
  // refetches the catalog (meta, investigations, tests); catalogAt = when this browser last received it
  reloadCatalog: () => Promise<boolean>; catalogAt: Date | null
  // keep = true muda o cenário sem zerar o teste em curso (vento e agente ficam como estão)
  scenario: Scenario; setScenario: (patch: Partial<Scenario>, habitat?: string, keep?: boolean) => void
  verdict: Verdict | null; matrix: MatrixCell[]; ranking: Ranked[]
  // o veredito e o ranking diante do cenário atual (ver EvidenceState). `verdict` fica null quando o pedido falhou;
  // em 'updating' ele ainda é o do cenário anterior, e a tela tem de dizer isso. evidenceError é o motivo da falha.
  verdictState: EvidenceState; rankingState: EvidenceState; evidenceError: string | null; retryEvidence: () => void
  step: number; setStep: (n: number) => void
  driveTab: DriveTab; setDriveTab: (t: DriveTab) => void
  // envia a pergunta ao RAG e já abre o 3D Lab no passo 3 (Test drive) na aba Ask
  askFromHub: (q: string) => void
  view: View; setView: (v: View) => void
  stageView: StageView; setStageView: (v: StageView) => void
  ignited: boolean; ignite: () => void; restart: () => void
  agent: Agent; conc: number; setAgent: (a: Agent) => void; setConc: (c: number) => void; prediction: Prediction | null
  vent: boolean; setVent: (v: boolean) => void; igniteSeq: number; reignite: () => void
  wind: number; setWind: (cm_s: number) => void   // vento da ventilação, em cm/s; vent é só "wind > 0"
  labOff: string | null; setLabOff: (why: string | null) => void
  described: string[]; describe: (text: string) => Promise<boolean>
  // o mesmo entendimento da frase, mas sem sair da tela atual (busca do hub): devolve o que entendeu, ou null
  inferScenario: (text: string) => Promise<string[] | null>
  goHome: () => void
  selectedTest: string | null; selectTest: (id: string | null) => void
  selectedInv: string | null; selectInv: (id: string | null) => void
  // o que falta testar para o material escolhido: a mesma lista alimenta o painel, a ficha e o mapa
  gaps: NextTest[]; selectedGap: number | null; selectGap: (i: number | null) => void
  // stopAsk interrompe a resposta em curso de uma pergunta (id do LogEntry); o texto que já chegou fica na tela
  log: LogEntry[]; ask: (q: string) => void; stopAsk: (id: number) => void
}
const C = createContext<Ctx>(null as unknown as Ctx)
export const useAtlas = () => useContext(C)

const DEFAULT: Scenario = { o2: 0.21, pressure_atm: 1, gravity: 0, family: 'solido', material: 'sibal', habitat: 'iss' }

export function AtlasProvider({ children }: { children: ReactNode }) {
  const [meta, setMeta] = useState<Meta | null>(null)
  const [invs, setInvs] = useState<Investigation[]>([])
  const [tests, setTests] = useState<Test[]>([])
  const [external, setExternal] = useState<ExternalSet | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  // o cenário desta aba sobrevive ao F5 (sessionStorage, validado na leitura)
  const [scenario, setSc] = useState<Scenario>(() => loadScenario() ?? DEFAULT)
  useEffect(() => saveScenario(scenario), [scenario])
  const [verdict, setVerdict] = useState<Verdict | null>(null)
  const [matrix, setMatrix] = useState<MatrixCell[]>([])
  const [ranking, setRanking] = useState<Ranked[]>([])
  // the screen the URL asks for (#dashboard, #story, #lab/material…): see route.ts
  const [boot] = useState(() => readRoute(location.hash))
  const [step, setStepRaw] = useState(boot?.step ?? 0)
  const [driveTab, setDriveTab] = useState<DriveTab>('evidencia')
  const [view, setView] = useState<View>(boot?.view ?? 'home')
  const [stageView, setStageView] = useState<StageView>('chama')
  const [ignited, setIgnited] = useState(boot?.step === 3)   // a ficha técnica (passo 4) só existe depois de acender
  const [agent, setAgentRaw] = useState<Agent>('nenhum')
  const [conc, setConc] = useState(0.3)
  const [wind, setWindRaw] = useState(VENT_CM_S)
  const lastWind = useRef(VENT_CM_S)   // o vento de antes do corte, para religar no mesmo valor
  const setWind = useCallback((v: number) => { const w = Math.max(0, Math.min(WIND_MAX, v)); if (w > 0) lastWind.current = w; setWindRaw(w) }, [])
  const vent = wind > 0
  const setVent = useCallback((on: boolean) => setWindRaw(on ? lastWind.current : 0), [])
  const [igniteSeq, setIgniteSeq] = useState(0)
  // modo leve: sem GPU capaz, o simulador nem é carregado (lib/gpu.ts); ele também pode desligar-se depois, se ficar lento
  const [labOff, setLabOff] = useState<string | null>(() => labBlocker())
  const [described, setDescribed] = useState<string[]>([])
  const [prediction, setPrediction] = useState<Prediction | null>(null)
  const [selectedTest, setSelTest] = useState<string | null>(null)
  const [selectedInv, setSelInv] = useState<string | null>(null)
  const [log, setLog] = useState<LogEntry[]>([])
  const [gaps, setGaps] = useState<NextTest[]>([])
  const [selectedGap, selectGap] = useState<number | null>(null)
  const seq = useRef(0)
  const conversation = useRef('')   // conversa no RAG da equipe: mantém o fio entre perguntas
  const asking = useRef(new Map<number, AbortController>())   // um AbortController por pergunta ainda sem resposta
  useEffect(() => { const m = asking.current; return () => m.forEach((c) => c.abort()) }, [])   // ao sair, nenhum stream fica aberto

  const [catalogAt, setCatalogAt] = useState<Date | null>(null)
  const reloadCatalog = useCallback(() => Promise.all([api.meta(), api.investigations(), api.tests()])
    .then(([m, i, t]) => { setMeta(m); setInvs(i); setTests(t); setLoadError(null); setCatalogAt(new Date()); return true })
    .catch((e) => { setLoadError(e.message || 'Could not reach the Atlas API.'); return false }), [])
  useEffect(() => {
    reloadCatalog()
    api.external().then((x) => setExternal(x.available ? x : null)).catch(() => setExternal(null))   // opcional: uma API mais antiga não tem
  }, [reloadCatalog])

  const setScenario = useCallback((patch: Partial<Scenario>, habitat?: string, keep?: boolean) => {
    if (!keep) { lastWind.current = VENT_CM_S; setWindRaw(VENT_CM_S); setAgentRaw('nenhum') }   // cenário novo, teste novo: ventilação de cabine e sem agente
    setSc((s) => ({ ...s, ...patch, habitat: habitat ?? (patch.habitat !== undefined ? patch.habitat : patch.o2 !== undefined || patch.pressure_atm !== undefined || patch.gravity !== undefined ? '' : s.habitat) }))
  }, [])

  // Which scenario the verdict and the ranking in memory were requested for, and why the last request failed.
  // The comparison is against the scenario that was sent, not the copy the API returns inside the verdict: the API
  // clamps and completes that copy, so it can differ from ours even when the answer is the right one.
  const [evFor, setEvFor] = useState<{ verdict?: Scenario; rank?: Scenario }>({})
  const [evErr, setEvErr] = useState<{ of: Scenario; verdict?: string; rank?: string } | null>(null)
  const [evTry, setEvTry] = useState(0)
  // The dashboard asks for the verdict and the ranking itself, so it can report a failure instead of keeping
  // an old answer; while it is open these two are not requested twice.
  useEffect(() => {
    if (view === 'dashboard') return
    // `live` drops an answer that arrives after the scenario has changed again: without it a slow reply for the
    // previous scenario could overwrite the seal of the current one.
    let live = true
    const failed = (k: 'verdict' | 'rank') => (e: unknown) => {
      if (live) setEvErr((x) => ({ ...(x?.of === scenario ? x : { of: scenario }), [k]: (e as Error)?.message || 'The Atlas API did not answer.' }))
    }
    const t = setTimeout(() => {
      api.verdict(scenario).then((r) => {
        if (!r?.verdict) throw new Error('The Atlas API answered /api/verdict without a verdict.')
        if (live) { setVerdict(r.verdict); setMatrix(r.matrix ?? []); setEvFor((f) => ({ ...f, verdict: scenario })) }
      }).catch(failed('verdict'))
      api.rank(scenario).then((r) => { if (live) { setRanking(r.ranking ?? []); setEvFor((f) => ({ ...f, rank: scenario })) } }).catch(failed('rank'))
    }, 140)
    return () => { live = false; clearTimeout(t) }
  }, [scenario, view, evTry])
  // A failure belongs to the scenario it happened on: the next scenario starts clean, as 'updating'.
  const errNow = evErr?.of === scenario ? evErr : null
  const verdictState: EvidenceState = verdict && sameScenario(evFor.verdict, scenario) ? 'ok' : errNow?.verdict ? 'failed' : 'updating'
  const rankingState: EvidenceState = sameScenario(evFor.rank, scenario) ? 'ok' : errNow?.rank ? 'failed' : 'updating'
  const evidenceError = (verdictState === 'failed' && errNow?.verdict) || (rankingState === 'failed' && errNow?.rank) || null
  const retryEvidence = useCallback(() => { setEvErr(null); setEvTry((n) => n + 1) }, [])

  useEffect(() => {
    let live = true
    selectGap(null)
    api.nextTests(scenario.family, scenario.material).then((r) => { if (live) setGaps(r.next ?? []) }).catch(() => { if (live) setGaps([]) })
    return () => { live = false }
  }, [scenario.family, scenario.material])

  // efeito do agente supressor: modelo ajustado às gotas do FLEX
  useEffect(() => {
    let live = true
    const t = setTimeout(() => {
      // o controle é "parte do ar trocada pelo gás": o oxigênio cai junto, e a API faz essa conta (replace_air)
      api.predict({ fuel: 'Heptane', o2: scenario.o2, co2: agent === 'co2' ? conc : 0, he: agent === 'he' ? conc : 0, pressure_atm: scenario.pressure_atm, replace_air: true })
        .then((r) => { if (live) setPrediction(r) }).catch(() => { if (live) setPrediction(null) })
    }, 120)
    return () => { live = false; clearTimeout(t) }
  }, [scenario.o2, scenario.pressure_atm, agent, conc])

  // no passo do ambiente o palco mostra o cenário 3D dele (vista "Chama"); se a pessoa estava no mapa ao sair desse
  // passo, o palco passa para a chama
  const prevStep = useRef(0)
  useEffect(() => {
    if (prevStep.current === 0 && step >= 1) setStageView((v) => (v === 'mapa' ? 'chama' : v))
    prevStep.current = step
  }, [step])
  const setStep = useCallback((n: number) => { setStepRaw(Math.max(0, Math.min(STEPS.length - 1, n))); setView('drive') }, [])

  // A tela e o passo do 3D Lab vão para o hash, e o hash volta para a tela (route.ts). Toda mudança de tela feita
  // no app cria uma entrada no histórico; as que vêm do próprio histórico (Voltar/Avançar, hash digitado) e o
  // acerto do hash de chegada só o regravam, para o Voltar não ficar preso.
  const shown = useRef({ view, step }); shown.current = { view, step }
  const fromUrl = useRef(true)
  useEffect(() => {
    const hash = routeHash(view, step), replace = fromUrl.current
    fromUrl.current = false
    if (location.hash === hash) return
    // o navegador pode recusar (página em sandbox, muitas chamadas seguidas no Safari): o app segue sem a URL
    try { history[replace ? 'replaceState' : 'pushState'](history.state, '', location.pathname + location.search + hash) } catch { /* sem histórico */ }
  }, [view, step])
  useEffect(() => {
    const onUrl = () => {
      const r = readRoute(location.hash), cur = shown.current
      if (!r) return   // um hash que não é de tela não muda nada
      const s = r.view === 'drive' ? r.step ?? cur.step : cur.step
      if (r.view === cur.view && s === cur.step) return
      fromUrl.current = true
      setStepRaw(s); setView(r.view)
      if (r.view === 'drive' && s === 3) setIgnited(true)   // a ficha técnica só existe com o teste aceso
      if (r.view === 'home') { setStageView('chama'); setSelTest(null) }   // o mesmo que goHome: a home mostra a cena orbital
    }
    window.addEventListener('popstate', onUrl); window.addEventListener('hashchange', onUrl)
    return () => { window.removeEventListener('popstate', onUrl); window.removeEventListener('hashchange', onUrl) }
  }, [])
  // "Descreva com suas palavras": a API extrai o cenário da frase e o configurador já abre preenchido.
  const describe = useCallback(async (text: string) => {
    const r = await api.infer(text, scenario)
    // a API manda `understood: null` quando não entende nada da frase: sem o `?? []` isso virava erro de leitura
    r.understood = r.understood ?? []
    if (!r.understood.length) { setDescribed([]); return false }
    setSc({ ...r.scenario, material: r.scenario.material || '', habitat: r.scenario.habitat || '' })
    lastWind.current = VENT_CM_S; setWindRaw(VENT_CM_S); setAgentRaw('nenhum'); setDescribed(r.understood); setIgnited(false); setStepRaw(2)
    return true
  }, [scenario])
  const inferScenario = useCallback(async (text: string) => {
    const r = await api.infer(text, scenario)
    r.understood = r.understood ?? []
    if (!r.understood.length) return null
    setSc({ ...r.scenario, material: r.scenario.material || '', habitat: r.scenario.habitat || '' })
    lastWind.current = VENT_CM_S; setWindRaw(VENT_CM_S); setAgentRaw('nenhum'); setDescribed(r.understood); setIgnited(false)
    return r.understood
  }, [scenario])
  // a home sempre mostra a cena orbital, qualquer que tenha sido a vista do palco antes
  const goHome = useCallback(() => { setView('home'); setStageView('chama'); setSelTest(null) }, [])
  const ignite = useCallback(() => setIgnited(true), [])
  const restart = useCallback(() => { setDescribed([]); setIgnited(false); setAgentRaw('nenhum'); lastWind.current = VENT_CM_S; setWindRaw(VENT_CM_S); setStepRaw(0); setStageView('chama'); setSelTest(null) }, [])
  const reignite = useCallback(() => { setIgnited(true); setIgniteSeq((n) => n + 1) }, [])
  const setAgent = useCallback((a: Agent) => setAgentRaw(a), [])
  const selectTest = useCallback((id: string | null) => setSelTest(id), [])
  const selectInv = useCallback((id: string | null) => setSelInv(id), [])

  const ask = useCallback((q: string) => {
    const question = q.trim()
    if (!question) return
    const id = ++seq.current, ctrl = new AbortController()
    asking.current.set(id, ctrl)
    setLog((l) => [{ id, question, pending: true }, ...l])
    const patch = (f: (e: LogEntry) => LogEntry) => setLog((l) => l.map((e) => (e.id === id ? f(e) : e)))
    api.askStream(question, scenario, conversation.current, {
      contexto: (c) => patch((e) => ({ ...e, verdict: c.verdict })),
      texto: (t) => patch((e) => ({ ...e, partial: (e.partial ?? '') + t })),
    }, ctrl.signal)
      .then((a) => {
        if (a.conversation_id) conversation.current = a.conversation_id
        patch((e) => ({ ...e, answer: a, pending: false, partial: undefined }))
        if (a.scenario_changed) setSc({ ...a.scenario, material: a.scenario.material || '', habitat: a.scenario.habitat || '' })
      })
      // parar não é erro; e nos dois casos o texto que já chegou (partial) fica, marcado como incompleto
      .catch((e) => patch((x) => ({ ...x, pending: false, ...(ctrl.signal.aborted ? { stopped: true } : { error: (e as Error)?.message || 'the connection failed' }) })))
      .finally(() => { asking.current.delete(id) })
  }, [scenario])
  const stopAsk = useCallback((id: number) => { asking.current.get(id)?.abort() }, [])

  const askFromHub = useCallback((q: string) => {
    const question = q.trim()
    if (!question) return
    setIgnited(true)
    setDriveTab('perguntar')
    setStageView('chama')
    setStepRaw(2)
    setView('drive')
    ask(question)
  }, [ask])

  const value = useMemo<Ctx>(() => ({
    meta, invs, tests, external, loadError, reloadCatalog, catalogAt, scenario, setScenario, verdict: verdictState === 'failed' ? null : verdict, matrix, ranking,
    verdictState, rankingState, evidenceError, retryEvidence, step, setStep, driveTab, setDriveTab, askFromHub, view, setView, stageView, setStageView,
    ignited, ignite, restart, agent, conc, setAgent, setConc, prediction, selectedTest, selectTest, selectedInv, selectInv, log, ask, stopAsk,
    vent, setVent, wind, setWind, igniteSeq, reignite, labOff, setLabOff, described, describe, inferScenario, goHome, gaps, selectedGap, selectGap,
  }), [driveTab, askFromHub, inferScenario, goHome, gaps, selectedGap, meta, invs, tests, external, loadError, reloadCatalog, catalogAt, scenario, setScenario, verdict, matrix, ranking, verdictState, rankingState, evidenceError, retryEvidence, step, setStep, view, stageView,
    ignited, ignite, restart, agent, conc, setAgent, prediction, selectedTest, selectTest, selectedInv, selectInv, log, ask, stopAsk, vent, wind, setVent, setWind, igniteSeq, reignite, labOff, described, describe])
  return <C.Provider value={value}>{children}</C.Provider>
}
