// How the dashboard ties findings, investigations and Next Fire proposals together, and orders the findings.
import { describe, expect, it } from 'vitest'
import type { FireQueue, Insight, Investigation, Proposal } from '../../types'
import {
  FINDING_ORDER, FINDINGS, findingRelation, findingViews, GAP, investigationRelation, KIND, o2Range, proposalFindings, psiIds, psiRange,
  psiUrl, reasonText, sortFindings, touches,
} from './links'

const insight = (id: string, source?: string, data: unknown = null) => ({ id, title: id, finding: `finding ${id}`, source, data }) as Insight
const inv = (id: string, name: string, patch: Partial<Investigation> = {}) => ({ id, name, priority_why: '', stats: { pressure_assumed: false }, ...patch }) as Investigation
const prop = (id: string, kind: Proposal['kind'], closes: string[] = []) => ({ id, kind, closes: closes.map((what) => ({ habitat: 'lua', name: 'Moon', what, label: what })) }) as Proposal
const queue = (ps: Proposal[], available = true) => ({ available, queue: ps }) as FireQueue
const ids = (v: { insight: Insight }[]) => v.map((f) => f.insight.id)

describe('psiIds', () => {
  it('reads the PSI ids of a source line, once each, in order', () => {
    expect(psiIds('BASS-II (PSI-25), Saffire-I and II (PSI-98, PSI-99)')).toEqual(['PSI-25', 'PSI-98', 'PSI-99'])
    expect(psiIds('PSI-98, then PSI-25, then PSI-98 again')).toEqual(['PSI-98', 'PSI-25'])
  })
  it('is empty when the line names none', () => {
    expect(psiIds('')).toEqual([])
    expect(psiIds('ZARM drop tower, PSI- 25, psi-25')).toEqual([])
  })
  it('re-exports psiUrl', () => {
    expect(psiUrl('PSI-25')).toBe('https://psi.nasa.gov/physci/repo/data/investigations/PSI-25')
  })
})

describe('findingViews', () => {
  it('classifies each insight and reads its sources', () => {
    const v = findingViews([
      insight('cobertura', 'BASS-II (PSI-25), Saffire-I and II (PSI-98, PSI-99), BASS-II again (PSI-25)'),
      insight('novidades', 'ingestion log'),
      insight('auto_PSI-321', 'tabulated by the Atlas'),
      insight('something_new', 'CFI-G (PSI-17)'),
    ])
    expect(v.map((f) => f.kind)).toEqual(['chart', 'change', 'auto', 'text'])
    expect(v[0].spec).toBe(FINDINGS.cobertura)
    expect(v[0].sources).toEqual(['PSI-25', 'PSI-98', 'PSI-99'])
    expect(v[1]).toMatchObject({ spec: null, sources: [] })
    expect(v[2]).toMatchObject({ spec: null, sources: ['PSI-321'] })   // an auto card names its investigation in its id
    expect(v[3]).toMatchObject({ spec: null, sources: ['PSI-17'] })
  })
  it('keeps the insight itself and the API order', () => {
    const list = [insight('b'), insight('cobertura'), insight('a')]
    const v = findingViews(list)
    expect(ids(v)).toEqual(['b', 'cobertura', 'a'])
    expect(v[1].insight).toBe(list[1])
  })
  it('puts the investigation of an auto card first and does not repeat it', () => {
    expect(findingViews([insight('auto_PSI-321', 'PSI-7 and PSI-321')])[0].sources).toEqual(['PSI-321', 'PSI-7'])
  })
  it('accepts an insight without a source line', () => {
    expect(findingViews([insight('x', undefined), { ...insight('y'), source: null as unknown as string }]).map((f) => f.sources)).toEqual([[], []])
  })
  it('drops entries that are not insights', () => {
    const junk = [null, undefined, { title: 'no id' }, { id: 5 }, insight('ok')] as unknown as Insight[]
    expect(ids(findingViews(junk))).toEqual(['ok'])
  })
  it('lists in FINDING_ORDER exactly the findings it knows how to draw', () => {
    expect([...FINDING_ORDER].sort()).toEqual(Object.keys(FINDINGS).sort())
  })
})

