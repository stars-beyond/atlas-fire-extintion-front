// Scales of the hand-drawn SVG charts.
import { describe, expect, it } from 'vitest'
import { lin, logScale } from './scale'

describe('lin', () => {
  it('maps the ends of the domain to the ends of the range', () => {
    const x = lin(0, 10, 100, 300)
    expect(x(0)).toBe(100)
    expect(x(10)).toBe(300)
    expect(x(5)).toBe(200)
  })
  it('works with an inverted range (SVG y grows downwards)', () => {
    const y = lin(0, 1.2, 190, 14)
    expect(y(0)).toBe(190)
    expect(y(1.2)).toBeCloseTo(14, 10)
    expect(y(0.6)).toBeCloseTo(102, 10)
  })
  it('works with a domain that does not start at zero', () => {
    const x = lin(0.1, 0.36, 40, 300)
    expect(x(0.1)).toBeCloseTo(40, 10)
    expect(x(0.36)).toBeCloseTo(300, 10)
    expect(x(0.23)).toBeCloseTo(170, 10)
  })
  it('extrapolates outside the domain instead of clamping', () => {
    const x = lin(0, 10, 0, 100)
    expect(x(-5)).toBe(-50)
    expect(x(20)).toBe(200)
  })
})

describe('logScale', () => {
  it('maps the ends of the domain to the ends of the range', () => {
    const x = logScale(1, 100, 0, 200)
    expect(x(1)).toBeCloseTo(0, 10)
    expect(x(100)).toBeCloseTo(200, 10)
  })
  it('places each decade at the same distance', () => {
    const x = logScale(1, 1000, 0, 300)
    expect(x(10)).toBeCloseTo(100, 10)
    expect(x(100)).toBeCloseTo(200, 10)
    expect(x(10) - x(1)).toBeCloseTo(x(1000) - x(100), 10)
  })
  it('works with an inverted range', () => {
    const y = logScale(0.1, 10, 200, 0)
    expect(y(0.1)).toBeCloseTo(200, 10)
    expect(y(1)).toBeCloseTo(100, 10)
    expect(y(10)).toBeCloseTo(0, 10)
  })
})
