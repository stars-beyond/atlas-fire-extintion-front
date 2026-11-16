// Number, percentage and label formatting used all over the UI.
import { describe, expect, it } from 'vitest'
import { FAMILY, FAMILY_COLOR, fmtDate, gLabel, nf, OUTCOME, pct, plain, psi, TIER, TIER_API_LABEL } from './format'

describe('nf', () => {
  it('formats with thousands separators and no decimals by default', () => {
    expect(nf(0)).toBe('0')
    expect(nf(1234)).toBe('1,234')
    expect(nf(1234567.2)).toBe('1,234,567')
  })
  it('uses exactly the number of decimals asked for', () => {
    expect(nf(1234.56, 1)).toBe('1,234.6')
    expect(nf(2, 2)).toBe('2.00')
    expect(nf(0.126, 2)).toBe('0.13')
    expect(nf(-3.14159, 3)).toBe('-3.142')
  })
})

describe('pct', () => {
  it('shows a fraction as a whole percentage when it is (almost) whole', () => {
    expect(pct(0.21)).toBe('21%')
    expect(pct(0.3)).toBe('30%')     // 0.3 * 100 is 30.000000000000004
    expect(pct(1)).toBe('100%')
    expect(pct(0)).toBe('0%')
    expect(pct(0.2104)).toBe('21%')  // less than 0.05 away from a whole number
  })
  it('shows one decimal otherwise', () => {
    expect(pct(0.215)).toBe('21.5%')
    expect(pct(0.1672)).toBe('16.7%')
    expect(pct(0.2094)).toBe('20.9%')
  })
  it('uses the decimals asked for, when given', () => {
    expect(pct(0.21, 1)).toBe('21.0%')
    expect(pct(0.21456, 2)).toBe('21.46%')
    expect(pct(0.216, 0)).toBe('22%')
  })
})

describe('psi', () => {
  it('converts atmospheres to psi with one decimal', () => {
    expect(psi(1)).toBe('14.7 psi')
    expect(psi(0.56)).toBe('8.2 psi')
    expect(psi(0)).toBe('0.0 psi')
  })
})

describe('gLabel', () => {
  it('names microgravity and Earth gravity without decimals', () => {
    expect(gLabel(0)).toBe('0 g')
    expect(gLabel(0.05)).toBe('0 g')
    expect(gLabel(1)).toBe('1 g')
    expect(gLabel(0.95)).toBe('1 g')
  })
  it('shows partial gravity with two decimals', () => {
    expect(gLabel(0.166)).toBe('0.17 g')
    expect(gLabel(0.38)).toBe('0.38 g')
    expect(gLabel(0.06)).toBe('0.06 g')
  })
})

describe('fmtDate', () => {
  it('formats a date in the locale of the UI', () => {
    expect(fmtDate(new Date(2026, 0, 5))).toBe('1/5/2026')
  })
})

describe('plain', () => {
  it('drops the tier prefix the seal already shows and capitalises the rest', () => {
    expect(plain('Medido: existe um teste nesta condição')).toBe('Existe um teste nesta condição')
    expect(plain('Terra incógnita: no test here')).toBe('No test here')
  })
  it('only capitalises a sentence with no prefix', () => {
    expect(plain('no test here')).toBe('No test here')
    expect(plain('')).toBe('')
  })
  it('keeps a colon that is not a short prefix', () => {
    expect(plain('a: b')).toBe('A: b')   // fewer than 3 characters before the colon
    expect(plain('this sentence is far too long to be a tier label: really')).toBe('This sentence is far too long to be a tier label: really')
  })
  it('removes only the first prefix', () => {
    expect(plain('Bounded: between 0 g and 1 g: see the tests')).toBe('Between 0 g and 1 g: see the tests')
  })
})

describe('label tables', () => {
  it('has a label for every tier, in both tables', () => {
    const tiers = ['medido', 'delimitado', 'parcial', 'sem_evidencia'] as const
    for (const t of tiers) {
      expect(TIER[t].label).toBeTruthy()
      expect(TIER[t].short).toBeTruthy()
      expect(TIER_API_LABEL[t]).toBeTruthy()
    }
    expect(Object.keys(TIER).sort()).toEqual([...tiers].sort())
  })
  it('has a colour for each fuel family that has tests', () => {
    for (const f of ['solido', 'gota', 'gas']) {
      expect(FAMILY[f]).toBeTruthy()
      expect(FAMILY_COLOR[f]).toBe(`var(--${f})`)
    }
  })
  it('has a label for every outcome code of the API', () => {
    expect(Object.keys(OUTCOME).sort()).toEqual(['desconhecido', 'disrupcao', 'extinguiu', 'nao_acendeu', 'queimou'])
  })
})
