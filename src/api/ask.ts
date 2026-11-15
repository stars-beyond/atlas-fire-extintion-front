// API das perguntas: resposta inteira, resposta em streaming e o cenário extraído de uma frase.
import type { Answer, Scenario } from '../types'
import { j } from './client'

export { askStream } from './stream'
export const ask = (question: string, scenario: Scenario, conversation_id = '') => j<Answer>('/ask', { question, scenario, conversation_id })
export const infer = (text: string, scenario: Scenario) => j<{ scenario: Scenario; understood: string[]; method: string; changed: boolean }>('/scenario/infer', { text, scenario })
