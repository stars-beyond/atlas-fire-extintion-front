// Tipos das perguntas ao Atlas: resposta, citações e os eventos da resposta em streaming.
import type { Ranked, Verdict } from './evidence'
import type { Scenario } from './scenario'

export interface Citation { n: number; ref: string; kind: string; title: string; where: string; investigation_id?: string; test_id?: string; url?: string; text: string; note?: string; warnings?: string[] }
export interface Answer {
  answer: string; citations: Citation[]; scenario: Scenario; scenario_changed: boolean; understood: string[]
  verdict: Verdict; ranking: Ranked[]; mode: 'rag' | 'si' | 'extrativo'; conversation_id?: string; provider: string; model: string
  sources: Record<string, number>; abstained: boolean; warning?: string; took_ms: number
}

export interface AskContext { scenario: Scenario; scenario_changed: boolean; understood: string[]; verdict: Verdict }
export interface AskStreamHandlers { contexto?: (c: AskContext) => void; texto?: (t: string) => void }
