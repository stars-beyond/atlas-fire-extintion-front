// The button that minimizes or restores a floating panel of the stage. `label` is the panel's name, shown next
// to the icon only while the panel is minimized (when nothing else says what the button brings back).
export function MinButton({ min, onToggle, what, label }: { min: boolean; onToggle: () => void; what: string; label?: string }) {
  const text = min ? `Show ${what}` : `Minimize ${what}`
  return (
    <button type="button" className="panel-min" aria-expanded={!min} aria-label={text} title={text} onClick={onToggle}>
      {min && label && <span>{label}</span>}
      <svg viewBox="0 0 12 12" aria-hidden="true"><path d={min ? 'M2.5 4.5 6 8l3.5-3.5' : 'M2.5 6h7'} /></svg>
    </button>
  )
}
