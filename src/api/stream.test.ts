// Testes do leitor de SSE: parseFrame (um bloco) e askStream (o stream inteiro, com fetch simulado).
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Scenario } from '../types'
import { askStream, parseFrame } from './stream'

const scenario: Scenario = { o2: 0.21, pressure_atm: 1, gravity: 0, family: 'solido', material: 'pmma', habitat: 'iss' }
const enc = new TextEncoder()
const frame = (event: string, data: unknown, nl = '\n') => `event: ${event}${nl}data: ${JSON.stringify(data)}${nl}${nl}`

// Um corpo de resposta que entrega os pedaços um a um, como a rede faria. keepOpen: a conexão não fecha sozinha.
function body(chunks: (string | Uint8Array)[], opts: { keepOpen?: boolean; onCancel?: () => void } = {}) {
  return new ReadableStream<Uint8Array>({
    start(c) {
      for (const ch of chunks) c.enqueue(typeof ch === 'string' ? enc.encode(ch) : ch)
      if (!opts.keepOpen) c.close()
    },
    cancel() { opts.onCancel?.() },
  })
}
function stubFetch(res: Response | ((url: string, init?: RequestInit) => Promise<Response>)) {
  const f = vi.fn(typeof res === 'function' ? res : async () => res)
  vi.stubGlobal('fetch', f)
  return f
}
const sse = (chunks: (string | Uint8Array)[], opts?: { keepOpen?: boolean; onCancel?: () => void }) =>
  new Response(body(chunks, opts), { status: 200, headers: { 'content-type': 'text/event-stream' } })

// Registra a ordem em que os eventos chegam aos handlers.
function recorder() {
  const seen: string[] = []
  return { seen, on: { contexto: (c: unknown) => { seen.push('contexto:' + JSON.stringify(c)) }, texto: (t: string) => { seen.push('texto:' + t) } } }
}

afterEach(() => { vi.unstubAllGlobals() })

describe('parseFrame', () => {
  it('lê um quadro normal', () => {
    expect(parseFrame('event: texto\ndata: {"t":"olá"}')).toEqual({ event: 'texto', d: { t: 'olá' } })
  })
  it('aceita o quadro sem espaço depois dos dois-pontos', () => {
    expect(parseFrame('event:texto\ndata:{"t":"olá"}')).toEqual({ event: 'texto', d: { t: 'olá' } })
  })
  it('sem linha "event", o evento é "message"', () => {
    expect(parseFrame('data: {"a":1}')).toEqual({ event: 'message', d: { a: 1 } })
  })
  it('junta várias linhas "data" num JSON só', () => {
    expect(parseFrame('event: contexto\ndata: {"a":1,\ndata: "b":2}')).toEqual({ event: 'contexto', d: { a: 1, b: 2 } })
  })
  it('ignora as linhas que não são event nem data (id, retry, comentário)', () => {
    expect(parseFrame('id: 7\nretry: 1000\n: comentário\nevent: texto\ndata: {"t":"x"}')).toEqual({ event: 'texto', d: { t: 'x' } })
  })
  it('devolve null para um ping (comentário) e para um bloco vazio', () => {
    expect(parseFrame(': ping')).toBeNull()
    expect(parseFrame('')).toBeNull()
    expect(parseFrame('event: texto')).toBeNull()   // evento sem dados
  })
  it('devolve null para JSON inválido', () => {
    expect(parseFrame('event: texto\ndata: {"t":')).toBeNull()
    expect(parseFrame('event: texto\ndata: <html>502 Bad Gateway</html>')).toBeNull()
  })
  it('devolve null para JSON que não é um objeto (null, número, texto, lista)', () => {
    for (const data of ['null', '5', '"texto"', 'true', '[1,2]']) expect(parseFrame(`event: texto\ndata: ${data}`)).toBeNull()
  })
})

