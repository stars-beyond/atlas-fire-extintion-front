// Scientific intelligence dashboard: one screen, in this order.
//
//   A. Reference scenario                    environments from /api/meta.habitats, plus O₂, pressure, gravity,
//                                            airflow and fuel
//   B. Metrics for that scenario             /api/verdict (coverage), /api/flammability/assess (curve estimate)
//      Archive overview, collapsed           /api/meta: global, never presented as scenario metrics
//   C. 01 Findings                           /api/insights: global findings, every card the API returns
//      02 Investigations                     /api/investigations, /api/rank (heuristic relevance)
//      03 Next fire                          /api/flammability/queue (BASS-II acrylic rod), /api/next-tests
//   D. 04 Create your dashboard              /api/datasets and /api/datasets/{id}/chart
//
// One reference scenario (shared with the test drive) and one "trace" tie the three columns together.
// Every number comes from the API. A failed request shows an error in its own block and nothing else in its
// place; there are no fallback values. "Refresh data" reads the catalog and every dependent response again.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../../api'
import { FAMILY, gLabel, nf, pct, psi } from '../../lib/format'
import { MATERIALS, useAtlas } from '../../state'
import type { Family, Habitat, Investigation, Proposal } from '../../types'
import { CustomDashboard } from './CustomDashboard'
import { FindingsPane } from './FindingsPane'
import { InvestigationsPane } from './InvestigationsPane'
import { NextFirePane, qualityOf } from './NextFirePane'
import { Overview, utc, versionOf } from './Overview'
import { SourceRecord } from './SourceRecord'
import { findingRelation, findingViews, investigationRelation, proposalFindings, type FindingSort, type FindingView, type Focus, type GapKind } from './links'
import { Guard } from './ui'
import { useAsync } from './useAsync'

// The queue is built on the BASS-II acrylic rod; in the configurator that material is "pmma".
const QUEUE_MATERIAL = 'pmma'
const VERSION_CHECK_MS = 5 * 60 * 1000   // how often the served data-set version is compared, while the tab is visible
type Tab = 'findings' | 'investigations' | 'nextfire'
const TABS: [Tab, string][] = [['findings', '01 Findings'], ['investigations', '02 Investigations'], ['nextfire', '03 Next fire']]

