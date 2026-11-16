// Formatação do modo história (versão em inglês do format.ts do mission-fire-engine).
import { TIER } from '../../lib/format'
import type { Severity, Tier } from './mfe'

const nf = (d: number) => new Intl.NumberFormat('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
export const num = (v: number | null | undefined, d = 1) => (v == null || !Number.isFinite(v) ? '—' : nf(d).format(v))
export const celsius = (k: number, d = 1) => `${num(k - 273.15, d)} °C`

// the evidence levels carry the same names as in the rest of the Atlas (the seal), so one level never has two names
export const TIER_LABEL: Record<Tier, string> = { medido: TIER.medido.label, delimitado: TIER.delimitado.label, parcial: TIER.parcial.label, sem_evidencia: TIER.sem_evidencia.label }
export const SEVERITY_LABEL: Record<Severity, string> = { info: 'info', atencao: 'warning', critico: 'critical' }
// natureza de cada afirmação: as classes não se misturam
export const CLASS_LABEL: Record<string, string> = {
  hipotese_do_cenario: 'Scenario assumption', calculado: 'Computed by the engine', evidencia: 'Archive evidence',
  prototipo: 'lab3d prototype (not calibrated)', configuracao: 'Mission configuration',
  modelo: 'Predicted by a trained model (Atlas)',
}
const ML_DOMAIN_SHORT: Record<string, string> = {
  ok: 'in domain', borda: 'domain edge', gravidade: 'out: gravity ≠ µg', o2: 'out: O₂', pressao: 'out: pressure', fluxo: 'out: airflow',
}

/** Razão de propagação prevista em relação à atmosfera nominal, ou o motivo de não haver número. */
export function mlRatioText(ratio: number | null | undefined, domain: string | undefined) {
  if (ratio == null || !Number.isFinite(ratio)) return domain ? ML_DOMAIN_SHORT[domain] ?? 'no prediction' : 'no prediction'
  return `${num(ratio, 2)}× nominal`
}
export function mlTone(ratio: number | null | undefined): 'ok' | 'warn' | 'crit' | undefined {
  if (ratio == null || !Number.isFinite(ratio)) return undefined
  return ratio >= 2 ? 'crit' : ratio >= 1.5 ? 'warn' : undefined
}

export function gravity(g: number) {
  if (g < 0.001) return '≈ 1 µg (free fall)'
  return `${num(g, 3)} g`
}

/** Índice da amostra mais próxima de um dia. */
export function indexAt(t: number[], d: number) {
  let lo = 0, hi = t.length - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (t[mid] < d) lo = mid; else hi = mid
  }
  return Math.abs(t[lo] - d) <= Math.abs(t[hi] - d) ? lo : hi
}
