// Auditoria: a tabela do BASS-II no PSI conferida contra o relatório da NASA, linha por linha.
// A lista vem pronta do extrator de desfechos (scripts/extract_outcomes.py); aqui ela só é mostrada.
// Cada item diz o que está em cada fonte, onde, e por que chama a atenção.
import { useEffect, useMemo, useState } from 'react'
import { api, nf, type AuditItem, type Flammability } from '../api'

const SEV: { id: AuditItem['severity']; title: string; sub: string; color: string }[] = [
  { id: 'alta', title: 'Valor que não pode ser usado', sub: 'Está na tabela do PSI e não é uma medida.', color: 'var(--incognita)' },
  { id: 'média', title: 'As duas fontes não batem', sub: 'Tabela e relatório dizem coisas diferentes.', color: 'var(--parcial)' },
  { id: 'baixa', title: 'Para conferir', sub: 'Não muda os dados, mas pede uma olhada.', color: 'var(--faint)' },
]
const show = (v: number | string | null, field = '') => (v == null ? (field === 'teste' ? 'ausente' : 'em branco') : typeof v === 'number' ? nf(v, Number.isInteger(v) ? 0 : 1) : v)
const where = (a: AuditItem) => [a.table_row ? `tabela, linha ${a.table_row}` : '', a.report_page ? `relatório, p. ${a.report_page}` : ''].filter(Boolean).join(' · ')

function markdown(d: Flammability) {
  const L = [`# Auditoria da tabela do ${d.name} no PSI`, '', `Atlas de Extinção, ${new Date().toLocaleDateString('pt-BR')}.`,
    `Tabela: PSI-25, tabela experimental do BASS-II (${d.summary.tests} testes). Relatório: ${d.report.title}, ${d.report.number}, ${d.report.section} (${d.report.url}).`, '',
    '| Teste | Campo | Na tabela do PSI | No relatório | O que há | Onde |', '|---|---|---|---|---|---|',
    ...d.audit.map((a) => `| ${a.test} | ${a.field} | ${show(a.table, a.field)} | ${show(a.report, a.field)} | ${a.kind}. ${a.note} | ${where(a)} |`)]
  return L.join('\n')
}

export function Auditoria() {
  const [d, setD] = useState<Flammability | null>(null)
  const [err, setErr] = useState('')
  const [copied, setCopied] = useState(false)
  useEffect(() => { api.flammability().then(setD).catch((e) => setErr(e.message)) }, [])
  const md = useMemo(() => (d?.available ? markdown(d) : ''), [d])
  if (err) return <p className="empty">Não foi possível carregar a auditoria. {err}</p>
  if (!d) return <p className="empty">Conferindo…</p>
  if (!d.available) return <p className="empty">Os desfechos ainda não foram carregados no banco.</p>
  const copy = () => navigator.clipboard?.writeText(md).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) }).catch(() => {})
  return (
    <>
      <p className="lede">
        A tabela do {d.name} no PSI e o relatório da NASA descrevem os mesmos {d.summary.tests} testes. Conferimos uma fonte contra a outra: seis números por teste, a presença de cada teste e a numeração.
        Apareceram {d.audit.length} pontos.
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
                      <div><dt>Na tabela do PSI</dt><dd>{show(a.table, a.field)}</dd></div>
                      <div><dt>No relatório</dt><dd>{show(a.report, a.field)}</dd></div>
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
        <button className="cta" onClick={copy}>{copied ? 'Copiada' : 'Copiar a lista para enviar'}</button>
        <button className="ghost" onClick={() => window.print()}>Imprimir ou salvar em PDF</button>
      </div>
      <p className="note">
        Fontes: tabela experimental do PSI-25 e <a href={d.report.url} target="_blank" rel="noreferrer">{d.report.number}</a>, {d.report.section}.
        A conferência é automática e só olha o que as duas fontes têm em comum; ela não diz qual das duas está certa.
      </p>
    </>
  )
}
