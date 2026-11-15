// Uma pergunta e sua resposta: o texto chegando aos pedaços, as fontes citadas e o aviso de como foi gerado.
import { useState } from 'react'
import { nf } from '../../lib/format'
import { useAtlas, type LogEntry } from '../../state'
import type { Citation } from '../../types'
import { Markdown } from './Markdown'

export function Entry({ e }: { e: LogEntry }) {
  const { selectTest, setStageView } = useAtlas()
  const [open, setOpen] = useState<number | null>(null)
  const a = e.answer
  const onCite = (c: Citation) => { setOpen((o) => (o === c.n ? null : c.n)); if (c.test_id) { selectTest(c.test_id); setStageView('mapa') } }
  return (
    <article className="qa">
      <h3>{e.question}</h3>
      {e.pending && !e.partial && <p className="hint">{e.verdict ? `Evidence: ${e.verdict.label}. Reading NASA reports…` : 'Reading NASA tests and reports…'}</p>}
      {e.pending && e.partial && (<><div className="streaming"><Markdown text={e.partial} onCite={() => {}} /></div><p className="hint">Writing… sources appear at the end.</p></>)}
      {e.error && <p className="hint bad">Could not answer: {e.error}. Try again.</p>}
      {a && (
        <>
          <Markdown text={a.answer} onCite={(n) => { const c = a.citations.find((x) => x.n === n); if (c) onCite(c) }} />
          {a.warning && <p className="hint">{a.warning}</p>}
          {a.citations.length > 0 && (
            <div className="sources">
              <span className="eyebrow">Sources</span>
              {a.citations.map((c) => (
                <button key={c.n} className={`source${open === c.n ? ' open' : ''}`} onClick={() => onCite(c)}>
                  <span className="cite">{c.n}</span>
                  <span>
                    <b>{c.title}</b><span className="mono">{c.where}</span>
                    {open === c.n && (
                      <>
                        <span className="excerpt">{c.text}</span>
                        {c.note && <span className="excerpt"><span className="tag warn">{c.note}</span></span>}
                        {c.warnings?.map((w) => (<span key={w} className="excerpt">Warning: {w}</span>))}
                        {c.url && <a className="excerpt" href={c.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>Open the official source</a>}
                      </>
                    )}
                  </span>
                </button>
              ))}
            </div>
          )}
          <p className="hint">{a.mode === 'rag' ? `Answered by the team's RAG from ${nf(a.sources.rag_trechos ?? 0)} excerpts of NASA documents. AI-generated text based on the sources above.`
            : a.mode === 'si' ? 'AI-written text based on the sources above.' : 'Answer built from the data alone, with no generated text.'}{a.abstained ? ' This topic is outside the archive.' : ''}</p>
        </>
      )}
    </article>
  )
}