export function Dashboard() {
  const { meta, invs, loadError, reloadCatalog, catalogAt, scenario, setScenario, selectInv, setView, wind, setWind } = useAtlas()
  const [tick, setTick] = useState(0)             // bumped by Refresh data: every request below repeats
  const [refreshing, setRefreshing] = useState(false)
  const [refreshError, setRefreshError] = useState<string | null>(null)
  const [newer, setNewer] = useState<string | null>(null)
  const [lastCheck, setLastCheck] = useState<{ at: Date; ok: boolean } | null>(null)
  const [question, setQuestion] = useState('')
  const key = `${scenario.o2}|${scenario.pressure_atm}|${scenario.gravity}|${scenario.family}|${scenario.material}`

  const insights = useAsync(() => api.insights().then((r) => findingViews(Array.isArray(r?.insights) ? r.insights : [])), [tick])
  const queue = useAsync(() => api.queue(), [tick])
  const flam = useAsync(() => api.flammability(), [tick])
  const datasets = useAsync(() => api.datasets().then((r) => ({ datasets: Array.isArray(r?.datasets) ? r.datasets : [], note: r?.note ?? '' })), [tick])
  const rank = useAsync(() => api.rank(scenario, question), [key, question, tick], 160)
  const verdict = useAsync(() => api.verdict(scenario), [key, tick], 160)
  const form = queue.data?.available ? queue.data.form : ''
  const assess = useAsync(() => (form ? api.assess(scenario, wind, form) : Promise.resolve({ available: false })), [key, wind, form, tick], 160)
  const gaps = useAsync(() => api.nextTests(scenario.family, scenario.material), [scenario.family, scenario.material, tick])

  const [focus, setFocus] = useState<Focus>(null)
  const [open, setOpen] = useState<string | null>(null)
  const [sort, setSort] = useState<FindingSort>('curated')
  const [invSel, setInvSel] = useState<string | null>(null)
  const [propSel, setPropSel] = useState<string | null>(null)
  const [pinned, setPinned] = useState<{ label: string; ids: string[] } | null>(null)
  const [record, setRecord] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('findings')

  const refresh = useCallback(async () => {
    setRefreshing(true)
    const ok = await reloadCatalog()
    setRefreshError(ok ? null : 'the Atlas API did not answer')
    if (ok) { setNewer(null); setTick((n) => n + 1) }
    setLastCheck({ at: new Date(), ok })
    setRefreshing(false)
  }, [reloadCatalog])

  // Light check of the served data-set version. It reads /api/meta only, never the heavy responses, and
  // only tells the user that a newer data set is being served; nothing is swapped under their eyes.
  const shown = versionOf(meta)
  const shownRef = useRef(shown); shownRef.current = shown
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState !== 'visible' || !shownRef.current) return
      api.meta().then((m) => {
        setLastCheck({ at: new Date(), ok: true })
        if (versionOf(m) !== shownRef.current) setNewer(m.ingest?.at ?? 'unknown time')
      }).catch(() => setLastCheck({ at: new Date(), ok: false }))
    }, VERSION_CHECK_MS)
    return () => clearInterval(t)
  }, [])

  const invById = useMemo(() => new Map(invs.map((v) => [v.id, v])), [invs])
  const findings = insights.data ?? []
  const q = queue.data?.available ? queue.data : null
  const basis = flam.data?.available ? flam.data.investigation : null
  const basisName = (basis && invById.get(basis)?.name) || flam.data?.name || 'BASS-II'

  const fFocus = focus?.kind === 'finding' ? findings.find((f) => f.insight.id === focus.id) : undefined
  const vFocus = focus?.kind === 'investigation' ? invById.get(focus.id) : undefined
  const pFocus = focus?.kind === 'proposal' ? q?.queue.find((x) => x.id === focus.id) : undefined
  const relF = useCallback((f: FindingView) => findingRelation(f, q, basis, basisName), [q, basis, basisName])
  const relV = useCallback((v: Investigation) => investigationRelation(v, q, basis, basisName), [q, basis, basisName])
  const findingsOfInv = useCallback((id: string) => findings.filter((f) => f.sources.includes(id)), [findings])
  const findingsOfProp = useCallback((x: Proposal) => { const ids = proposalFindings(x, findings); return findings.filter((f) => ids.includes(f.insight.id)) }, [findings])

  const linkedFindings = useMemo(() => new Set<string>(vFocus ? findingsOfInv(vFocus.id).map((f) => f.insight.id) : pFocus ? proposalFindings(pFocus, findings) : []), [vFocus, pFocus, findings, findingsOfInv])
  const linkedProps = useMemo(() => {
    const ids = fFocus ? relF(fFocus).proposals : []
    return new Set<string>(q && ids.length < q.queue.length ? ids : [])
  }, [fFocus, relF, q])
  const sources = fFocus?.sources ?? []
  const selectedInv = invSel ?? sources.find((id) => invById.has(id)) ?? (pFocus && basis) ?? rank.data?.ranking?.[0]?.id ?? null

  const toQueue = () => requestAnimationFrame(() => document.querySelector('.dqueue')?.scrollIntoView({ behavior: 'smooth', block: 'center' }))
  const focusFinding = (id: string) => { setOpen(id); setFocus({ kind: 'finding', id }); setInvSel(null); setPinned(null); setTab('findings') }
  const selectFinding = (id: string) => {
    if (open === id) { setOpen(null); if (focus?.kind === 'finding') setFocus(null); return }
    focusFinding(id)
  }
  const selectInvestigation = (id: string) => { if (!invById.has(id)) return; setInvSel(id); selectInv(id); setFocus({ kind: 'investigation', id }); setPinned(null); setTab('investigations') }
  const selectProposal = (id: string) => { setPropSel(id); setFocus({ kind: 'proposal', id }); setInvSel(null) }
  // keep = true: changing the scenario here keeps the airflow and the test in progress in the test drive
  const pickHabitat = (h: Habitat) => setScenario({ o2: h.o2, pressure_atm: h.pressure_atm, gravity: h.gravity }, h.id, true)
  const pickFuel = (family: string, material = '') => setScenario({ family: family as Family, material }, undefined, true)
  const clear = () => { setFocus(null); setPinned(null); setInvSel(null) }
  const quality = useCallback((label: string, inv: string) => (flam.data?.available && inv === flam.data.investigation ? qualityOf(flam.data, label) : null), [flam.data])

  if (!meta) {
    return (
      <main className="dash dash-down">
        <div className="dunavailable" role={loadError ? 'alert' : 'status'}>
          <h1>Scientific intelligence dashboard</h1>
          {loadError ? (
            <>
              <h2>The Atlas API is not answering</h2>
              <p className="dmono">{loadError}</p>
              <p>Nothing can be shown: this screen has no stored or example values, and it does not replace live data with old data. No ingestion has been verified in this session, so no "last verified" time can be stated.</p>
              <button className="dbtn dprimary" onClick={refresh} disabled={refreshing}>{refreshing ? 'Trying…' : 'Try again'}</button>
              {lastCheck && <p className="dcap">Last attempt: {utc(lastCheck.at, true)}.</p>}
            </>
          ) : <p>Reading the archive from the Atlas API…</p>}
        </div>
      </main>
    )
  }

  const scenarioName = meta.habitats.find((h) => h.id === scenario.habitat)?.name ?? 'the custom scenario'
  const mat = MATERIALS.find((m) => m.family === scenario.family && m.material === (scenario.material || ''))
  const fuelName = mat?.noun ?? (scenario.family === 'todas' ? 'any fuel' : scenario.family === 'solido' ? 'solid materials' : (FAMILY[scenario.family] ?? scenario.family).toLowerCase())
  const curveApplies = scenario.family === 'todas' || (scenario.family === 'solido' && (!scenario.material || scenario.material === QUEUE_MATERIAL))
  const fuelNote = scenario.family === 'gota' || scenario.family === 'gas'
    ? `The fuel is set to ${FAMILY[scenario.family].toLowerCase()}. The archive holds no published flammability boundary for them: the curve estimate and the queue in this column do not apply to that fuel.`
    : scenario.family === 'solido' && scenario.material && scenario.material !== QUEUE_MATERIAL
      ? `${mat?.name ?? scenario.material} has no published boundary in the archive. The curve estimate and the queue below are for the acrylic rod and must not be transferred to ${mat?.noun ?? scenario.material}.`
      : null
  const rel = fFocus ? relF(fFocus) : vFocus ? relV(vFocus) : null

  return (
    <main className="dash" data-tab={tab}>
      <Overview meta={meta} invs={invs} scenario={scenario} wind={wind} verdict={verdict} assess={assess} curveApplies={curveApplies} fuelName={fuelName}
        fetchedAt={catalogAt} refreshing={refreshing} refreshError={refreshError} newer={newer} lastCheck={lastCheck} onRefresh={refresh}
        onHabitat={pickHabitat} onFuel={pickFuel} onScenario={(patch) => setScenario(patch, undefined, true)} onWind={setWind} onRecord={setRecord} />

      <div className={`dtrace${focus ? ' on' : ''}`} aria-live="polite">
        {!focus ? <p className="dtrace-idle">Select a finding, an investigation or a proposed experiment: the other two columns show what it connects to.</p> : (
          <>
            <div className={`dtrace-cell${focus.kind === 'finding' ? ' origin' : ''}`}>
              <span>Finding</span>
              <b>{fFocus ? (fFocus.spec?.kicker ?? fFocus.insight.title) : linkedFindings.size ? `${linkedFindings.size} ${linkedFindings.size === 1 ? 'finding' : 'findings'} ${vFocus ? 'computed from its table' : 'about the same factor'}` : 'none linked'}</b>
            </div>
            <div className={`dtrace-cell${focus.kind === 'investigation' ? ' origin' : ''}`}>
              <span>{fFocus ? 'Source investigations' : pFocus ? 'Extends' : 'Investigation'}</span>
              <b>{fFocus ? (sources.length ? sources.map((id) => invById.get(id)?.name ?? id).join(' · ') : 'none named by the API') : vFocus ? vFocus.name : basisName}</b>
            </div>
            <div className={`dtrace-cell${focus.kind === 'proposal' ? ' origin' : ''}`}>
              <span>Next fire</span>
              <b>{pFocus ? `#${pFocus.rank} ${pFocus.title}` : !rel ? '' : rel.level === 'none' ? 'no proposal applies' : `${rel.proposals.length} ${rel.proposals.length === 1 ? 'proposal' : 'proposals'}${rel.level === 'same-factor' ? ' · same factor, different sample' : ''}`}</b>
            </div>
            <button className="dbtn" onClick={clear}>Clear trace</button>
          </>
        )}
      </div>

      <nav className="dtabs" aria-label="Dashboard columns">
        {TABS.map(([t, l]) => (<button key={t} aria-pressed={tab === t} onClick={() => setTab(t)}>{l}</button>))}
      </nav>

      <div className="dcols">
        <Guard what="The Findings column">
          <FindingsPane insights={insights} invById={invById} habitats={meta.habitats} scenario={scenario}
            focus={focus} open={open} linked={linkedFindings} sort={sort} onSort={setSort} relationOf={relF}
            onSelect={selectFinding} onInvestigation={selectInvestigation} onFamily={(f) => pickFuel(f)} onRecord={setRecord}
            onNextFire={(_kinds: GapKind[], ids) => { const f = findings.find((x) => x.insight.id === open); setPinned(q && ids.length < q.queue.length ? { label: f?.spec?.kicker ?? 'the selected finding', ids } : null); setPropSel(ids[0] ?? null); setTab('nextfire'); toQueue() }}
            onOpenPage={() => setView('achados')} />
        </Guard>
        <Guard what="The Investigations column">
          <InvestigationsPane rank={rank} invs={invs} invById={invById} meta={meta}
            scenarioText={`${pct(scenario.o2, 1)} O₂ · ${psi(scenario.pressure_atm)} · ${gLabel(scenario.gravity)}`} scenarioO2={scenario.o2} family={scenario.family}
            focus={focus} sources={sources} basis={basis} selected={selectedInv}
            findingsOf={findingsOfInv} relationOf={relV} question={question} onQuestion={setQuestion} datasets={datasets.data?.datasets ?? null}
            onSelect={selectInvestigation} onFinding={focusFinding}
            onNextFire={() => { setPinned(null); setTab('nextfire'); toQueue() }} onOpenPage={() => setView('investigacoes')} />
        </Guard>
        <Guard what="The Next fire column">
          <NextFirePane queue={queue} flam={flam} assess={assess} scenario={scenario} scenarioName={scenarioName} fuelNote={fuelNote} basis={basis} basisName={basisName}
            focus={focus} linked={linkedProps} pinned={pinned} onUnpin={() => setPinned(null)} selected={propSel} onSelect={selectProposal}
            findingsOf={findingsOfProp} onFinding={focusFinding} wind={wind} gaps={gaps} materialName={fuelName}
            onHabitat={pickHabitat} onRecord={setRecord} onInvestigation={selectInvestigation} onOpenPage={() => setView('proximo')} />
        </Guard>
      </div>

      <Guard what="The custom dashboard">
        <CustomDashboard datasets={datasets} ingestAt={utc(new Date(meta.ingest.at))} tick={tick} onRecord={setRecord} />
      </Guard>

      {record && <SourceRecord id={record} onClose={() => setRecord(null)} onInvestigation={selectInvestigation} quality={quality} />}
      <p className="dfootnote">No text on this screen is written by a language model. {nf(meta.counts.investigations)} investigations and {nf(meta.counts.tests)} tabulated records in the data set served now.</p>
    </main>
  )
}
