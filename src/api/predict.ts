// API da previsão: efeito do agente supressor na taxa de queima (modelo ajustado às gotas do FLEX).
import type { Prediction } from '../types'
import { j } from './client'

export const predict = (b: { fuel: string; o2: number; co2: number; he: number; pressure_atm: number }) => j<Prediction>('/predict/burn-rate', b)
