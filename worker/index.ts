// Worker do Atlas no Cloudflare (Workers & Pages).
//
// - /api/*  → repassado ao backend (API Go do atlas-fire-extintion), no endereço de API_ORIGIN.
//             Assim o navegador fala só com este domínio: sem CORS, sem conteúdo misto e com
//             o endereço do backend trocável no painel, sem refazer o build.
// - o resto → arquivos estáticos do build do Vite (dist/), com fallback de SPA para index.html.
//
// Nenhum cálculo acontece aqui: o Worker só encaminha.

interface Env {
  ASSETS: Fetcher
  /** Origem do backend, ex.: https://api.seudominio.com ou http://atlas-api.seudominio.com:8787 */
  API_ORIGIN?: string
}

const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/

const jsonError = (status: number, error: string) =>
  new Response(JSON.stringify({ error }), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } })

async function proxy(request: Request, env: Env): Promise<Response> {
  const origin = (env.API_ORIGIN ?? '').trim().replace(/\/+$/, '')
  if (!origin) return jsonError(503, 'API_ORIGIN não configurada no Worker: defina o endereço do backend do Atlas.')

  let base: URL
  try { base = new URL(origin) } catch { return jsonError(500, `API_ORIGIN inválida: ${origin}`) }
  // O Cloudflare não deixa um Worker chamar um IP direto (erro 1003). O backend precisa de um nome:
  // um registro DNS apontando para o IP, ou um Cloudflare Tunnel.
  if (IPV4.test(base.hostname) || base.hostname.startsWith('['))
    return jsonError(502, `API_ORIGIN usa um IP (${base.hostname}). O Cloudflare bloqueia fetch para IP: crie um registro DNS para ele e use o nome.`)

  const url = new URL(request.url)
  const target = new URL(url.pathname + url.search, base)
  const headers = new Headers(request.headers)
  headers.delete('host')
  headers.set('x-forwarded-host', url.host)
  headers.set('x-forwarded-proto', url.protocol.replace(':', ''))
  const ip = request.headers.get('cf-connecting-ip')
  if (ip) headers.set('x-forwarded-for', ip)

  try {
    const res = await fetch(target.toString(), {
      method: request.method,
      headers,
      body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
      redirect: 'manual',
    })
    const out = new Response(res.body, res)
    out.headers.set('cache-control', out.headers.get('cache-control') ?? 'no-store')
    return out
  } catch (e) {
    return jsonError(502, `Não foi possível falar com o backend do Atlas (${target.host}): ${(e as Error).message}`)
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url)
    if (pathname === '/api' || pathname.startsWith('/api/')) return proxy(request, env)
    return env.ASSETS.fetch(request)
  },
} satisfies ExportedHandler<Env>