describe('askStream', () => {
  const answer = { answer: 'A chama apaga.', citations: [], conversation_id: 'c1' }
  const ctx = { scenario, scenario_changed: false, understood: [], verdict: { tier: 'medido' } }

  it('faz um POST em /ask/stream com a pergunta, o cenário e a conversa', async () => {
    const f = stubFetch(sse([frame('resposta', answer)]))
    const ctrl = new AbortController()
    await askStream('apaga?', scenario, 'c0', {}, ctrl.signal)
    expect(f).toHaveBeenCalledTimes(1)
    const [url, init] = f.mock.calls[0]
    expect(url).toMatch(/\/api\/ask\/stream$/)
    expect(init?.method).toBe('POST')
    expect(init?.headers).toEqual({ 'content-type': 'application/json', accept: 'text/event-stream' })
    expect(JSON.parse(String(init?.body))).toEqual({ question: 'apaga?', scenario, conversation_id: 'c0' })
    expect(init?.signal).toBe(ctrl.signal)
  })

  it('stream com \\n\\n: contexto, texto em pedaços e a resposta, nessa ordem', async () => {
    stubFetch(sse([frame('contexto', ctx), frame('texto', { t: 'A chama ' }), frame('texto', { t: 'apaga.' }), frame('resposta', answer)]))
    const r = recorder()
    await expect(askStream('q', scenario, '', r.on)).resolves.toEqual(answer)
    expect(r.seen).toEqual(['contexto:' + JSON.stringify(ctx), 'texto:A chama ', 'texto:apaga.'])
  })

  it('stream com \\r\\n\\r\\n (um proxy que entrega CRLF)', async () => {
    stubFetch(sse([frame('contexto', ctx, '\r\n'), frame('texto', { t: 'A chama ' }, '\r\n'), frame('texto', { t: 'apaga.' }, '\r\n'), frame('resposta', answer, '\r\n')]))
    const r = recorder()
    await expect(askStream('q', scenario, '', r.on)).resolves.toEqual(answer)
    expect(r.seen).toEqual(['contexto:' + JSON.stringify(ctx), 'texto:A chama ', 'texto:apaga.'])
  })

  it('vários quadros no mesmo pedaço', async () => {
    stubFetch(sse([frame('texto', { t: 'a' }) + frame('texto', { t: 'b' }) + frame('resposta', answer)]))
    const r = recorder()
    await expect(askStream('q', scenario, '', r.on)).resolves.toEqual(answer)
    expect(r.seen).toEqual(['texto:a', 'texto:b'])
  })

  it('quadro partido entre dois pedaços (no meio do JSON e no meio do separador)', async () => {
    const texto = frame('texto', { t: 'A chama apaga.' }), resposta = frame('resposta', answer)
    stubFetch(sse([texto.slice(0, 20), texto.slice(20, -1), texto.slice(-1) + resposta.slice(0, 5), resposta.slice(5)]))
    const r = recorder()
    await expect(askStream('q', scenario, '', r.on)).resolves.toEqual(answer)
    expect(r.seen).toEqual(['texto:A chama apaga.'])
  })

  // O pior caso de fragmentação: cada byte num pedaço. Cobre o corte entre \r e \n e no meio de um caractere
  // de mais de um byte (ç, ã, 🔥).
  it.each([['\\n', '\n'], ['\\r\\n', '\r\n']])('stream entregue byte a byte, com %s', async (_name, nl) => {
    const text = frame('contexto', ctx, nl) + frame('texto', { t: 'combustão 🔥 ' }, nl) + frame('texto', { t: 'extinção' }, nl) + frame('resposta', answer, nl)
    stubFetch(sse([...enc.encode(text)].map((b) => Uint8Array.of(b))))
    const r = recorder()
    await expect(askStream('q', scenario, '', r.on)).resolves.toEqual(answer)
    expect(r.seen).toEqual(['contexto:' + JSON.stringify(ctx), 'texto:combustão 🔥 ', 'texto:extinção'])
  })

  it('quadro malformado no meio não derruba a resposta', async () => {
    stubFetch(sse([
      frame('texto', { t: 'a' }),
      ': ping\n\n',                              // comentário de keep-alive
      'event: texto\ndata: {"t": "cortad\n\n',   // JSON inválido
      'event: texto\ndata: null\n\n',            // JSON válido, mas não é um objeto
      'event: texto\n\n',                        // sem dados
      '\n\n',                                    // bloco vazio
      frame('desconhecido', { x: 1 }),           // evento que este cliente não conhece
      frame('texto', { t: 'b' }),
      frame('resposta', answer),
    ]))
    const r = recorder()
    await expect(askStream('q', scenario, '', r.on)).resolves.toEqual(answer)
    expect(r.seen).toEqual(['texto:a', 'texto:b'])
  })

  it('funciona sem handlers', async () => {
    stubFetch(sse([frame('contexto', ctx), frame('texto', { t: 'a' }), frame('resposta', answer)]))
    await expect(askStream('q', scenario, '', {})).resolves.toEqual(answer)
  })

  it('evento "erro": rejeita com a mensagem do servidor', async () => {
    stubFetch(sse([frame('texto', { t: 'a' }), frame('erro', { error: 'o modelo não respondeu' }), frame('resposta', answer)]))
    const r = recorder()
    await expect(askStream('q', scenario, '', r.on)).rejects.toThrow('o modelo não respondeu')
    expect(r.seen).toEqual(['texto:a'])   // o texto que já tinha chegado foi entregue
  })

  it('evento "erro" sem mensagem: rejeita com a mensagem padrão', async () => {
    stubFetch(sse([frame('erro', {})]))
    await expect(askStream('q', scenario, '', {})).rejects.toThrow('The server could not answer.')
  })

  it('conexão que fecha sem a resposta: rejeita', async () => {
    stubFetch(sse([frame('contexto', ctx), frame('texto', { t: 'a' })]))
    const r = recorder()
    await expect(askStream('q', scenario, '', r.on)).rejects.toThrow('The connection closed before the answer arrived.')
    expect(r.seen).toHaveLength(2)
  })

  it('conexão que fecha no meio do último quadro (sem a linha em branco): o quadro incompleto não vale', async () => {
    stubFetch(sse([frame('texto', { t: 'a' }), `event: resposta\ndata: ${JSON.stringify(answer)}\n`]))
    await expect(askStream('q', scenario, '', {})).rejects.toThrow('The connection closed before the answer arrived.')
  })

  it('stream vazio: rejeita', async () => {
    stubFetch(sse([]))
    await expect(askStream('q', scenario, '', {})).rejects.toThrow('The connection closed before the answer arrived.')
  })

  it('devolve a resposta sem esperar a conexão fechar, e a libera', async () => {
    const onCancel = vi.fn()
    stubFetch(sse([frame('resposta', answer), frame('texto', { t: 'depois do fim' })], { keepOpen: true, onCancel }))
    const r = recorder()
    await expect(askStream('q', scenario, '', r.on)).resolves.toEqual(answer)
    expect(r.seen).toEqual([])   // nada depois da resposta chega aos handlers
    await vi.waitFor(() => expect(onCancel).toHaveBeenCalledTimes(1))
  })

  it('libera a conexão também quando o stream traz um erro', async () => {
    const onCancel = vi.fn()
    stubFetch(sse([frame('erro', { error: 'falhou' })], { keepOpen: true, onCancel }))
    await expect(askStream('q', scenario, '', {})).rejects.toThrow('falhou')
    await vi.waitFor(() => expect(onCancel).toHaveBeenCalledTimes(1))
  })

  it('resposta HTTP de erro com JSON: rejeita com o campo error', async () => {
    stubFetch(new Response(JSON.stringify({ error: 'pergunta vazia' }), { status: 400, headers: { 'content-type': 'application/json' } }))
    await expect(askStream('', scenario, '', {})).rejects.toThrow('pergunta vazia')
  })

  it('resposta HTTP de erro sem JSON (página do proxy): rejeita com o status', async () => {
    stubFetch(new Response('<html>Bad Gateway</html>', { status: 502, headers: { 'content-type': 'text/html' } }))
    await expect(askStream('q', scenario, '', {})).rejects.toThrow('The server responded with 502')
  })

  it('resposta 200 sem corpo: rejeita', async () => {
    stubFetch(new Response(null, { status: 200 }))
    await expect(askStream('q', scenario, '', {})).rejects.toThrow('The server responded with 200')
  })

  it('falha de rede no fetch: rejeita com o erro do fetch', async () => {
    stubFetch(() => Promise.reject(new TypeError('Failed to fetch')))
    await expect(askStream('q', scenario, '', {})).rejects.toThrow('Failed to fetch')
  })

  // O fetch de verdade faz o corpo falhar com AbortError quando o sinal dispara; o simulado faz o mesmo.
  it('cancelamento por AbortSignal no meio do stream: rejeita com AbortError e não entrega mais nada', async () => {
    const ctrl = new AbortController()
    stubFetch((_url, init) => {
      const signal = init?.signal
      return Promise.resolve(new Response(new ReadableStream<Uint8Array>({
        start(c) {
          c.enqueue(enc.encode(frame('texto', { t: 'parcial' })))
          signal?.addEventListener('abort', () => c.error(signal.reason))
        },
      })))
    })
    const r = recorder()
    const settled = askStream('q', scenario, '', r.on, ctrl.signal).then(() => 'resolveu', (e: Error) => e)
    await vi.waitFor(() => expect(r.seen).toEqual(['texto:parcial']))
    ctrl.abort()
    const err = await settled
    expect(err).toBeInstanceOf(Error)
    expect((err as Error).name).toBe('AbortError')
    expect(ctrl.signal.aborted).toBe(true)
    expect(r.seen).toEqual(['texto:parcial'])
  })

  it('sinal já cancelado antes do pedido: rejeita com AbortError', async () => {
    const ctrl = new AbortController()
    ctrl.abort()
    const f = stubFetch((_url, init) => (init?.signal?.aborted ? Promise.reject(init.signal.reason) : Promise.resolve(sse([frame('resposta', answer)]))))
    await expect(askStream('q', scenario, '', {}, ctrl.signal)).rejects.toMatchObject({ name: 'AbortError' })
    expect(f).toHaveBeenCalledTimes(1)
  })
})
