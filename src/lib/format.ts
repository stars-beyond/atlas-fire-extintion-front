// Formatting (one locale for the whole UI) and the labels the screen uses for API codes.
import type { Tier } from '../types'

export const LOCALE = 'en-US'
export const fmtDate = (d: Date) => d.toLocaleDateString(LOCALE)
export const nf = (v: number, d = 0) => v.toLocaleString(LOCALE, { minimumFractionDigits: d, maximumFractionDigits: d })
export const pct = (f: number, d?: number) => {
  const v = f * 100
  return nf(v, d ?? (Math.abs(v - Math.round(v)) < 0.05 ? 0 : 1)) + '%'
}
export const psi = (atm: number) => nf(atm * 14.696, 1) + ' psi'
export const gLabel = (g: number) => (g <= 0.05 ? '0 g' : g >= 0.95 ? '1 g' : nf(g, 2) + ' g')
export const FAMILY: Record<string, string> = { solido: 'Solids', gota: 'Droplets', gas: 'Gas flames', fumaca: 'Smoke', todas: 'All' }
export const OUTCOME: Record<string, string> = { queimou: 'burned', extinguiu: 'went out', disrupcao: 'droplet burst', nao_acendeu: 'did not ignite', desconhecido: 'not tabulated' }
export const ROLE: Record<string, string> = { prevencao: 'Prevention', deteccao: 'Detection', supressao: 'Suppression', fundamento: 'Fundamentals' }
export const TIER: Record<Tier, { label: string; short: string }> = {
  medido: { label: 'Measured', short: 'A test exists at this condition' },
  delimitado: { label: 'Bounded', short: 'Between 0 g and 1 g' },
  parcial: { label: 'One side only', short: 'Other side missing' },
  sem_evidencia: { label: 'Uncharted', short: 'No test here' },
}
// Tier labels as older API versions write them (Portuguese), to recognise the tier in API text.
export const TIER_API_LABEL: Record<Tier, string> = { medido: 'Medido', delimitado: 'Delimitado', parcial: 'Só um limite', sem_evidencia: 'Terra incógnita' }

// O selo já diz o nível; a frase fica só com a explicação.
export const plain = (h: string) => { const t = h.replace(/^[^:]{3,22}:\s*/, ''); return t.charAt(0).toUpperCase() + t.slice(1) }
