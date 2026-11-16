// A tela na URL. O hash guarda só o nome da tela e, no 3D Lab, o passo (#dashboard, #lab/material): nunca o
// cenário nem o texto de uma pergunta. Com isso o Voltar/Avançar do navegador anda entre telas e o F5 reabre a mesma.
import type { View } from './types'

// home não tem hash; #dashboard e #story já existiam e continuam valendo
const VIEW_HASH: Record<View, string> = {
  home: '', drive: 'lab', dashboard: 'dashboard', historia: 'story', achados: 'findings', investigacoes: 'investigations', proximo: 'next-fire', perguntar: 'ask',
}
// na mesma ordem de STEPS (materials.ts)
const STEP_HASH: readonly string[] = ['habitat', 'material', 'test-drive', 'spec-sheet']

// step só vem quando o hash diz o passo (#lab sozinho abre o laboratório no passo em que ele estava)
export interface Route { view: View; step?: number }

/** A tela que um hash pede, ou null quando ele não é de nenhuma tela (o app então fica onde está). */
export function readRoute(hash: string): Route | null {
  const [name, sub = ''] = hash.replace(/^#\/?/, '').toLowerCase().split('/')
  const view = (Object.keys(VIEW_HASH) as View[]).find((v) => VIEW_HASH[v] === name)
  if (!view) return null
  const step = view === 'drive' ? STEP_HASH.indexOf(sub) : -1
  return step >= 0 ? { view, step } : { view }
}

export function routeHash(view: View, step: number): string {
  const name = VIEW_HASH[view]
  return name ? '#' + name + (view === 'drive' && STEP_HASH[step] ? '/' + STEP_HASH[step] : '') : ''
}
