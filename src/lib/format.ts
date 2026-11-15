// Formatação pt-BR e os rótulos que a tela usa para os códigos da API.
import type { Tier } from '../types'

export const nf = (v: number, d = 0) => v.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d })
export const pct = (f: number, d?: number) => {
  const v = f * 100
  return nf(v, d ?? (Math.abs(v - Math.round(v)) < 0.05 ? 0 : 1)) + '%'
}
export const psi = (atm: number) => nf(atm * 14.696, 1) + ' psi'
export const gLabel = (g: number) => (g <= 0.05 ? '0 g' : g >= 0.95 ? '1 g' : nf(g, 2) + ' g')
export const FAMILY: Record<string, string> = { solido: 'Sólidos', gota: 'Gotas', gas: 'Chamas gasosas', fumaca: 'Fumaça', todas: 'Todas' }
export const OUTCOME: Record<string, string> = { queimou: 'queimou', extinguiu: 'apagou', disrupcao: 'gota estourou', nao_acendeu: 'não acendeu', desconhecido: 'não tabelado' }
export const ROLE: Record<string, string> = { prevencao: 'Prevenção', deteccao: 'Detecção', supressao: 'Supressão', fundamento: 'Fundamento' }
export const TIER: Record<Tier, { label: string; short: string }> = {
  medido: { label: 'Medido', short: 'Há teste nesta condição' },
  delimitado: { label: 'Delimitado', short: 'Entre 0 g e 1 g' },
  parcial: { label: 'Só um limite', short: 'Falta o outro lado' },
  sem_evidencia: { label: 'Terra incógnita', short: 'Nenhum teste aqui' },
}

// O selo já diz o nível; a frase fica só com a explicação.
export const plain = (h: string) => { const t = h.replace(/^[^:]{3,22}:\s*/, ''); return t.charAt(0).toUpperCase() + t.slice(1) }
