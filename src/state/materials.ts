// Os materiais do configurador, os que o simulador 3D conhece e as constantes do test drive.
import type { Family, Scenario } from '../types'

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

export const materialOf = (s: Scenario) => MATERIALS.find((m) => m.family === s.family && m.material === (s.material || '')) ?? MATERIALS[0]
