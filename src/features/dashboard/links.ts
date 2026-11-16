// How the three columns of the dashboard are tied together.
// Every link is read from API data (the PSI ids in a finding's source line, the investigation behind the
// flammability boundary, the caveats each proposal closes). The only thing written by hand here is the
// description of each finding the API computes: what it measures, in which units, and what limits its reading.
import { FAMILY, nf, pct, psi } from '../../lib/format'
import type { FireQueue, Insight, Investigation, Proposal } from '../../types'

export type GapKind = 'gravidade' | 'oxigenio' | 'pressao'
export type Focus = { kind: 'finding' | 'investigation' | 'proposal'; id: string } | null

export const GAP: Record<GapKind, string> = { gravidade: 'gravity', oxigenio: 'oxygen above tested', pressao: 'pressure off tested' }
export const KIND: Record<Proposal['kind'], string> = { gravidade: 'Gravity', oxigenio: 'Oxygen', pressao: 'Pressure', habitat: 'Whole environment', curva: 'Curve check', modelo: 'Asked by the team model' }

// "BASS-II (PSI-25), Saffire-I and II (PSI-98, PSI-99)" -> PSI-25, PSI-98, PSI-99
export const psiIds = (source: string) => [...new Set(source.match(/PSI-\d+/g) ?? [])]
export { psiUrl } from '../../lib/url'

export interface FindingSpec {
  kicker: string                       // what the analysis is, in plain scientific terms
  measure: string                      // quantity and units
  conditions: string                   // which records enter the calculation
  n: (data: any) => string             // number of observations, read from the finding's own data
  variables: GapKind[]                 // factors this finding is about that the Next Fire methodology also tracks
  // what the numbers do and do not establish, shown right under the API's sentence
  reading: (data: any, sources: Investigation[]) => string
  limits: (data: any, sources: Investigation[]) => string[]
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)

