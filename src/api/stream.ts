// Leitor da pergunta em streaming (Server-Sent Events).
import type { Answer, AskStreamHandlers, Scenario } from '../types'
import { apiUrl } from './client'

// Pergunta em streaming (Server-Sent Events via fetch, porque o EventSource não faz POST):
// o veredito chega primeiro, o texto em pedaços enquanto o RAG escreve, e no fim a resposta completa e validada.
export async function askStream(question: string, scenario: Scenario, conversation_id: string, on: AskStreamHandlers, signal?: AbortSignal): Promise<Answer> {
  const res = await fetch(apiUrl('/ask/stream'), {
    method: 'POST', headers: { 'content-type': 'application/json', accept: 'text/event-stream' },
    body: JSON.stringify({ question, scenario, conversation_id }), signal,
  })
  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || `O servidor respondeu ${res.status}`)
  }
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader()
  let buf = ''
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buf += value
    let cut: number
    while ((cut = buf.indexOf('\n\n')) >= 0) {
      const block = buf.slice(0, cut); buf = buf.slice(cut + 2)
      let event = 'message', data = ''
      for (const line of block.split('\n')) {
        if (line.startsWith('event: ')) event = line.slice(7)
        else if (line.startsWith('data: ')) data += line.slice(6)
      }
      if (!data) continue   // ": ping" e linhas vazias
      const d = JSON.parse(data)
      if (event === 'contexto') on.contexto?.(d)
      else if (event === 'texto') on.texto?.(d.t)
      else if (event === 'resposta') return d as Answer
      else if (event === 'erro') throw new Error(d.error || 'O servidor não conseguiu responder.')
    }
  }
  throw new Error('A conexão terminou antes da resposta.')
}
