// API da inflamabilidade: testes do BASS-II com a curva publicada, fila do próximo fogo, avaliação do cenário
// e a validação do simulador.
import type { Assessment, FireQueue, Flammability, Scenario, SimValidation } from '../types'
import { j } from './client'

export const flammability = () => j<Flammability>('/flammability')
export const queue = () => j<FireQueue>('/flammability/queue')
export const simValidation = () => j<SimValidation>('/sim/validation')
export const assess = (s: Scenario, forced_cm_s: number, form: string) => j<{ available: boolean; assessment?: Assessment }>('/flammability/assess', { ...s, forced_cm_s, form })
