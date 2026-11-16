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
    throw new Error(data.error || `The server responded with ${res.status}`)
  }
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader()
  let buf = ''
  try {
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      buf = (buf + value).replace(/\r\n/g, '\n')   // um proxy pode entregar CRLF; o SSE aceita os dois
      let cut: number
      while ((cut = buf.indexOf('\n\n')) >= 0) {
        const block = buf.slice(0, cut); buf = buf.slice(cut + 2)
        const frame = parseFrame(block)
        if (!frame) continue   // ": ping", linhas vazias e quadros ilegíveis
        const { event, d } = frame
        if (event === 'contexto') on.contexto?.(d)
        else if (event === 'texto') on.texto?.(d.t)
        else if (event === 'resposta') return d as Answer
        else if (event === 'erro') throw new Error(d.error || 'The server could not answer.')
      }
    }
    throw new Error('The connection closed before the answer arrived.')
  } finally {
    reader.cancel().catch(() => {})   // libera a conexão em qualquer saída (resposta, erro ou cancelamento)
  }
}

// Um bloco do stream: "event: nome" e uma ou mais linhas "data: ...", com ou sem espaço depois dos dois-pontos.
// Devolve null para o que não traz dados, não é JSON ou não é um objeto (todo evento do Atlas traz um objeto; com
// `data: null`, ler `d.t` lançaria um erro): um quadro ruim não derruba a resposta inteira.
export function parseFrame(block: string): { event: string; d: any } | null {
  let event = 'message', data = ''
  for (const line of block.split('\n')) {
    const m = /^(event|data):\s?(.*)$/.exec(line)
    if (!m) continue
    if (m[1] === 'event') event = m[2]; else data += m[2]
  }
  if (!data) return null
  try {
    const d = JSON.parse(data)
    return d && typeof d === 'object' && !Array.isArray(d) ? { event, d } : null
  } catch { return null }
}
