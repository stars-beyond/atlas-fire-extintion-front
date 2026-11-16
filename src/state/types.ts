// Tipos do estado da tela: qual vista está aberta, o que o palco mostra, o agente supressor e o registro de perguntas.
import type { Answer, Verdict } from '../types'

// home: o hub de roteamento (cena orbital + cartões dos módulos); perguntar: o RAG em página própria;
// dashboard: o Scientific Intelligence Dashboard (Findings + Investigations + Next fire numa tela só);
// historia: o modo história, a missão simulada pelo Mission Fire Engine contada capítulo a capítulo
export type View = 'home' | 'drive' | 'dashboard' | 'historia' | 'achados' | 'investigacoes' | 'proximo' | 'perguntar'
export type DriveTab = 'evidencia' | 'lacunas' | 'apagar' | 'perguntar'
export type StageView = 'chama' | 'mapa' | 'grafo' | 'limites' | 'termica'
export type Agent = 'nenhum' | 'co2' | 'he'

// O veredito (ou o ranking) em memória diante do cenário atual: ok = é dele; updating = ainda é o do cenário anterior
// e o novo está a caminho; failed = o pedido do cenário atual falhou
export type EvidenceState = 'ok' | 'updating' | 'failed'

// partial: texto que o RAG já escreveu (streaming); verdict: veredito que chega antes do texto.
// stopped: a pessoa parou a resposta. Com stopped ou error, partial é o que chegou até ali: texto incompleto,
// sem a validação e sem as fontes da resposta final (answer).
export interface LogEntry { id: number; question: string; answer?: Answer; error?: string; pending: boolean; partial?: string; verdict?: Verdict; stopped?: boolean }
