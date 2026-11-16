// One request with its three honest states: loading, failed (with the server's message) and loaded.
// `reload` repeats it; a change in `deps` repeats it too, and a late answer from an older request is dropped.
import { useCallback, useEffect, useRef, useState } from 'react'

export interface Async<T> { data: T | null; error: string | null; loading: boolean; reload: () => void }

export function useAsync<T>(fn: () => Promise<T>, deps: unknown[], delayMs = 0): Async<T> {
  const [state, setState] = useState<{ data: T | null; error: string | null; loading: boolean }>({ data: null, error: null, loading: true })
  const [tick, setTick] = useState(0)
  const fnRef = useRef(fn)
  fnRef.current = fn
  useEffect(() => {
    let live = true
    setState((s) => ({ ...s, loading: true, error: null }))
    const run = () => fnRef.current()
      .then((data) => { if (live) setState({ data, error: null, loading: false }) })
      .catch((e) => { if (live) setState({ data: null, error: String(e?.message || e || 'Request failed'), loading: false }) })
    const t = setTimeout(run, delayMs)
    return () => { live = false; clearTimeout(t) }
  }, [...deps, tick]) // eslint-disable-line react-hooks/exhaustive-deps
  const reload = useCallback(() => setTick((n) => n + 1), [])
  return { ...state, reload }
}
