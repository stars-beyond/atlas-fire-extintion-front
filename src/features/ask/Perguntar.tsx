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
      <h2>Pergunte ao Atlas</h2>
      <p>Ele responde com o que está nos testes e relatórios da NASA, e mostra a fonte de cada frase.</p>
      <div className="askbox">
        <textarea value={q} onChange={(e) => setQ(e.target.value)} placeholder="Escreva sua pergunta" aria-label="Sua pergunta"
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }} />
        <button className="cta" onClick={send} disabled={!q.trim()}>Perguntar</button>
      </div>
      {log.length === 0 && <div className="chips">{EXAMPLES.map((x) => (<button key={x} onClick={() => ask(x)}>{x}</button>))}</div>}
      {log.map((e) => (<Entry key={e.id} e={e} />))}
    </div>
  )
}