// The order is the order of the dashboard. Findings the API returns that are not listed here stay on the
// full Findings page (see Dashboard.tsx for why SPICE soot points are left out of this screen).
export const FINDINGS: Record<string, FindingSpec> = {
  cobertura: {
    kicker: 'Tested oxygen range by fuel family',
    measure: 'Initial O₂ mole fraction (%), minimum to maximum per fuel family; pressure range in psi',
    conditions: 'Records with both O₂ and pressure tabulated ("plot-ready"), all gravities',
    n: (d) => (Array.isArray(d) ? d.map((f) => `${FAMILY[f.family] ?? f.family} n = ${nf(f.n)}`).join(' · ') : ''),
    variables: ['oxigenio', 'pressao'],
    reading: (d, src) => {
      const solid = Array.isArray(d) ? d.find((f) => f.family === 'solido') : null
      const assumed = src.filter((v) => v.stats?.pressure_assumed).map((v) => v.name)
      return `Two populations appear here and they are not the same count. The sentence above counts solid-fuel tests in microgravity only; the chart counts every solid record with O₂ and pressure at any gravity${solid ? ` (n = ${nf(solid.n)})` : ''}.`
        + (assumed.length ? ` Pressure was not recorded per test for ${assumed.join(', ')}: the Atlas assigns cabin pressure, so "at 1 atm" is an assumption, not a measurement.` : '')
    },
    limits: (_d, src) => [
      'A range is not a density: it says where the extremes are, not how many tests sit at each oxygen level.',
      ...(src.some((v) => v.stats.pressure_assumed) ? [`Pressure is not tabulated per test for ${src.filter((v) => v.stats.pressure_assumed).map((v) => v.name).join(', ')}: cabin pressure is assumed.`] : []),
      'Records without tabulated O₂ and pressure are not counted, so an investigation may have burned outside the range shown.',
    ],
  },
  saffire_gravidade: {
    kicker: 'Same samples at 0 g and at 1 g',
    measure: 'Burn outcome as written in the PSI table (burn length in cm, or a qualitative note)',
    conditions: 'Saffire-II flight samples with a ground (1 g) comparison in the same table row',
    n: (d) => (Array.isArray(d) ? `${d.length} paired samples` : ''),
    variables: ['gravidade'],
    reading: (d) => `A paired comparison of ${Array.isArray(d) ? d.length : 'a few'} samples from one flight. It shows that the two gravity levels that were tested, 0 g and 1 g, can end differently for the same sample. It measures nothing at lunar or Martian gravity, and results in between must not be read off it.`,
    limits: (d) => [
      `${Array.isArray(d) ? d.length : 'Few'} pairs, one flight: this is a comparison, not a statistic.`,
      'Only two gravity levels exist in the archive (0 g and 1 g). Nothing here was measured at lunar or Martian gravity.',
      'Outcomes are qualitative entries from the table, classified by a fixed text rule; they are not flame-spread rates.',
    ],
  },
  flex_desfecho: {
    kicker: 'Droplet burning rate and end of burn, by diluent',
    measure: 'Burning-rate constant K (mm²/s) against initial O₂ (%); share of tests by how the burn ended',
    conditions: 'FLEX droplet tests in microgravity, methanol and heptane, diluted with N₂, CO₂ or He',
    n: (d) => (d?.groups ? `${nf(sum(d.groups.map((g: any) => g.n)))} tests · K tabulated in ${nf(d.points?.length ?? 0)}` : ''),
    variables: [],
    reading: () => 'The group means differ, but the groups also differ in droplet diameter, pressure and oxygen level, and nothing here adjusts for that. The data show an association between diluent and mean burning rate. They do not, by themselves, establish that CO₂ slows burning or that helium speeds it up.',
    limits: (d) => [
      ...(d?.groups && d?.points ? [`K is tabulated in ${nf(d.points.length)} of ${nf(sum(d.groups.map((g: any) => g.n)))} tests; the others enter the outcome shares only.`] : []),
      'Group means are not adjusted for droplet diameter, pressure or oxygen level, which differ between groups.',
      'Liquid droplets, two fuels. The result does not transfer to solid cabin materials.',
    ],
  },
  cfig_ignicao: {
    kicker: 'Ignition share by adiabatic flame temperature',
    measure: 'Share of tests that ignited (%), in 200 K bands of adiabatic flame temperature (K)',
    conditions: 'CFI-G gas flames in microgravity with a tabulated outcome and adiabatic temperature',
    n: (d) => (Array.isArray(d) ? `${nf(sum(d.map((b) => b.n)))} tests in ${d.length} bands` : ''),
    variables: [],
    reading: (d) => {
      const dips = Array.isArray(d) && d.some((b, k) => k > 0 && b.ignition < d[k - 1].ignition)
      return `The share of tests that ignited is higher in the hottest band than in the coolest${dips ? ', but it does not rise at every step' : ''}; n per band is under each bar. The temperature is calculated for the gas mixture, not measured in the flame, and this chart does not test temperature against O₂ as a predictor, whatever the title says.`
    },
    limits: (d) => [
      'Bands with fewer than 5 tests are dropped by the API, and tests without a tabulated outcome are not counted.',
      ...(Array.isArray(d) && d.length ? [`Band sizes are uneven (n from ${Math.min(...d.map((b) => b.n))} to ${Math.max(...d.map((b) => b.n))}), so the shares do not carry the same weight.`] : []),
      ...(Array.isArray(d) && d.some((b, k) => k > 0 && b.ignition < d[k - 1].ignition) ? ['The share does not rise at every step: some bands ignite less often than the cooler band before them.'] : []),
      'The comparison with O₂ in the title is not shown by this chart: it gives the trend with temperature only.',
      'Gas-jet flames. Adiabatic temperature is a calculated property of the mixture, not a measured flame temperature.',
    ],
  },
}
// Findings with a purpose-built chart, in the order the dashboard prefers. This list is NOT a filter: every
// other insight the API returns is shown too, as a generic source-backed card (see findingViews).
export const FINDING_ORDER = ['cobertura', 'saffire_gravidade', 'flex_desfecho', 'cfig_ignicao']

// What kind of card an insight is:
//   chart  - a finding this screen knows how to draw
//   change - "novidades": what the last ingestion added. A fact about the archive, not about fire
//   auto   - "auto_<PSI-id>": statistics of a newly ingested investigation nobody has profiled yet
//   text   - any other insight: its sentence and source, with no invented chart
export type FindingKind = 'chart' | 'change' | 'auto' | 'text'
export interface FindingView { insight: Insight; kind: FindingKind; spec: FindingSpec | null; sources: string[] }
export type FindingSort = 'curated' | 'api' | 'fuel'