describe('sortFindings', () => {
  const views = findingViews([
    insight('text_1', 'FLEX (PSI-69)'), insight('cfig_ignicao', 'CFI-G (PSI-17)'), insight('auto_PSI-321'), insight('novidades'),
    insight('cobertura', 'BASS-II (PSI-25)'), insight('text_2'), insight('flex_desfecho', 'FLEX (PSI-69)'),
  ])
  const family: Record<string, string> = { 'PSI-69': 'gota', 'PSI-25': 'solido', 'PSI-17': 'gas' }
  const familyOf = (id: string) => family[id]
  const before = ids(views)

  it('api: exactly the order the API sent', () => {
    expect(sortFindings(views, 'api', 'gota', familyOf)).toBe(views)
  })
  it('curated: the change card, the charted findings in FINDING_ORDER, then the rest as the API sent them', () => {
    expect(ids(sortFindings(views, 'curated', 'gota', familyOf))).toEqual(['novidades', 'cobertura', 'flex_desfecho', 'cfig_ignicao', 'text_1', 'auto_PSI-321', 'text_2'])
  })
  it('fuel: findings about the fuel family of the scenario first, each part in curated order', () => {
    expect(ids(sortFindings(views, 'fuel', 'gota', familyOf))).toEqual(['flex_desfecho', 'text_1', 'novidades', 'cobertura', 'cfig_ignicao', 'auto_PSI-321', 'text_2'])
    expect(ids(sortFindings(views, 'fuel', 'solido', familyOf))).toEqual(['cobertura', 'novidades', 'flex_desfecho', 'cfig_ignicao', 'text_1', 'auto_PSI-321', 'text_2'])
  })
  it('fuel with every family ("todas"), or with a family no finding is about: the curated order', () => {
    const curated = ids(sortFindings(views, 'curated', 'todas', familyOf))
    expect(ids(sortFindings(views, 'fuel', 'todas', familyOf))).toEqual(curated)
    expect(ids(sortFindings(views, 'fuel', 'fumaca', familyOf))).toEqual(curated)
    expect(ids(sortFindings(views, 'fuel', 'gota', () => undefined))).toEqual(curated)
  })
  it('does not change the list it was given', () => {
    sortFindings(views, 'curated', 'gota', familyOf); sortFindings(views, 'fuel', 'gota', familyOf)
    expect(ids(views)).toEqual(before)
  })
  it('handles an empty list', () => {
    expect(sortFindings([], 'curated', 'gota', familyOf)).toEqual([])
    expect(sortFindings([], 'fuel', 'gota', familyOf)).toEqual([])
  })
})

describe('touches', () => {
  it('is true when the proposal is a test of that factor', () => {
    expect(touches(prop('p', 'gravidade'), ['gravidade'])).toBe(true)
    expect(touches(prop('p', 'pressao'), ['oxigenio', 'pressao'])).toBe(true)
  })
  it('is true when the proposal closes a caveat of that factor', () => {
    expect(touches(prop('p', 'habitat', ['oxigenio', 'gravidade']), ['gravidade'])).toBe(true)
  })
  it('is false otherwise', () => {
    expect(touches(prop('p', 'gravidade'), ['oxigenio', 'pressao'])).toBe(false)
    expect(touches(prop('p', 'curva', ['pressao']), ['gravidade'])).toBe(false)
    expect(touches(prop('p', 'gravidade', ['gravidade']), [])).toBe(false)
  })
})

