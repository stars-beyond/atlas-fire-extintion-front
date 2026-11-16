// Aba "Perguntar" do test drive: a caixa de pergunta, os exemplos e o histórico de respostas.
import { useState } from 'react'
import { useAtlas } from '../../state'
import { Entry } from './AnswerEntry'
import { EXAMPLES } from './examples'

export function Perguntar() {
  const { log, ask } = useAtlas()
  const [q, setQ] = useState('')
  const send = () => { if (q.trim()) { ask(q); setQ('') } }
  return (
    <div className="block">
      <h2>Ask the Atlas</h2>
      <p>It answers with what is in NASA tests and reports, and shows the source of every sentence.</p>
      <div className="askbox">
        <textarea value={q} onChange={(e) => setQ(e.target.value)} placeholder="Type your question" aria-label="Your question"
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }} />
        <button className="cta" onClick={send} disabled={!q.trim()}>Ask</button>
      </div>
      {log.length === 0 && <div className="chips">{EXAMPLES.map((x) => (<button key={x} onClick={() => ask(x)}>{x}</button>))}</div>}
      {log.map((e) => (<Entry key={e.id} e={e} />))}
    </div>
  )
}
