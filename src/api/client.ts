// Cliente HTTP da API do Atlas: onde ela está e o pedido JSON comum a todos os módulos.

// Onde a API está. As URLs são públicas e ficam no código (nada de .env para isso):
//   - VITE_API_URL, quando o build a define (vite.config.ts: no Cloudflare, a API de produção em qualquer branch);
//   - sem ela, em localhost: /api pelo proxy do Vite (npm run dev);
//   - sem ela, fora de localhost: a API de produção. Um build sem a variável nunca chama /api no próprio domínio,
//     onde o Worker devolveria o index.html e o app quebraria ("t.habitats.map").
export const API_PROD = 'https://api.atlas-stars-beyond.tech'
const isLocal = typeof location !== 'undefined' && /^(localhost|127\.0\.0\.1|\[::1\])$|\.localhost$/.test(location.hostname)
const fromBuild = (import.meta.env.VITE_API_URL ?? '').trim()
export const API_ORIGIN = (fromBuild || (isLocal ? '' : API_PROD)).replace(/\/+$/, '')
export const API_BASE = API_ORIGIN + '/api'
export const apiUrl = (path: string) => API_BASE + path

export async function j<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(apiUrl(path), body === undefined ? undefined : {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  })
  // Só JSON conta como resposta da API. Uma página HTML (o index.html do site, um erro do Cloudflare ou do nginx)
  // vira um erro com a causa, em vez de um objeto vazio que quebraria a tela mais adiante.
  const isJson = (res.headers.get('content-type') ?? '').includes('json')
  const data = isJson ? await res.json().catch(() => null) : null
  if (!res.ok) throw new Error(data?.error || `The Atlas API at ${API_BASE} responded with ${res.status}`)
  if (data === null) throw new Error(`The Atlas API at ${API_BASE} did not answer with data (got ${res.headers.get('content-type') || 'no content type'}). Check that the API address is right and the API is up.`)
  return data as T
}
