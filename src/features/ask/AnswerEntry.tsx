// Uma pergunta e sua resposta: o texto chegando aos pedaços, as fontes citadas e o aviso de como foi gerado.
import { Component, Suspense, lazy, useEffect, useState, type ReactNode } from 'react'
import { nf } from '../../lib/format'
import { safeHref } from '../../lib/url'
import { useAtlas, type LogEntry } from '../../state'
import type { Citation } from '../../types'

// react-markdown e KaTeX só são baixados com a primeira pergunta. Enquanto não chegam, o texto aparece cru; se não
// chegarem (rede, ou o site foi atualizado com a aba aberta), ele fica cru, em vez de a resposta derrubar a tela.
const loadMarkdown = () => import('./Markdown')
const LazyMarkdown = lazy(() => loadMarkdown().then((m) => ({ default: m.Markdown })))
class PlainOnError extends Component<{ plain: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() { return this.state.failed ? this.props.plain : this.props.children }
}
function Markdown(p: { text: string; onCite: (n: number) => void }) {
  const plain = <div className="md"><p style={{ whiteSpace: 'pre-wrap' }}>{p.text}</p></div>
  return <PlainOnError plain={plain}><Suspense fallback={plain}><LazyMarkdown {...p} /></Suspense></PlainOnError>
}

export function Entry({ e }: { e: LogEntry }) {
  const { selectTest, setStageView, stopAsk } = useAtlas()
  const [open, setOpen] = useState<number | null>(null)
  useEffect(() => { loadMarkdown().catch(() => {}) }, [])   // já vai baixando enquanto a resposta não começa
  const a = e.answer
  const why = e.error?.replace(/\.$/, '')   // a frase abaixo já põe o ponto
  const onCite = (c: Citation) => { setOpen((o) => (o === c.n ? null : c.n)); if (c.test_id) { selectTest(c.test_id); setStageView('mapa') } }
  return (
    <article className="qa">
      <Suspense fallback={<p className="hint">Preparing the answer…</p>}>
      <h3>{e.question}</h3>
      {e.pending && !e.partial && <p className="hint">{e.verdict ? `Evidence: ${e.verdict.label}. Reading NASA reports…` : 'Reading NASA tests and reports…'}</p>}
      {/* o texto parcial fica na tela também quando a resposta parou no meio (Stop ou erro): apagado como no
          streaming, com as citações sem abrir nada e sem a lista de fontes, que só a resposta final validada traz */}
      {e.partial && !a && <div className="streaming"><Markdown text={e.partial} onCite={() => {}} /></div>}
      {e.pending && e.partial && <p className="hint">Writing… sources appear at the end.</p>}
      {e.pending && <button type="button" className="ghost" onClick={() => stopAsk(e.id)}>Stop</button>}
      {e.stopped && <p className="hint">{e.partial ? 'Stopped. The text above is incomplete and was not checked against the sources.' : 'Stopped before the answer arrived.'}</p>}
      {e.error && <p className="hint bad">{e.partial ? `The answer stopped halfway: ${why}. The text above is incomplete and was not checked against the sources. Try again.` : `Could not answer: ${why}. Try again.`}</p>}
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
                        {safeHref(c.url) && <a className="excerpt" href={safeHref(c.url)} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>Open the official source</a>}
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
      </Suspense>
    </article>
  )
}
