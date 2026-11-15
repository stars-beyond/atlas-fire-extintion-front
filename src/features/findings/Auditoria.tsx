// Auditoria: a tabela do BASS-II no PSI conferida contra o relatório da NASA, linha por linha.
// A lista vem pronta do extrator de desfechos (scripts/extract_outcomes.py); aqui ela só é mostrada.
// Cada item diz o que está em cada fonte, onde, e por que chama a atenção.
import { useEffect, useMemo, useState } from 'react'
import { api } from '../../api'
import { fmtDate, nf } from '../../lib/format'
import type { AuditItem, Flammability } from '../../types'

const SEV: { id: AuditItem['severity']; title: string; sub: string; color: string }[] = [
  { id: 'alta', title: 'Unusable value', sub: 'It is in the PSI table but is not a measurement.', color: 'var(--incognita)' },
  { id: 'média', title: 'The two sources disagree', sub: 'The table and the report say different things.', color: 'var(--parcial)' },
  { id: 'baixa', title: 'Worth checking', sub: 'Does not change the data, but deserves a look.', color: 'var(--faint)' },
]
const show = (v: number | string | null, field = '') => (v == null ? (field === 'teste' ? 'missing' : 'blank') : typeof v === 'number' ? nf(v, Number.isInteger(v) ? 0 : 1) : v)
const where = (a: AuditItem) => [a.table_row ? `table, row ${a.table_row}` : '', a.report_page ? `report, p. ${a.report_page}` : ''].filter(Boolean).join(' · ')

function markdown(d: Flammability) {
  const L = [`# Audit of the ${d.name} table in PSI`, '', `Extinction Atlas, ${fmtDate(new Date())}.`,
    `Table: PSI-25, BASS-II experiment table (${d.summary.tests} tests). Report: ${d.report.title}, ${d.report.number}, ${d.report.section} (${d.report.url}).`, '',
    '| Test | Field | In the PSI table | In the report | Issue | Where |', '|---|---|---|---|---|---|',
    ...d.audit.map((a) => `| ${a.test} | ${a.field} | ${show(a.table, a.field)} | ${show(a.report, a.field)} | ${a.kind}. ${a.note} | ${where(a)} |`)]
  return L.join('\n')
}

export function Auditoria() {
  const [d, setD] = useState<Flammability | null>(null)
  const [err, setErr] = useState('')
  const [copied, setCopied] = useState(false)
  useEffect(() => { api.flammability().then(setD).catch((e) => setErr(e.message)) }, [])
  const md = useMemo(() => (d?.available ? markdown(d) : ''), [d])
  if (err) return <p className="empty">Could not load the audit. {err}</p>
  if (!d) return <p className="empty">Checking…</p>
  if (!d.available) return <p className="empty">The outcomes have not been loaded into the database yet.</p>
  const copy = () => navigator.clipboard?.writeText(md).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) }).catch(() => {})
  return (
    <>
      <p className="lede">
        The {d.name} table in PSI and the NASA report describe the same {d.summary.tests} tests. We checked one source against the other: six numbers per test, whether each test is present, and the numbering.
        {d.audit.length} {d.audit.length === 1 ? 'issue' : 'issues'} came up.
      </p>
      <div className="counts audit-counts">
        {SEV.map((s) => (
          <div key={s.id} style={{ borderLeft: `3px solid ${s.color}` }}>
            <b>{d.audit.filter((a) => a.severity === s.id).length}</b><span>{s.title.toLowerCase()}</span>
          </div>
        ))}
      </div>
      {SEV.map((s) => {
        const items = d.audit.filter((a) => a.severity === s.id)
        if (!items.length) return null
        return (
          <section key={s.id} className="audit-group">
            <div><h2>{s.title}</h2><p className="note">{s.sub}</p></div>
            <div className="audit-list">
              {items.map((a, i) => (
                <article key={a.test + a.field + i} className="card audit-item" style={{ borderLeftColor: s.color }}>
                  <div className="sec-title"><h3>{a.test} · {a.field}</h3><span className="pill">{a.kind}</span></div>
                  {(a.table != null || a.report != null) && (
                    <dl className="audit-pair">
                      <div><dt>In the PSI table</dt><dd>{show(a.table, a.field)}</dd></div>
                      <div><dt>In the report</dt><dd>{show(a.report, a.field)}</dd></div>
                    </dl>
                  )}
                  <p>{a.note}</p>
                  {where(a) && <p className="mono">{where(a)}</p>}
                </article>
              ))}
            </div>
          </section>
        )
      })}
      <div className="actions no-print">
        <button className="cta" onClick={copy}>{copied ? 'Copied' : 'Copy the list to share'}</button>
        <button className="ghost" onClick={() => window.print()}>Print or save as PDF</button>
      </div>
      <p className="note">
        Sources: PSI-25 experiment table and <a href={d.report.url} target="_blank" rel="noreferrer">{d.report.number}</a>, {d.report.section}.
        The check is automatic and only looks at what the two sources have in common; it does not say which one is right.
      </p>
    </>
  )
}
