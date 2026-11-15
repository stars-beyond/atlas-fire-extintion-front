// Tipos do estado da tela: qual vista está aberta, o que o palco mostra, o agente supressor e o registro de perguntas.
import type { Answer, Verdict } from '../types'

export type View = 'drive' | 'achados' | 'investigacoes' | 'proximo'
export type StageView = 'chama' | 'mapa' | 'grafo' | 'limites'
export type Agent = 'nenhum' | 'co2' | 'he'

// partial: texto que o RAG já escreveu (streaming); verdict: veredito que chega antes do texto
export interface LogEntry { id: number; question: string; answer?: Answer; error?: string; pending: boolean; partial?: string; verdict?: Verdict }
