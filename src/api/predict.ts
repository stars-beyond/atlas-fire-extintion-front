// API das previsões: efeito do agente supressor na taxa de queima (modelo ajustado às gotas do FLEX) e
// velocidade de propagação da chama (modelo neural da equipe, treinado nos ensaios do ZARM).
import type { Prediction, Scenario, Spread, Thermal } from '../types'
import { j } from './client'

// `replace_air`: co2 e he são a parte do ar trocada pelo gás; a API dilui o oxigênio junto (o2·(1−gás)).
export const predict = (b: { fuel: string; o2: number; co2: number; he: number; pressure_atm: number; replace_air?: boolean }) => j<Prediction>('/predict/burn-rate', b)
export const spread = (s: Scenario, wind_cm_s: number) => j<Spread>('/predict/spread', { ...s, wind_cm_s })
export const thermal = (s: Scenario, wind_cm_s: number, compare: boolean) => j<Thermal>('/predict/thermal', { ...s, wind_cm_s, compare })
