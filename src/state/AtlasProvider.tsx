// Estado do test drive: o cenário escolhido, o passo atual e o que já foi revelado.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { api } from '../api'
import { labBlocker } from '../lib/gpu'
import type { Investigation, MatrixCell, Meta, NextTest, Prediction, Ranked, Scenario, Test, Verdict } from '../types'
import { STEPS, VENT_CM_S, WIND_MAX } from './materials'
import type { Agent, DriveTab, LogEntry, StageView, View } from './types'

interface Ctx {
  meta: Meta | null; invs: Investigation[]; tests: Test[]; loadError: string | null
  // keep = true muda o cenário sem zerar o teste em curso (vento e agente ficam como estão)
  scenario: Scenario; setScenario: (patch: Partial<Scenario>, habitat?: string, keep?: boolean) => void
  verdict: Verdict | null; matrix: MatrixCell[]; ranking: Ranked[]
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
  log: LogEntry[]; ask: (q: string) => void
}
const C = createContext<Ctx>(null as unknown as Ctx)
export const useAtlas = () => useContext(C)

const DEFAULT: Scenario = { o2: 0.21, pressure_atm: 1, gravity: 0, family: 'solido', material: 'sibal', habitat: 'iss' }

export function AtlasProvider({ children }: { children: ReactNode }) {
  const [meta, setMeta] = useState<Meta | null>(null)
  const [invs, setInvs] = useState<Investigation[]>([])
  const [tests, setTests] = useState<Test[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [scenario, setSc] = useState<Scenario>(DEFAULT)
  const [verdict, setVerdict] = useState<Verdict | null>(null)
  const [matrix, setMatrix] = useState<MatrixCell[]>([])
  const [ranking, setRanking] = useState<Ranked[]>([])
  const [step, setStepRaw] = useState(0)
  const [driveTab, setDriveTab] = useState<DriveTab>('evidencia')
  const [view, setView] = useState<View>('home')
  const [stageView, setStageView] = useState<StageView>('chama')
  const [ignited, setIgnited] = useState(false)
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

  useEffect(() => {
    Promise.all([api.meta(), api.investigations(), api.tests()])
      .then(([m, i, t]) => { setMeta(m); setInvs(i); setTests(t) })
      .catch((e) => setLoadError(e.message || 'Could not reach the Atlas API.'))
  }, [])

  const setScenario = useCallback((patch: Partial<Scenario>, habitat?: string, keep?: boolean) => {
    if (!keep) { lastWind.current = VENT_CM_S; setWindRaw(VENT_CM_S); setAgentRaw('nenhum') }   // cenário novo, teste novo: ventilação de cabine e sem agente
    setSc((s) => ({ ...s, ...patch, habitat: habitat ?? (patch.habitat !== undefined ? patch.habitat : patch.o2 !== undefined || patch.pressure_atm !== undefined || patch.gravity !== undefined ? '' : s.habitat) }))
  }, [])

  useEffect(() => {
    const t = setTimeout(() => {
      api.verdict(scenario).then((r) => { setVerdict(r.verdict); setMatrix(r.matrix) }).catch(() => {})
      api.rank(scenario).then((r) => setRanking(r.ranking)).catch(() => {})
    }, 140)
    return () => clearTimeout(t)
  }, [scenario])

  useEffect(() => {
    let live = true
    selectGap(null)
    api.nextTests(scenario.family, scenario.material).then((r) => { if (live) setGaps(r.next ?? []) }).catch(() => { if (live) setGaps([]) })
    return () => { live = false }
  }, [scenario.family, scenario.material])

  // efeito do agente supressor: modelo ajustado às gotas do FLEX
  useEffect(() => {
    const t = setTimeout(() => {
      api.predict({ fuel: 'Heptane', o2: scenario.o2, co2: agent === 'co2' ? conc : 0, he: agent === 'he' ? conc : 0, pressure_atm: scenario.pressure_atm })
        .then(setPrediction).catch(() => setPrediction(null))
    }, 120)
    return () => clearTimeout(t)
  }, [scenario.o2, scenario.pressure_atm, agent, conc])

  // no passo do ambiente o palco mostra o cenário 3D dele (vista "Chama"); se a pessoa estava no mapa ao sair desse
  // passo, o palco passa para a chama
  const prevStep = useRef(0)
  useEffect(() => {
    if (prevStep.current === 0 && step >= 1) setStageView((v) => (v === 'mapa' ? 'chama' : v))
    prevStep.current = step
  }, [step])
  const setStep = useCallback((n: number) => { setStepRaw(Math.max(0, Math.min(STEPS.length - 1, n))); setView('drive') }, [])
  // "Descreva com suas palavras": a API extrai o cenário da frase e o configurador já abre preenchido.
  const describe = useCallback(async (text: string) => {
    const r = await api.infer(text, scenario)
    if (!r.understood.length) { setDescribed([]); return false }
    setSc({ ...r.scenario, material: r.scenario.material || '', habitat: r.scenario.habitat || '' })
    lastWind.current = VENT_CM_S; setWindRaw(VENT_CM_S); setAgentRaw('nenhum'); setDescribed(r.understood); setIgnited(false); setStepRaw(2)
    return true
  }, [scenario])
  const inferScenario = useCallback(async (text: string) => {
    const r = await api.infer(text, scenario)
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
    const id = ++seq.current
    setLog((l) => [{ id, question, pending: true }, ...l])
    const patch = (f: (e: LogEntry) => LogEntry) => setLog((l) => l.map((e) => (e.id === id ? f(e) : e)))
    api.askStream(question, scenario, conversation.current, {
      contexto: (c) => patch((e) => ({ ...e, verdict: c.verdict })),
      texto: (t) => patch((e) => ({ ...e, partial: (e.partial ?? '') + t })),
    })
      .then((a) => {
        if (a.conversation_id) conversation.current = a.conversation_id
        setLog((l) => l.map((e) => (e.id === id ? { ...e, answer: a, pending: false, partial: undefined } : e)))
        if (a.scenario_changed) setSc({ ...a.scenario, material: a.scenario.material || '', habitat: a.scenario.habitat || '' })
      })
      .catch((e) => setLog((l) => l.map((x) => (x.id === id ? { ...x, error: e.message, pending: false, partial: undefined } : x))))
  }, [scenario])

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
    meta, invs, tests, loadError, scenario, setScenario, verdict, matrix, ranking, step, setStep, driveTab, setDriveTab, askFromHub, view, setView, stageView, setStageView,
    ignited, ignite, restart, agent, conc, setAgent, setConc, prediction, selectedTest, selectTest, selectedInv, selectInv, log, ask,
    vent, setVent, wind, setWind, igniteSeq, reignite, labOff, setLabOff, described, describe, inferScenario, goHome, gaps, selectedGap, selectGap,
  }), [driveTab, askFromHub, inferScenario, goHome, gaps, selectedGap, meta, invs, tests, loadError, scenario, setScenario, verdict, matrix, ranking, step, setStep, view, stageView,
    ignited, ignite, restart, agent, conc, setAgent, prediction, selectedTest, selectTest, selectedInv, selectInv, log, ask, vent, wind, setVent, setWind, igniteSeq, reignite, labOff, described, describe])
  return <C.Provider value={value}>{children}</C.Provider>
}
