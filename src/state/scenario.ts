// O cenário fora do React: comparar dois cenários e guardá-lo na aba (sessionStorage) para sobreviver ao F5.
import type { Family, Scenario } from '../types'

const EPS = 1e-6   // folga para o mesmo número que passou por um controle deslizante ou pelo JSON

/** O mesmo cenário para a evidência? Compara os campos que o identificam, os números com folga. */
export function sameScenario(a: Scenario | null | undefined, b: Scenario): boolean {
  return !!a && Math.abs(a.o2 - b.o2) < EPS && Math.abs(a.pressure_atm - b.pressure_atm) < EPS && Math.abs(a.gravity - b.gravity) < EPS
    && a.family === b.family && (a.material || '') === (b.material || '') && (a.habitat || '') === (b.habitat || '')
}

const KEY = 'atlas.scenario'
const FAMILIES: readonly string[] = ['solido', 'gota', 'gas', 'todas'] satisfies Family[]
// as mesmas faixas que a API aceita (Scenario.Clean no backend): fora delas o valor guardado não é deste app
const num = (v: unknown, min: number, max: number): v is number => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max
// códigos curtos (material, habitat), sem caracteres de controle
const code = (v: unknown): v is string => typeof v === 'string' && v.length <= 64 && !/[\u0000-\u001f\u007f]/.test(v)

/** O cenário guardado nesta aba, ou null. Um campo de tipo errado ou fora de faixa descarta o cenário inteiro:
    metade de um cenário (o habitat de um, o ar de outro) seria pior do que voltar ao padrão. */
export function loadScenario(): Scenario | null {
  try {
    const raw: unknown = JSON.parse(sessionStorage.getItem(KEY) ?? 'null')
    if (!raw || typeof raw !== 'object') return null
    const { o2, pressure_atm, gravity, family, material, habitat = '' } = raw as Record<string, unknown>
    if (!num(o2, 0.01, 1) || !num(pressure_atm, 0.1, 6) || !num(gravity, 0, 1)) return null
    if (typeof family !== 'string' || !FAMILIES.includes(family) || !code(material) || !code(habitat)) return null
    return { o2, pressure_atm, gravity, family: family as Family, material, habitat }
  } catch { return null }   // armazenamento bloqueado ou texto que não é JSON
}

export function saveScenario(s: Scenario) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ o2: s.o2, pressure_atm: s.pressure_atm, gravity: s.gravity, family: s.family, material: s.material || '', habitat: s.habitat || '' }))
  } catch { /* armazenamento indisponível ou cheio: o cenário só não sobrevive ao F5 */ }
}