describe('findingRelation', () => {
  const [cobertura, saffire, flex, text] = findingViews([
    insight('cobertura', 'BASS-II (PSI-25), Saffire (PSI-98)'), insight('saffire_gravidade', 'Saffire-II (PSI-99)'), insight('flex_desfecho', 'FLEX (PSI-69)'), insight('text', 'BASS-II (PSI-25)'),
  ])
  const q = queue([prop('p-o2', 'oxigenio'), prop('p-g', 'gravidade'), prop('p-hab', 'habitat', ['pressao']), prop('p-curve', 'curva')])

  it('says so when the queue is missing or unavailable', () => {
    for (const none of [null, queue([prop('p-o2', 'oxigenio')], false)]) {
      expect(findingRelation(cobertura, none, 'PSI-25', 'BASS-II')).toEqual({ level: 'none', proposals: [], text: 'The Next Fire queue is not available, so no proposal can be matched.' })
    }
  })
  it('direct: proposals about the factors of the finding, when the boundary comes from one of its sources', () => {
    const r = findingRelation(cobertura, q, 'PSI-25', 'BASS-II')
    expect(r.level).toBe('direct')
    expect(r.proposals).toEqual(['p-o2', 'p-hab'])
    expect(r.text).toBe("2 proposed experiments address oxygen above tested and pressure off tested. They extend BASS-II, one of this finding's sources, and apply to the acrylic rod only.")
  })
  it('same-factor: proposals about the same factor, on another investigation', () => {
    const r = findingRelation(saffire, q, 'PSI-25', 'BASS-II')
    expect(r.level).toBe('same-factor')
    expect(r.proposals).toEqual(['p-g'])
    expect(r.text).toBe('1 proposed experiment varies the same factor (gravity), but on the BASS-II acrylic rod. None of them re-tests the samples of this finding.')
  })
  it('same-factor when the boundary has no investigation', () => {
    expect(findingRelation(cobertura, q, null, 'BASS-II')).toMatchObject({ level: 'same-factor', proposals: ['p-o2', 'p-hab'] })
  })
  it('writes the singular and the plural', () => {
    expect(findingRelation(cobertura, queue([prop('p-o2', 'oxigenio')]), 'PSI-25', 'BASS-II').text).toMatch(/^1 proposed experiment addresses /)
    expect(findingRelation(saffire, queue([prop('a', 'gravidade'), prop('b', 'gravidade')]), 'PSI-25', 'BASS-II').text).toMatch(/^2 proposed experiments vary /)
  })
  it('none: a finding about no factor the queue tracks, even from the same investigation', () => {
    const none = { level: 'none', proposals: [], text: 'No proposal. The queue is derived only from the published BASS-II acrylic-rod boundary; the current methodology does not model gaps for this kind of experiment.' }
    expect(findingRelation(flex, q, 'PSI-69', 'BASS-II')).toEqual(none)
    expect(findingRelation(text, q, 'PSI-25', 'BASS-II')).toEqual(none)   // no description, so no known factors
  })
  it('none: no proposal in the queue is about the factors of the finding', () => {
    expect(findingRelation(saffire, queue([prop('p-o2', 'oxigenio'), prop('p-curve', 'curva')]), 'PSI-99', 'Saffire-II').level).toBe('none')
    expect(findingRelation(cobertura, queue([]), 'PSI-25', 'BASS-II').level).toBe('none')
  })
})

describe('investigationRelation', () => {
  const q = queue([prop('p1', 'oxigenio'), prop('p2', 'gravidade'), prop('p3', 'curva')])
  it('says so when the queue is missing or unavailable', () => {
    expect(investigationRelation(inv('PSI-25', 'BASS-II'), null, 'PSI-25', 'BASS-II')).toEqual({ level: 'none', proposals: [], text: 'The Next Fire queue is not available.' })
    expect(investigationRelation(inv('PSI-25', 'BASS-II'), queue([], false), 'PSI-25', 'BASS-II').level).toBe('none')
  })
  it('direct: every proposal extends the investigation behind the boundary', () => {
    expect(investigationRelation(inv('PSI-25', 'BASS-II'), q, 'PSI-25', 'BASS-II')).toEqual({
      level: 'direct', proposals: ['p1', 'p2', 'p3'],
      text: 'All 3 proposed experiments extend this investigation: they start from its published acrylic-rod boundary and change one factor at a time.',
    })
  })
  it('none for any other investigation, or when the boundary has no investigation', () => {
    expect(investigationRelation(inv('PSI-99', 'Saffire-II'), q, 'PSI-25', 'BASS-II')).toEqual({
      level: 'none', proposals: [], text: 'No proposal uses Saffire-II data. The queue is derived only from the published BASS-II acrylic-rod boundary.',
    })
    expect(investigationRelation(inv('PSI-25', 'BASS-II'), q, null, 'BASS-II').level).toBe('none')
  })
})

