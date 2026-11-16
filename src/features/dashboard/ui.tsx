// Small pieces shared by the three panes: the data-class tag, the pane header, request states and the chart tooltip.
import { useCallback, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import type { Async } from './useAsync'

// What kind of statement a block makes. The dashboard never mixes these under one label.
export type DataClass = 'measured' | 'extracted' | 'derived' | 'summary' | 'curve' | 'heuristic' | 'proposed' | 'rule' | 'change'
const CLASS: Record<DataClass, { label: string; title: string }> = {
  measured: { label: 'Tabulated observation', title: 'A value as NASA tabulated it in a PSI experimental table.' },
  extracted: { label: 'Extracted from report', title: 'A value the Atlas read out of a NASA report with text rules and manual corrections. Open audit items may apply.' },
  derived: { label: 'Derived statistic', title: 'A count, range, mean or share calculated by the Atlas API over the tabulated observations.' },
  summary: { label: 'API summary · numbers + interpretation', title: 'A sentence written by the Atlas API from a fixed template. Its numbers are computed from the tables; its wording also interprets them.' },
  curve: { label: 'Published-curve estimate', title: 'A value read from a correlation NASA published. It is not a measurement of this condition.' },
  heuristic: { label: 'Heuristic ranking', title: 'An ordering produced by a fixed weighting rule. It is not a probability, a risk or a quality score.' },
  proposed: { label: 'Proposed · not performed', title: 'A future experiment suggested by the Atlas methodology. NASA has not run it.' },
  rule: { label: 'Evidence coverage rule', title: 'A fixed classification of whether tests exist at a condition. It says nothing about safety.' },
  change: { label: 'Change since last ingestion', title: 'What the latest Atlas ingestion added to the archive. A fact about the data set, not a physical finding.' },
}
export function Tag({ k, children }: { k: DataClass; children?: ReactNode }) {
  return <span className={`dtag dtag-${k}`} title={CLASS[k].title}><i aria-hidden="true" />{children ?? CLASS[k].label}</span>
}
export function ClassLegend() {
  return (
    <ul className="dlegend" aria-label="Kinds of statement on this screen">
      {(Object.keys(CLASS) as DataClass[]).map((k) => (<li key={k}><Tag k={k} /><span>{CLASS[k].title}</span></li>))}
    </ul>
  )
}

export function PaneHead({ n, title, question, children }: { n: string; title: string; question: string; children?: ReactNode }) {
  return (
    <header className="dpane-head">
      <div className="dpane-title"><span className="dpane-n">{n}</span><h2>{title}</h2></div>
      <p className="dpane-q">{question}</p>
      {children}
    </header>
  )
}

// Loading, failure and "the service answered but has nothing" are three different messages.
export function Pending({ what }: { what: string }) { return <p className="dstate" role="status"><i className="dspin" aria-hidden="true" />Loading {what}…</p> }
export function Failed({ what, error, retry }: { what: string; error: string; retry: () => void }) {
  return (
    <div className="dstate dstate-bad" role="alert">
      <p><b>Could not load {what}.</b> {error}</p>
      <p>Nothing is shown in its place: this screen has no fallback values.</p>
      <button className="dbtn" onClick={retry}>Try again</button>
    </div>
  )
}
export function Empty({ children }: { children: ReactNode }) { return <p className="dstate dstate-empty">{children}</p> }
export function Gate<T>({ r, what, children }: { r: Async<T>; what: string; children: (data: T) => ReactNode }) {
  if (r.error) return <Failed what={what} error={r.error} retry={r.reload} />
  if (!r.data) return <Pending what={what} />
  // while a newer answer is on its way the previous one stays, dimmed, so it is not read as current
  return <div className={`dgate${r.loading ? ' busy' : ''}`} aria-busy={r.loading}>{children(r.data)}</div>
}

export function Section({ title, tag, aside, children, className }: { title: string; tag?: DataClass; aside?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`dsec${className ? ' ' + className : ''}`}>
      <div className="dsec-head"><h3>{title}</h3>{tag && <Tag k={tag} />}{aside && <span className="dsec-aside">{aside}</span>}</div>
      {children}
    </section>
  )
}

// What every chart needs from its wrapper: the width it really has (charts are drawn at pixel size, so
// labels keep their size in a narrow column) and a tooltip that follows the pointer. Marks call
// show(event, content) and hide().
export function useTip() {
  const host = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(520)
  useLayoutEffect(() => {
    const el = host.current
    if (!el) return
    const measure = () => setWidth((w) => { const n = Math.max(280, Math.round(el.clientWidth)); return n === w ? w : n })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const [tip, setTip] = useState<{ x: number; y: number; w: number; body: ReactNode } | null>(null)
  const show = useCallback((e: { clientX: number; clientY: number }, body: ReactNode) => {
    const r = host.current?.getBoundingClientRect()
    if (r) setTip({ x: e.clientX - r.left, y: e.clientY - r.top, w: r.width, body })
  }, [])
  const hide = useCallback(() => setTip(null), [])
  const el = tip && (
    <div className="dtip" role="status" style={{ left: Math.min(Math.max(tip.x, 90), Math.max(90, tip.w - 90)), top: tip.y }}>{tip.body}</div>
  )
  return { host, show, hide, el, width }
}

// The linear and log scales live in src/lib/scale.ts and the per-widget error boundary in src/components/Guard.tsx
// (the old pages use them too). Re-exported here so the panes keep importing them from one place.
export { lin, logScale } from '../../lib/scale'
export { Guard } from '../../components/Guard'
