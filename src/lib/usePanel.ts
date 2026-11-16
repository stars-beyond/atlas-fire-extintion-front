// Floating panels on the stage (map legend, list of gaps, the explanation of each view) can be minimized.
// The choice is kept per panel, in memory and in localStorage, so a panel the person minimized stays that way
// when the view is opened again. Storage is optional: without it the choice lasts for the page only.
import { useCallback, useSyncExternalStore } from 'react'

const KEY = 'atlas.panels'
let state: Record<string, boolean> = {}
try {
  const saved = JSON.parse(localStorage.getItem(KEY) || '{}')
  if (saved && typeof saved === 'object') state = saved
} catch { /* no storage, or an unreadable value: every panel starts open */ }
const subs = new Set<() => void>()
const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f) } }

/** [minimized, toggle] for the panel with this id. */
export function useMinimized(id: string): [boolean, () => void] {
  const min = useSyncExternalStore(subscribe, () => state[id] === true)
  const toggle = useCallback(() => {
    state = { ...state, [id]: !state[id] }
    try { localStorage.setItem(KEY, JSON.stringify(state)) } catch { /* storage unavailable */ }
    subs.forEach((f) => f())
  }, [id])
  return [min, toggle]
}
