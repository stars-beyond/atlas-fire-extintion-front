// O cenário fora do React: comparação (sameScenario) e o que fica guardado na aba (loadScenario/saveScenario).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Scenario } from '../types'
import { loadScenario, sameScenario, saveScenario } from './scenario'

const KEY = 'atlas.scenario'
const base: Scenario = { o2: 0.21, pressure_atm: 1, gravity: 0, family: 'solido', material: 'pmma', habitat: 'iss' }

// sessionStorage não existe no Node: um substituto em memória, só com o que o módulo usa.
let store: Map<string, string>
beforeEach(() => {
  store = new Map()
  vi.stubGlobal('sessionStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, String(v)) },
  })
})
afterEach(() => { vi.unstubAllGlobals() })
const stored = (v: unknown) => { store.set(KEY, typeof v === 'string' ? v : JSON.stringify(v)) }

describe('sameScenario', () => {
  it('é o mesmo quando todos os campos batem', () => {
    expect(sameScenario(base, { ...base })).toBe(true)
  })
  it('sem cenário anterior não é o mesmo', () => {
    expect(sameScenario(null, base)).toBe(false)
    expect(sameScenario(undefined, base)).toBe(false)
  })
  it('tolera a diferença de arredondamento de um número que passou pelo controle ou pelo JSON', () => {
    expect(sameScenario({ ...base, o2: 0.1 + 0.2 }, { ...base, o2: 0.3 })).toBe(true)
    expect(sameScenario({ ...base, pressure_atm: 1 + 1e-9 }, base)).toBe(true)
    expect(sameScenario({ ...base, gravity: 1e-7 }, base)).toBe(true)
  })
  it.each<[string, Partial<Scenario>]>([
    ['o2', { o2: 0.211 }], ['pressure_atm', { pressure_atm: 1.001 }], ['gravity', { gravity: 0.001 }], ['gravity', { gravity: 1 }],
    ['family', { family: 'gota' }], ['material', { material: 'sibal' }], ['habitat', { habitat: 'lua' }],
  ])('não é o mesmo quando muda %s', (_campo, patch) => {
    expect(sameScenario(base, { ...base, ...patch })).toBe(false)
    expect(sameScenario({ ...base, ...patch }, base)).toBe(false)
  })
  it('material e habitat vazios ou ausentes são a mesma coisa', () => {
    const a = { o2: 0.21, pressure_atm: 1, gravity: 0, family: 'gas', material: '' } satisfies Scenario
    expect(sameScenario(a, { ...a, habitat: '' })).toBe(true)
    expect(sameScenario({ ...a, habitat: undefined }, { ...a, habitat: '' })).toBe(true)
    expect(sameScenario({ ...a, material: undefined as unknown as string }, a)).toBe(true)
  })
})

