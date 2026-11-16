// From a point on a chart to the row NASA tabulated: the original record of one test (/api/tests/{id}),
// with the file and row it was read from, the raw cells, and what the Atlas assumed.
import { useEffect, useRef } from 'react'
import { api } from '../../api'
import { OUTCOME, gLabel, nf, pct, psi } from '../../lib/format'
import type { TestDetail } from '../../types'
import { psiUrl } from './links'
import { severityLabel, type Quality } from './NextFirePane'
import { Failed, Pending, Tag } from './ui'
import { useAsync } from './useAsync'

export function SourceRecord({ id, onClose, onInvestigation, quality }: {
  id: string; onClose: () => void; onInvestigation: (id: string) => void
  quality: (label: string, investigation: string) => Quality | null
}) {
  const r = useAsync<TestDetail>(() => api.test(id), [id])
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null
    box.current?.focus()
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', key)
    return () => { window.removeEventListener('keydown', key); prev?.focus?.() }
  }, [onClose])
  const t = r.data?.test
  const raw = Object.entries(r.data?.raw ?? {}).filter(([k]) => k)
  const ql = t ? quality(String(t.label), String(t.investigation_id)) : null
  const metrics = Object.entries(r.data?.metrics ?? {}).filter(([, v]) => v !== null && v !== '' && typeof v !== 'object')
  return (
    <div className="drecord-veil" onClick={onClose}>
      <div className="dsource" role="dialog" aria-modal="true" aria-label="Source record" tabIndex={-1} ref={box} onClick={(e) => e.stopPropagation()}>
        <header>
          <div><span className="dkicker">Source record</span><h3>{t ? `${r.data!.investigation} · ${t.label}` : id}</h3></div>
          <button className="dbtn" onClick={onClose} aria-label="Close the source record">Close</button>
        </header>
        {r.error ? <Failed what="the source record" error={r.error} retry={r.reload} /> : !r.data || !t ? <Pending what="the source record" /> : (
          <>
            <p className="dsource-file"><Tag k="measured" /> {r.data.source}</p>
            {ql && ql.audit.length + ql.flags.length > 0 && (
              <div className="dqualitybox">
                <h4>Open data-quality items for this test</h4>
                <ul className="dgaps">
                  {ql.audit.map((a, k) => (<li key={k}><b>Audit · severity {severityLabel(a.severity)} · {a.field === 'teste' ? 'test row' : a.field}:</b> {a.kind}. {a.note}{a.table_row ? ` PSI table row ${a.table_row}.` : ''}{a.report_page ? ` Report p. ${a.report_page}.` : ''}</li>))}
                  {ql.flags.map((x, k) => (<li key={'f' + k}><b>Extractor flag:</b> {x}</li>))}
                </ul>
                <p className="dcap">A discrepancy between the PSI table and the NASA report, found by an automatic comparison. It is not a confirmed error, and the value below is shown as tabulated, uncorrected.</p>
              </div>
            )}
            <h4>As normalized by the Atlas</h4>
            <dl className="dkv">
              <div><dt>Oxygen</dt><dd>{t.o2 != null ? pct(t.o2, 1) : 'not tabulated'}</dd></div>
              <div><dt>Pressure</dt><dd>{t.pressure_atm != null ? psi(t.pressure_atm) : 'not tabulated'}{t.assumed?.includes('pressure_atm') ? ' (assumed: cabin pressure, not in the table)' : ''}</dd></div>
              <div><dt>Gravity</dt><dd>{gLabel(t.gravity)}</dd></div>
              {t.flow_cm_s != null && <div><dt>Airflow</dt><dd>{nf(t.flow_cm_s, 1)} cm/s</dd></div>}
              {t.fuel && <div><dt>Fuel or sample</dt><dd>{t.fuel}</dd></div>}
              <div><dt>Outcome class</dt><dd>{OUTCOME[t.outcome] ?? t.outcome}</dd></div>
            </dl>
            {t.assumed?.length > 0 && <p className="dcap">Fields the Atlas filled in because the table does not carry them: <span className="dmono">{t.assumed.join(', ')}</span>.</p>}
            {metrics.length > 0 && (<><h4>Numeric columns read</h4><dl className="dkv">{metrics.map(([k, v]) => (<div key={k}><dt className="dmono">{k}</dt><dd>{typeof v === 'number' ? nf(v, Number.isInteger(v) ? 0 : 3).replace(/\.?0+$/, '') : String(v)}</dd></div>))}</dl></>)}
            <h4>Original row, cell by cell</h4>
            {raw.length ? (
              <div className="dtable-wrap"><table className="dtable"><tbody>
                {raw.map(([k, v]) => (<tr key={k}><td className="faint">{k}</td><td>{v === '' ? <span className="faint">empty</span> : String(v)}</td></tr>))}
              </tbody></table></div>
            ) : <p className="dcap">The raw row was not stored for this record.</p>}
            <p className="dsource-links">
              <a href={psiUrl(t.investigation_id)} target="_blank" rel="noreferrer">{t.investigation_id} on NASA PSI ↗</a>
              <button className="dlink" onClick={() => { onInvestigation(t.investigation_id); onClose() }}>Open {r.data.investigation} in the Investigations column →</button>
            </p>
          </>
        )}
      </div>
    </div>
  )
}
