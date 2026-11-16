// Cartão do teste selecionado (no mapa, no grafo ou numa citação): o que queimou, em que ar, e de onde vem o dado.
import { api } from '../../api'
import { FAMILY, OUTCOME, gLabel, nf, pct, psi } from '../../lib/format'
import { safeHref } from '../../lib/url'
import { useAsync } from '../../lib/useAsync'
import { useAtlas } from '../../state'
import type { TestDetail } from '../../types'

export function TestCard() {
  const { selectedTest, selectTest } = useAtlas()
  // a slow answer for the previous test never fills the card of the one selected now, and a failure is shown
  const r = useAsync<TestDetail | null>(() => (selectedTest ? api.test(selectedTest) : Promise.resolve(null)), [selectedTest])
  if (!selectedTest) return null
  if (r.error) {
    return (
      <aside className="test-card" aria-label="Selected test">
        <header><b>Could not open this test</b><button className="x" onClick={() => selectTest(null)} aria-label="Close">×</button></header>
        <p style={{ fontSize: 13, marginBottom: 8 }}>{r.error}</p>
        <button className="link" onClick={r.reload}>Try again</button>
      </aside>
    )
  }
  const d = r.loading ? null : r.data
  if (!d) return null
  const t = d.test
  const mx = d.metrics || {}
  const fromReport = !!mx.outcome_source && !!mx.end
  const result = fromReport && t.outcome_raw
    ? t.outcome_raw.charAt(0).toUpperCase() + t.outcome_raw.slice(1) + (mx.limit_flow_cm_s != null ? `, at an airflow of ${mx.limit_flow_cm_s < 2 && mx.end === 'quench' ? 'under 2' :nf(mx.limit_flow_cm_s, mx.limit_flow_cm_s < 10 ? 1 : 0)} cm/s` : '')
    : `${OUTCOME[t.outcome] ?? t.outcome}${t.outcome_raw ? ` (${t.outcome_raw})` : ''}`
  return (
    <aside className="test-card" aria-label="Selected test">
      <header><b>{d.investigation} · {t.label}</b><button className="x" onClick={() => selectTest(null)} aria-label="Close">×</button></header>
      <dl>
        <dt>What burned</dt><dd>{t.fuel || (FAMILY[t.family] ?? t.family)}</dd>
        <dt>Atmosphere</dt><dd>{t.o2 != null ? pct(t.o2, 1) : '–'} O₂ · {t.pressure_atm != null ? psi(t.pressure_atm) : 'pressure not tabulated'} · {gLabel(t.gravity)}</dd>
        <dt>Outcome</dt><dd>{result}</dd>
        {mx.external && mx.spread_mm_s != null && (<><dt>Spread speed</dt><dd>{nf(mx.spread_mm_s, 1)} mm/s, against a {nf(mx.flow_cm_s, 0)} cm/s airflow</dd></>)}
        {mx.external && (<><dt>Sample</dt><dd>{mx.sample}</dd><dt>Not a NASA test</dt><dd>{mx.agency}. {mx.not_nasa}</dd></>)}
        {fromReport && mx.comments && (<><dt>What the NASA report says</dt><dd className="quote" lang="en">“{mx.comments}”</dd></>)}
        <dt>Source</dt><dd className="mono">{fromReport ? `${mx.outcome_source} · ` : ''}{mx.external && safeHref(mx.record_url) ? <a href={safeHref(mx.record_url)} target="_blank" rel="noreferrer">{d.source}</a> : d.source}{mx.external ? ` · ${mx.license}` : ''}</dd>
      </dl>
    </aside>
  )
}