describe('loadScenario', () => {
  it('nada guardado: null', () => {
    expect(loadScenario()).toBeNull()
  })
  it('devolve o cenário guardado', () => {
    stored(base)
    expect(loadScenario()).toEqual(base)
  })
  it('habitat ausente vira vazio', () => {
    stored({ o2: 0.3, pressure_atm: 0.56, gravity: 0.166, family: 'gota', material: '' })
    expect(loadScenario()).toEqual({ o2: 0.3, pressure_atm: 0.56, gravity: 0.166, family: 'gota', material: '', habitat: '' })
  })
  it('aceita os valores nas pontas das faixas', () => {
    stored({ ...base, o2: 0.01, pressure_atm: 0.1, gravity: 0 })
    expect(loadScenario()).toMatchObject({ o2: 0.01, pressure_atm: 0.1, gravity: 0 })
    stored({ ...base, o2: 1, pressure_atm: 6, gravity: 1 })
    expect(loadScenario()).toMatchObject({ o2: 1, pressure_atm: 6, gravity: 1 })
  })
  it.each(['solido', 'gota', 'gas', 'todas'])('aceita a família %s', (family) => {
    stored({ ...base, family })
    expect(loadScenario()?.family).toBe(family)
  })
  it('só devolve os campos do cenário, não o que mais estiver guardado', () => {
    stored(JSON.stringify({ ...base, extra: 'x', question: 'texto de uma pergunta' }).replace(/}$/, ',"__proto__":{"polluted":true}}'))
    const s = loadScenario()
    expect(s).toEqual(base)
    expect(Object.keys(s!).sort()).toEqual(['family', 'gravity', 'habitat', 'material', 'o2', 'pressure_atm'])
    expect((s as unknown as Record<string, unknown>).polluted).toBeUndefined()
  })

  it.each<[string, string]>([
    ['texto que não é JSON', '{o2: 0.21'], ['texto vazio', ''], ['null', 'null'], ['um número', '42'], ['um texto', '"solido"'],
    ['uma lista', '[0.21, 1, 0]'], ['um objeto vazio', '{}'], ['true', 'true'],
  ])('descarta o que não é um cenário: %s', (_nome, raw) => {
    stored(raw)
    expect(loadScenario()).toBeNull()
  })

  it.each<[string, Record<string, unknown>]>([
    ['o2 abaixo da faixa', { o2: 0 }], ['o2 negativo', { o2: -0.2 }], ['o2 acima da faixa (em %, não fração)', { o2: 21 }], ['o2 pouco acima de 1', { o2: 1.01 }],
    ['o2 como texto', { o2: '0.21' }], ['o2 null (NaN e Infinity viram null no JSON)', { o2: null }], ['o2 ausente', { o2: undefined }],
    ['o2 booleano', { o2: true }], ['o2 lista', { o2: [0.21] }],
    ['pressão abaixo da faixa', { pressure_atm: 0.05 }], ['pressão zero', { pressure_atm: 0 }], ['pressão acima da faixa', { pressure_atm: 6.5 }],
    ['pressão como texto', { pressure_atm: '1' }], ['pressão ausente', { pressure_atm: undefined }],
    ['gravidade negativa', { gravity: -0.1 }], ['gravidade acima de 1 g', { gravity: 1.2 }], ['gravidade como texto', { gravity: '0' }],
    ['gravidade null', { gravity: null }], ['gravidade ausente', { gravity: undefined }],
    ['família desconhecida', { family: 'fumaca' }], ['família em maiúsculas', { family: 'Solido' }], ['família vazia', { family: '' }],
    ['família numérica', { family: 1 }], ['família ausente', { family: undefined }], ['família lista', { family: ['solido'] }],
    ['material numérico', { material: 7 }], ['material null', { material: null }], ['material ausente', { material: undefined }],
    ['material objeto', { material: { id: 'pmma' } }], ['material comprido demais', { material: 'x'.repeat(65) }],
    ['material com quebra de linha', { material: 'pmma\n' }], ['material com caractere nulo', { material: 'pm\u0000ma' }], ['material com DEL', { material: 'pmma\u007f' }],
    ['habitat numérico', { habitat: 3 }], ['habitat null', { habitat: null }], ['habitat comprido demais', { habitat: 'h'.repeat(65) }],
    ['habitat com tabulação', { habitat: 'iss\t' }],
  ])('descarta o cenário inteiro com %s', (_nome, patch) => {
    stored({ ...base, ...patch })
    expect(loadScenario()).toBeNull()
  })

  it('aceita material e habitat com 64 caracteres (o limite)', () => {
    stored({ ...base, material: 'm'.repeat(64), habitat: 'h'.repeat(64) })
    expect(loadScenario()).toMatchObject({ material: 'm'.repeat(64), habitat: 'h'.repeat(64) })
  })
  it('armazenamento bloqueado (getItem lança): null', () => {
    vi.stubGlobal('sessionStorage', { getItem: () => { throw new DOMException('denied', 'SecurityError') } })
    expect(loadScenario()).toBeNull()
  })
  it('sem sessionStorage nenhum: null', () => {
    vi.stubGlobal('sessionStorage', undefined)
    expect(loadScenario()).toBeNull()
  })
})

describe('saveScenario', () => {
  it('guarda só os seis campos do cenário', () => {
    saveScenario({ ...base, extra: 'x' } as Scenario)
    expect(JSON.parse(store.get(KEY)!)).toEqual(base)
  })
  it('material e habitat ausentes são guardados vazios', () => {
    saveScenario({ o2: 0.3, pressure_atm: 0.56, gravity: 0.166, family: 'gas', material: '' })
    expect(JSON.parse(store.get(KEY)!)).toEqual({ o2: 0.3, pressure_atm: 0.56, gravity: 0.166, family: 'gas', material: '', habitat: '' })
  })
  it('o que foi guardado volta igual', () => {
    for (const s of [base, { o2: 0.34, pressure_atm: 0.56, gravity: 0.38, family: 'todas', material: '', habitat: 'marte' } satisfies Scenario]) {
      saveScenario(s)
      const back = loadScenario()
      expect(back).toEqual(s)
      expect(sameScenario(back, s)).toBe(true)
    }
  })
  it('armazenamento cheio ou bloqueado (setItem lança): não lança', () => {
    vi.stubGlobal('sessionStorage', { setItem: () => { throw new DOMException('full', 'QuotaExceededError') } })
    expect(() => saveScenario(base)).not.toThrow()
  })
})
