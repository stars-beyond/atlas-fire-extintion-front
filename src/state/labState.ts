// Estado da chama simulada, publicado pelo iframe do lab3d algumas vezes por segundo.
// Fica fora do contexto para não redesenhar a tela inteira a cada leitura.
import { useSyncExternalStore } from 'react'

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
