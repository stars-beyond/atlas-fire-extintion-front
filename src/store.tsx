// Estado do test drive: o cenário escolhido, o passo atual e o que já foi revelado.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { labBlocker } from './lib/gpu'
import { api, type Answer, type Family, type Investigation, type MatrixCell, type Meta, type NextTest, type Prediction, type Ranked, type Scenario, type Test, type Verdict } from './api'

export type View = 'drive' | 'achados' | 'investigacoes' | 'proximo'
export type StageView = 'chama' | 'mapa' | 'grafo' | 'limites'
export type Agent = 'nenhum' | 'co2' | 'he'
export const VENT_CM_S = 10 // ventilação forçada de cabine, em cm/s (o mesmo valor do simulador e das avaliações da API)
export const WIND_MAX = 60  // até onde o vento pode ser ajustado; o duto do BASS-II chegou a 55 cm/s
export const STEPS = ['Habitat', 'Material', 'Test drive', 'Ficha técnica'] as const

export interface MaterialOption { id: string; family: Family; material: string; name: string; sub: string; kind: 'tecido' | 'barra' | 'gota' | 'gas'; tint: string }
export const MATERIALS: MaterialOption[] = [
  { id: 'sibal', family: 'solido', material: 'sibal', name: 'Tecido de algodão', sub: 'Algodão com fibra de vidro, o tecido de referência da NASA', kind: 'tecido', tint: '#d9cfb4' },
  { id: 'pmma', family: 'solido', material: 'pmma', name: 'Acrílico', sub: 'Plástico transparente de painéis e visores (PMMA)', kind: 'barra', tint: '#9fc4dd' },
  { id: 'nomex', family: 'solido', material: 'nomex', name: 'Nomex', sub: 'Tecido resistente a chama, usado em roupas e bolsas', kind: 'tecido', tint: '#b9a27a' },
  { id: 'silicone', family: 'solido', material: 'silicone', name: 'Silicone', sub: 'Borracha de vedações e isolamento de cabos', kind: 'barra', tint: '#8f98a6' },
  { id: 'gota', family: 'gota', material: '', name: 'Combustível líquido', sub: 'Uma gota de heptano ou metanol', kind: 'gota', tint: '#7fd8cf' },
  { id: 'gas', family: 'gas', material: '', name: 'Gás inflamável', sub: 'Vazamento de metano, etileno ou propano', kind: 'gas', tint: '#a8aeff' },
]
// Materiais que o simulador 3D da equipe (lab3d) conhece, pelo índice em FL.MATS.
// O Nomex usa os parâmetros do "tecido retardante" do lab3d, que são hipotéticos.
export const LAB_MAT: Record<string, number> = { pmma: 0, sibal: 1, nomex: 2 }

// Estado da chama simulada, publicado pelo iframe do lab3d algumas vezes por segundo.
// Fica fora do contexto para não redesenhar a tela inteira a cada leitura.
export interface LabState {
  lit: boolean; igniting: boolean; burning: boolean; measured: boolean; hrr: number; tk: number
  agent: number; agentKey: string; supOn: boolean; o2eff: number; wind: number
  out: { dt: number | null; label: string | null; agent: number } | null
  material: string; tier: string; fps: number
}
let labState: LabState | null = null
const labSubs = new Set<() => void>()
export const setLab = (v: LabState | null) => { labState = v; labSubs.forEach((f) => f()) }
export const useLab = () => useSyncExternalStore((f) => { labSubs.add(f); return () => { labSubs.delete(f) } }, () => labState)

export const materialOf = (s: Scenario) => MATERIALS.find((m) => m.family === s.family && m.material === (s.material || '')) ?? MATERIALS[0]

// partial: texto que o RAG já escreveu (streaming); verdict: veredito que chega antes do texto
export interface LogEntry { id: number; question: string; answer?: Answer; error?: string; pending: boolean; partial?: string; verdict?: Verdict }

interface Ctx {
  meta: Meta | null; invs: Investigation[]; tests: Test[]; loadError: string | null
  // keep = true muda o cenário sem zerar o teste em curso (vento e agente ficam como estão)
  scenario: Scenario; setScenario: (patch: Partial<Scenario>, habitat?: string, keep?: boolean) => void
  verdict: Verdict | null; matrix: MatrixCell[]; ranking: Ranked[]
  step: number; setStep: (n: number) => void
  view: View; setView: (v: View) => void
  stageView: StageView; setStageView: (v: StageView) => void
  ignited: boolean; ignite: () => void; restart: () => void
  agent: Agent; conc: number; setAgent: (a: Agent) => void; setConc: (c: number) => void; prediction: Prediction | null
  vent: boolean; setVent: (v: boolean) => void; igniteSeq: number; reignite: () => void
  wind: number; setWind: (cm_s: number) => void   // vento da ventilação, em cm/s; vent é só "wind > 0"
  labOff: string | null; setLabOff: (why: string | null) => void
  described: string[]; describe: (text: string) => Promise<boolean>
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
  const [view, setView] = useState<View>('drive')
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
      .catch((e) => setLoadError(e.message || 'Não foi possível falar com a API do Atlas.'))
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

  const value = useMemo<Ctx>(() => ({
    meta, invs, tests, loadError, scenario, setScenario, verdict, matrix, ranking, step, setStep, view, setView, stageView, setStageView,
    ignited, ignite, restart, agent, conc, setAgent, setConc, prediction, selectedTest, selectTest, selectedInv, selectInv, log, ask,
    vent, setVent, wind, setWind, igniteSeq, reignite, labOff, setLabOff, described, describe, gaps, selectedGap, selectGap,
  }), [gaps, selectedGap, meta, invs, tests, loadError, scenario, setScenario, verdict, matrix, ranking, step, setStep, view, stageView,
    ignited, ignite, restart, agent, conc, setAgent, prediction, selectedTest, selectTest, selectedInv, selectInv, log, ask, vent, wind, setVent, setWind, igniteSeq, reignite, labOff, described, describe])
  return <C.Provider value={value}>{children}</C.Provider>
}
