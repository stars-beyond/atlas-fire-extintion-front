// Os materiais do configurador, os que o simulador 3D conhece e as constantes do test drive.
import type { Family, Scenario } from '../types'

export const VENT_CM_S = 10 // ventilação forçada de cabine, em cm/s (o mesmo valor do simulador e das avaliações da API)
export const WIND_MAX = 60  // até onde o vento pode ser ajustado; o duto do BASS-II chegou a 55 cm/s
export const STEPS = ['Habitat', 'Material', 'Test drive', 'Spec sheet'] as const

export interface MaterialOption { id: string; family: Family; material: string; name: string; noun: string; sub: string; kind: 'tecido' | 'barra' | 'gota' | 'gas'; tint: string }
export const MATERIALS: MaterialOption[] = [
  { id: 'sibal', family: 'solido', material: 'sibal', name: 'Cotton fabric', noun: 'cotton fabric', sub: "Cotton and fiberglass blend, NASA's reference fabric", kind: 'tecido', tint: '#d9cfb4' },
  { id: 'pmma', family: 'solido', material: 'pmma', name: 'Acrylic (PMMA)', noun: 'acrylic (PMMA)', sub: 'Clear plastic used in panels and windows', kind: 'barra', tint: '#9fc4dd' },
  { id: 'nomex', family: 'solido', material: 'nomex', name: 'Nomex', noun: 'Nomex', sub: 'Flame-resistant fabric used in clothing and bags', kind: 'tecido', tint: '#b9a27a' },
  { id: 'silicone', family: 'solido', material: 'silicone', name: 'Silicone', noun: 'silicone', sub: 'Rubber in seals and cable insulation', kind: 'barra', tint: '#8f98a6' },
  { id: 'gota', family: 'gota', material: '', name: 'Liquid fuel', noun: 'liquid fuel', sub: 'A droplet of heptane or methanol', kind: 'gota', tint: '#7fd8cf' },
  { id: 'gas', family: 'gas', material: '', name: 'Flammable gas', noun: 'flammable gas', sub: 'A methane, ethylene or propane leak', kind: 'gas', tint: '#a8aeff' },
]
// Materiais que o simulador 3D da equipe (lab3d) conhece, pelo índice em FL.MATS.
// O Nomex usa os parâmetros do "tecido retardante" do lab3d, que são hipotéticos.
export const LAB_MAT: Record<string, number> = { pmma: 0, sibal: 1, nomex: 2 }

export const materialOf = (s: Scenario) => MATERIALS.find((m) => m.family === s.family && m.material === (s.material || '')) ?? MATERIALS[0]
