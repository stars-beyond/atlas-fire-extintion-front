// The chart builder's configuration: labels, the default for a data set, and the checks on a saved one.
import { describe, expect, it } from 'vitest'
import type { ChartConfig, Dataset, VarDef } from '../../types'
import { CHART_TYPES, defaultConfig, isChartConfig, mismatch, TYPE_LABEL, unit } from './chartConfig'

const v = (key: string, label = key, u?: string): VarDef => ({ key, label, unit: u, column: key, n: 10 })
const flex: Dataset = {
  id: 'flex', label: 'FLEX droplets', investigation: 'FLEX', psi: 'PSI-69', rows: 100, files: ['flex.csv'],
  numeric: [v('diameter_mm', 'Droplet diameter', 'mm'), v('o2_pct', 'Initial O₂', '%'), v('k_mm2_s', 'Burning rate', 'mm²/s'), v('pressure_psi', 'Pressure', 'psi')],
  categorical: [v('fuel', 'Fuel'), v('diluent', 'Diluent'), v('outcome', 'Outcome')],
}
const other: Dataset = { id: 'bass', label: 'BASS-II', investigation: 'BASS-II', psi: 'PSI-25', rows: 5, files: [], numeric: [v('a'), v('b')], categorical: [v('sample')] }
const cfg = (patch: Partial<ChartConfig> = {}): ChartConfig => ({ dataset: 'flex', type: 'scatter', x: 'o2_pct', y: 'k_mm2_s', group: 'diluent', filterKey: '', filterValue: '', bins: 8, ...patch })

describe('unit', () => {
  it('writes "Label (unit)" when the variable has a unit', () => {
    expect(unit({ label: 'Initial O₂', unit: '%' })).toBe('Initial O₂ (%)')
  })
  it('writes only the label when there is no unit', () => {
    expect(unit({ label: 'Fuel' })).toBe('Fuel')
    expect(unit({ label: 'Fuel', unit: '' })).toBe('Fuel')
    expect(unit({ label: 'Fuel', unit: undefined })).toBe('Fuel')
  })
  it('is empty for a variable that does not exist', () => {
    expect(unit()).toBe('')
    expect(unit(undefined)).toBe('')
  })
})

describe('chart types', () => {
  it('has a label for every chart type', () => {
    expect(Object.keys(TYPE_LABEL).sort()).toEqual([...CHART_TYPES].sort())
    for (const t of CHART_TYPES) expect(TYPE_LABEL[t]).toBeTruthy()
  })
})

describe('defaultConfig', () => {
  it('starts with oxygen on x, the first known measurement on y and the first known grouping', () => {
    expect(defaultConfig(flex)).toEqual({ dataset: 'flex', type: 'scatter', x: 'o2_pct', y: 'k_mm2_s', group: 'diluent', filterKey: '', filterValue: '', bins: 8 })
  })
  it('falls back to the first two numeric variables and no grouping', () => {
    expect(defaultConfig(other)).toMatchObject({ dataset: 'bass', x: 'a', y: 'b', group: '' })
  })
  it('uses the same variable on both axes when there is only one', () => {
    expect(defaultConfig({ ...other, numeric: [v('a')] })).toMatchObject({ x: 'a', y: 'a' })
  })
  it('does not throw on a data set with no variables', () => {
    expect(defaultConfig({ ...other, numeric: [], categorical: [] })).toMatchObject({ x: '', y: '', group: '' })
  })
  it('gives a configuration that is complete and valid for its own data set', () => {
    for (const d of [flex, other]) {
      const c = defaultConfig(d)
      expect(isChartConfig(c)).toBe(true)
      expect(mismatch(c, [flex, other])).toEqual([])
    }
  })
})

describe('isChartConfig', () => {
  it('accepts a complete configuration', () => {
    expect(isChartConfig(cfg())).toBe(true)
    expect(isChartConfig(JSON.parse(JSON.stringify(cfg({ type: 'histogram', bins: 20 }))))).toBe(true)
    expect(isChartConfig(cfg({ bins: 3 }))).toBe(true)
  })
  it.each([
    ['null', null], ['undefined', undefined], ['a string', 'scatter'], ['a number', 8], ['an array', []], ['an empty object', {}],
  ])('rejects %s', (_name, c) => { expect(isChartConfig(c)).toBe(false) })
  it.each(['dataset', 'type', 'x', 'y', 'group', 'filterKey', 'filterValue', 'bins'])('rejects a configuration without "%s"', (k) => {
    const c: Record<string, unknown> = { ...cfg() }
    delete c[k]
    expect(isChartConfig(c)).toBe(false)
  })
  it.each(['dataset', 'type', 'x', 'y', 'group', 'filterKey', 'filterValue'])('rejects "%s" that is not a string', (k) => {
    expect(isChartConfig({ ...cfg(), [k]: 5 })).toBe(false)
    expect(isChartConfig({ ...cfg(), [k]: null })).toBe(false)
    expect(isChartConfig({ ...cfg(), [k]: ['x'] })).toBe(false)
  })
  it.each([['below 3', 2], ['above 20', 21], ['a string', '8'], ['null', null], ['NaN', NaN], ['Infinity', Infinity], ['negative', -8]])('rejects bins %s', (_name, bins) => {
    expect(isChartConfig({ ...cfg(), bins })).toBe(false)
  })
  it('checks the shape only: an unknown chart type or variable is for mismatch() to report', () => {
    expect(isChartConfig(cfg({ type: 'pie' as ChartConfig['type'], x: 'gone' }))).toBe(true)
  })
})

