// Links whose address comes from the API (catalog records, citations, external data sets).

// Returns the address only when it is safe to put in an href: http(s) or a relative path. Anything with another
// scheme (javascript:, data:, ...) becomes undefined, and the <a> renders as plain text. React 18 only warns
// about javascript: URLs, it does not block them.
export function safeHref(u: unknown): string | undefined {
  if (typeof u !== 'string') return undefined
  const s = u.replace(/[\u0000- ]+/g, '')   // browsers ignore spaces and control characters inside the scheme
  if (!s) return undefined
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(s)
  return !scheme || /^https?$/i.test(scheme[1]) ? u : undefined
}

// The page of one investigation in NASA's Physical Sciences Informatics repository.
export const psiUrl = (id: string) => `https://psi.nasa.gov/physci/repo/data/investigations/${id}`