describe('proposalFindings', () => {
  const shown = findingViews([insight('cobertura'), insight('saffire_gravidade'), insight('flex_desfecho'), insight('text')])
  it('lists the findings about a factor the proposal changes', () => {
    expect(proposalFindings(prop('p', 'oxigenio'), shown)).toEqual(['cobertura'])
    expect(proposalFindings(prop('p', 'gravidade'), shown)).toEqual(['saffire_gravidade'])
    expect(proposalFindings(prop('p', 'habitat', ['pressao', 'gravidade']), shown)).toEqual(['cobertura', 'saffire_gravidade'])
  })
  it('is empty for a proposal about no tracked factor, and never lists findings without factors', () => {
    expect(proposalFindings(prop('p', 'curva'), shown)).toEqual([])
    expect(proposalFindings(prop('p', 'modelo'), shown)).toEqual([])
    expect(proposalFindings(prop('p', 'gravidade'), [])).toEqual([])
  })
})

describe('finding descriptions (FINDINGS)', () => {
  it('has a label for every gap and proposal kind', () => {
    expect(Object.keys(GAP).sort()).toEqual(['gravidade', 'oxigenio', 'pressao'])
    expect(Object.keys(KIND).sort()).toEqual(['curva', 'gravidade', 'habitat', 'modelo', 'oxigenio', 'pressao'])
  })
  it('does not throw when the data of a finding is missing or has another shape', () => {
    for (const spec of Object.values(FINDINGS)) for (const data of [null, undefined, {}, [], 'text', 5]) {
      expect(typeof spec.n(data)).toBe('string')
      expect(typeof spec.reading(data, [])).toBe('string')
      expect(spec.limits(data, []).every((l) => typeof l === 'string' && l.length > 0)).toBe(true)
    }
  })
  it('cobertura: counts per family, and says when pressure is assumed', () => {
    const d = [{ family: 'solido', n: 1234 }, { family: 'gota', n: 56 }, { family: 'nova', n: 1 }]
    expect(FINDINGS.cobertura.n(d)).toBe('Solids n = 1,234 · Droplets n = 56 · nova n = 1')
    expect(FINDINGS.cobertura.reading(d, [])).toContain('(n = 1,234)')
    const src = [inv('PSI-25', 'BASS-II'), inv('PSI-98', 'Saffire-I', { stats: { pressure_assumed: true } as Investigation['stats'] })]
    expect(FINDINGS.cobertura.reading(d, src)).toContain('Pressure was not recorded per test for Saffire-I')
    expect(FINDINGS.cobertura.reading(d, [src[0]])).not.toContain('Pressure was not recorded')
    expect(FINDINGS.cobertura.limits(d, src)).toHaveLength(3)
    expect(FINDINGS.cobertura.limits(d, [src[0]])).toHaveLength(2)
  })
  it('saffire_gravidade: counts the pairs', () => {
    expect(FINDINGS.saffire_gravidade.n([{}, {}, {}])).toBe('3 paired samples')
    expect(FINDINGS.saffire_gravidade.limits([{}, {}, {}], [])[0]).toMatch(/^3 pairs, one flight/)
  })
  it('flex_desfecho: adds the tests of the groups and counts the points with a burning rate', () => {
    const d = { groups: [{ n: 1000 }, { n: 500 }], points: [{}, {}, {}] }
    expect(FINDINGS.flex_desfecho.n(d)).toBe('1,500 tests · K tabulated in 3')
    expect(FINDINGS.flex_desfecho.n({ groups: [{ n: 2 }] })).toBe('2 tests · K tabulated in 0')
    expect(FINDINGS.flex_desfecho.limits(d, [])[0]).toBe('K is tabulated in 3 of 1,500 tests; the others enter the outcome shares only.')
    expect(FINDINGS.flex_desfecho.limits({ groups: [{ n: 2 }] }, [])).toHaveLength(2)
  })
  it('cfig_ignicao: says when the ignition share does not rise at every step', () => {
    const rising = [{ n: 5, ignition: 0.2 }, { n: 40, ignition: 0.5 }, { n: 12, ignition: 0.9 }]
    const dips = [{ n: 5, ignition: 0.2 }, { n: 40, ignition: 0.1 }, { n: 12, ignition: 0.9 }]
    expect(FINDINGS.cfig_ignicao.n(rising)).toBe('57 tests in 3 bands')
    expect(FINDINGS.cfig_ignicao.reading(rising, [])).not.toContain('does not rise at every step')
    expect(FINDINGS.cfig_ignicao.reading(dips, [])).toContain('does not rise at every step')
    expect(FINDINGS.cfig_ignicao.limits(rising, [])).toHaveLength(4)
    expect(FINDINGS.cfig_ignicao.limits(dips, [])).toHaveLength(5)
    expect(FINDINGS.cfig_ignicao.limits(rising, [])[1]).toBe('Band sizes are uneven (n from 5 to 40), so the shares do not carry the same weight.')
  })
})