describe('mismatch', () => {
  const all = [flex, other]
  it('is empty for a configuration that can be drawn', () => {
    expect(mismatch(cfg(), all)).toEqual([])
    expect(mismatch(cfg({ group: '' }), all)).toEqual([])                                   // scatter without grouping
    expect(mismatch(cfg({ type: 'bar', group: 'fuel' }), all)).toEqual([])
    expect(mismatch(cfg({ type: 'histogram', x: '', group: '' }), all)).toEqual([])         // a histogram needs only y
    expect(mismatch(cfg({ filterKey: 'fuel', filterValue: 'heptane' }), all)).toEqual([])
  })
  it('reports a data set the API no longer publishes, and nothing else', () => {
    expect(mismatch(cfg({ dataset: 'gone', x: 'nope', y: 'nope' }), all)).toEqual(['the data set "gone" is no longer published by the API'])
    expect(mismatch(cfg(), [])).toEqual(['the data set "flex" is no longer published by the API'])
  })
  it('reports a variable that left the data set', () => {
    expect(mismatch(cfg({ y: 'gone' }), all)).toEqual(['variable "gone" is no longer in FLEX droplets'])
    expect(mismatch(cfg({ x: 'gone' }), all)).toEqual(['variable "gone" is no longer in FLEX droplets'])
    expect(mismatch(cfg({ x: 'gone_x', y: 'gone_y' }), all)).toEqual(['variable "gone_y" is no longer in FLEX droplets', 'variable "gone_x" is no longer in FLEX droplets'])
  })
  it('does not accept a categorical variable on an axis, or a numeric one as grouping', () => {
    expect(mismatch(cfg({ y: 'fuel' }), all)).toHaveLength(1)
    expect(mismatch(cfg({ group: 'o2_pct' }), all)).toEqual(['grouping "o2_pct" is no longer in FLEX droplets'])
  })
  it('ignores x for bars and histograms', () => {
    expect(mismatch(cfg({ type: 'bar', x: 'gone', group: 'fuel' }), all)).toEqual([])
    expect(mismatch(cfg({ type: 'histogram', x: 'gone' }), all)).toEqual([])
  })
  it('requires a grouping for bars', () => {
    expect(mismatch(cfg({ type: 'bar', group: '' }), all)).toEqual(['a bar chart needs a grouping variable'])
    expect(mismatch(cfg({ type: 'bar', group: 'gone' }), all)).toEqual(['grouping "gone" is no longer in FLEX droplets'])
  })
  it('reports a scatter grouping that left the data set, and ignores the grouping of a histogram', () => {
    expect(mismatch(cfg({ group: 'gone' }), all)).toEqual(['grouping "gone" is no longer in FLEX droplets'])
    expect(mismatch(cfg({ type: 'histogram', group: 'gone' }), all)).toEqual([])
  })
  it('reports a filter variable that left the data set', () => {
    expect(mismatch(cfg({ filterKey: 'gone', filterValue: 'x' }), all)).toEqual(['filter "gone" is no longer in FLEX droplets'])
  })
  it('reports a chart type this version does not draw', () => {
    expect(mismatch(cfg({ type: 'pie' as ChartConfig['type'] }), all)).toEqual(['chart type "pie" is not supported'])
  })
  it('checks against the data set of the configuration, not the others', () => {
    expect(mismatch(cfg({ dataset: 'bass' }), all)).toEqual(['variable "k_mm2_s" is no longer in BASS-II', 'variable "o2_pct" is no longer in BASS-II', 'grouping "diluent" is no longer in BASS-II'])
  })
  it('lists every problem of a configuration', () => {
    expect(mismatch(cfg({ type: 'bar', y: 'gone', group: '', filterKey: 'gone2' }), all)).toEqual([
      'variable "gone" is no longer in FLEX droplets', 'a bar chart needs a grouping variable', 'filter "gone2" is no longer in FLEX droplets',
    ])
  })
})
