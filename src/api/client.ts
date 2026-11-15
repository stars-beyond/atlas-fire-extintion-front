// Cliente HTTP da API do Atlas: onde ela está e o pedido JSON comum a todos os módulos.

// Onde a API está. Em produção, VITE_API_URL (.env.production) = https://api.atlas-stars-beyond.tech e o
// navegador chama a API direto (ela libera CORS). Sem VITE_API_URL (npm run dev), usa /api pelo proxy do Vite.
export const API_BASE = (import.meta.env.VITE_API_URL ?? '').trim().replace(/\/+$/, '') + '/api'
export const apiUrl = (path: string) => API_BASE + path

export async function j<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(apiUrl(path), body === undefined ? undefined : {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `The server responded with ${res.status}`)
  return data as T
}