describe('o2Range and psiRange', () => {
  it('writes a range, or one value when the two ends are the same', () => {
    expect(o2Range([0.18, 0.3])).toBe('18%–30%')
    expect(o2Range([0.21, 0.21])).toBe('21%')
    expect(o2Range([0.209, 0.345])).toBe('20.9%–34.5%')
    expect(psiRange([0.5, 1])).toBe('7.3–14.7 psi')
    expect(psiRange([1, 1])).toBe('14.7 psi')
    expect(psiRange([1, 1 + 1e-9])).toBe('14.7 psi')
  })
  it('is null when the investigation has no range', () => {
    expect(o2Range(null)).toBeNull()
    expect(o2Range(undefined)).toBeNull()
    expect(psiRange(null)).toBeNull()
    expect(psiRange(undefined)).toBeNull()
  })
})

describe('reasonText', () => {
  it('writes the reason as a sentence', () => {
    expect(reasonText('closest tests in oxygen; same fuel family', undefined)).toBe('Closest tests in oxygen; same fuel family.')
    expect(reasonText('  closest tests in oxygen.  ', inv('PSI-25', 'BASS-II'))).toBe('Closest tests in oxygen.')
  })
  it('cuts the catalog note from the end, whatever its case', () => {
    const v = inv('PSI-25', 'BASS-II', { priority_why: 'Nota do catálogo em português' })
    expect(reasonText('closest tests in oxygen; same fuel family; nota do catálogo em português.', v)).toBe('Closest tests in oxygen; same fuel family.')
    expect(reasonText('closest tests in oxygen; NOTA DO CATÁLOGO EM PORTUGUÊS', v)).toBe('Closest tests in oxygen.')
  })
  it('keeps the note when it is not at the end', () => {
    const v = inv('PSI-25', 'BASS-II', { priority_why: 'nota' })
    expect(reasonText('nota; closest tests in oxygen', v)).toBe('Nota; closest tests in oxygen.')
  })
  it('is empty when there is no reason, or the reason is only the catalog note', () => {
    expect(reasonText('', undefined)).toBe('')
    expect(reasonText('   ', inv('PSI-25', 'BASS-II'))).toBe('')
    expect(reasonText('Nota do catálogo.', inv('PSI-25', 'BASS-II', { priority_why: 'nota do catálogo' }))).toBe('')
  })
})