const kindOf = (i: Insight): FindingKind => (FINDINGS[i.id] ? 'chart' : i.id === 'novidades' ? 'change' : i.id.startsWith('auto_') ? 'auto' : 'text')
export function findingViews(list: Insight[]): FindingView[] {
  return list.filter((i) => i && typeof i.id === 'string').map((i) => {
    const kind = kindOf(i)
    // an auto card names its investigation in its id; the others name theirs in the source line
    const sources = [...new Set([...(kind === 'auto' ? psiIds(i.id.slice(5)) : []), ...psiIds(String(i.source ?? ''))])]
    return { insight: i, kind, spec: FINDINGS[i.id] ?? null, sources }
  })
}
// curated: change card first, then the charted findings in FINDING_ORDER, then the rest as the API sent them.
// api: exactly the API order. fuel: findings whose investigations burned the scenario's fuel family first.
export function sortFindings(v: FindingView[], how: FindingSort, family: string, familyOf: (id: string) => string | undefined): FindingView[] {
  if (how === 'api') return v
  const rank = (f: FindingView) => (f.kind === 'change' ? -1 : f.kind === 'chart' ? FINDING_ORDER.indexOf(f.insight.id) : FINDING_ORDER.length)
  const curated = v.map((f, i) => ({ f, i })).sort((a, b) => rank(a.f) - rank(b.f) || a.i - b.i).map((x) => x.f)
  if (how === 'curated' || family === 'todas') return curated
  const match = (f: FindingView) => (f.sources.some((id) => familyOf(id) === family) ? 0 : 1)
  return curated.map((f, i) => ({ f, i })).sort((a, b) => match(a.f) - match(b.f) || a.i - b.i).map((x) => x.f)
}

// ---- Next Fire relations --------------------------------------------------------------------------------

// A proposal touches a factor when it is that kind of test or closes a caveat of that kind.
export const touches = (p: Proposal, kinds: GapKind[]) => kinds.some((k) => p.kind === k || p.closes.some((c) => c.what === k))

export interface Relation { level: 'direct' | 'same-factor' | 'none'; text: string; proposals: string[] }

// Does Next Fire hold a proposal for this finding? basis = the investigation behind the published boundary.
export function findingRelation(f: FindingView, q: FireQueue | null, basis: string | null, basisName: string): Relation {
  if (!q?.available) return { level: 'none', text: 'The Next Fire queue is not available, so no proposal can be matched.', proposals: [] }
  const vars = f.spec?.variables ?? []
  const hits = vars.length ? q.queue.filter((p) => touches(p, vars)) : []
  const factors = vars.map((k) => GAP[k]).join(' and ')
  if (hits.length && basis && f.sources.includes(basis)) {
    return { level: 'direct', proposals: hits.map((p) => p.id), text: `${hits.length} proposed ${hits.length === 1 ? 'experiment addresses' : 'experiments address'} ${factors}. They extend ${basisName}, one of this finding's sources, and apply to the acrylic rod only.` }
  }
  if (hits.length) {
    return { level: 'same-factor', proposals: hits.map((p) => p.id), text: `${hits.length} proposed ${hits.length === 1 ? 'experiment varies' : 'experiments vary'} the same factor (${factors}), but on the ${basisName} acrylic rod. None of them re-tests the samples of this finding.` }
  }
  return { level: 'none', proposals: [], text: `No proposal. The queue is derived only from the published ${basisName} acrylic-rod boundary; the current methodology does not model gaps for this kind of experiment.` }
}

export function investigationRelation(v: Investigation, q: FireQueue | null, basis: string | null, basisName: string): Relation {
  if (!q?.available) return { level: 'none', text: 'The Next Fire queue is not available.', proposals: [] }
  if (v.id === basis) return { level: 'direct', proposals: q.queue.map((p) => p.id), text: `All ${q.queue.length} proposed experiments extend this investigation: they start from its published acrylic-rod boundary and change one factor at a time.` }
  return { level: 'none', proposals: [], text: `No proposal uses ${v.name} data. The queue is derived only from the published ${basisName} acrylic-rod boundary.` }
}

// Findings a proposal relates to: those about a factor the proposal changes.
export const proposalFindings = (p: Proposal, shown: FindingView[]) => shown.filter((f) => f.spec?.variables.length && touches(p, f.spec.variables)).map((f) => f.insight.id)

// ---- small formatters shared by the panes ----------------------------------------------------------------
export const o2Range = (r: [number, number] | null | undefined) => (r ? (r[0] === r[1] ? pct(r[0]) : `${pct(r[0])}–${pct(r[1])}`) : null)
export const psiRange = (r: [number, number] | null | undefined) => (r ? (Math.abs(r[0] - r[1]) < 1e-6 ? psi(r[0]) : `${nf(r[0] * 14.696, 1)}–${psi(r[1])}`) : null)
// The API joins its reasons with "; " and ends with the catalog note (priority_why), which the catalog still
// stores in Portuguese. The dashboard shows only the computed part, so the note is cut from the end.
export function reasonText(reason: string, v: Investigation | undefined) {
  let s = reason.trim().replace(/\.$/, '')
  const tail = (v?.priority_why ?? '').trim().toLowerCase()
  if (tail && s.toLowerCase().endsWith(tail)) s = s.slice(0, s.length - tail.length).replace(/;\s*$/, '')
  return s ? s.charAt(0).toUpperCase() + s.slice(1) + '.' : ''
}
