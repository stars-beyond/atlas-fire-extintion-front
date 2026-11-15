// API do acervo: metadados, investigações e testes.
import type { InvDetail, Investigation, Meta, Test, TestDetail } from '../types'
import { j } from './client'

// Tradução de segurança caso o backend conectado ainda devolva os nomes dos habitats em português.
const HABITAT_EN: Record<string, { name: string; note: string }> = {
  iss: { name: 'Space station', note: 'Sea-level air in orbit: 21% O₂ at 14.7 psi.' },
  lua: { name: 'Lunar base', note: 'Boundary cited in the challenge statement: 30% O₂ or more, 10.2 psi or less.' },
  rover: { name: 'Pressurized rover', note: 'Exploration atmosphere: 34% O₂ at 8.2 psi, to shorten pre-breathe before spacewalks.' },
  marte: { name: 'Mars base', note: 'Same exploration atmosphere, at 0.38 g.' },
  traje: { name: 'Spacesuit', note: 'Pure oxygen at 4.3 psi, as stated in the challenge.' },
  terra: { name: 'Closed room on Earth', note: 'Battery or server room with clean-agent gas suppression.' },
}

export const meta = async (): Promise<Meta> => {
  const m = await j<Meta>('/meta')
  return { ...m, habitats: m.habitats.map((h) => (HABITAT_EN[h.id] ? { ...h, ...HABITAT_EN[h.id] } : h)) }
}
export const investigations = () => j<Investigation[]>('/investigations')
export const investigation = (id: string) => j<InvDetail>('/investigations/' + encodeURIComponent(id))
export const tests = async (): Promise<Test[]> => {
  const d = await j<{ columns: string[]; rows: any[][] }>('/tests')
  return d.rows.map((r) => Object.fromEntries(d.columns.map((c, i) => [c, r[i]])) as unknown as Test)
}
export const test = (id: string) => j<TestDetail>('/tests/' + encodeURIComponent(id))
