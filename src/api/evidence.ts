// API da evidência: veredito do cenário, ranking das investigações, o que falta testar, grafo e achados.
import type { GEdge, GNode, Insight, MatrixCell, NextTest, Ranked, Scenario, Verdict } from '../types'
import { j } from './client'

export const verdict = (s: Scenario) => j<{ verdict: Verdict; matrix: MatrixCell[] }>('/verdict', s)
export const rank = (scenario: Scenario, question = '') => j<{ ranking: Ranked[] }>('/rank', { scenario, question })
export const nextTests = (family: string, material: string) => j<{ next: NextTest[]; method: string }>('/next-tests', { family, material })
export const insights = () => j<{ insights: Insight[] }>('/insights')
export const graph = (s: Scenario) => j<{ nodes: GNode[]; edges: GEdge[] }>('/graph', s)
