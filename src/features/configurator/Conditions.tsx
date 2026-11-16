// Condições da chama ajustadas à mão: oxigênio, pressão, gravidade e ventilação. Um botão amarelo abre o painel já com
// todos os parâmetros à vista. Fica no passo 1 (montar o ambiente) e no passo 3 (mudar as condições durante o teste,
// sem reiniciá-lo: keep = true mantém a chama acesa, o vento e o agente).
import { useEffect, useId, useRef, useState } from 'react'
import { gLabel, nf, pct, psi } from '../../lib/format'
import { WIND_MAX, useAtlas } from '../../state'

export function Slider({ id, label, value, min, max, step, onChange, fmt }: { id: string; label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; fmt: (v: number) => string }) {
  return (
    <div className="slider">
      <div className="slider-top"><label htmlFor={id}>{label}</label><b>{fmt(value)}</b></div>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(+e.target.value)}
        style={{ ['--fill' as string]: `${((value - min) / (max - min)) * 100}%` }} />
    </div>
  )
}

function ConditionsPanel({ id, live }: { id: string; live?: boolean }) {
  const { scenario, setScenario, wind, setWind } = useAtlas()
  return (
    <div className="sliders" id={id}>
      {live && <p className="hint">Changes apply to the running test right away: the flame stays lit.</p>}
      <Slider id={`${id}-o2`} label="Oxygen" value={scenario.o2} min={0.1} max={1} step={0.005} fmt={(v) => pct(v, 1)} onChange={(v) => setScenario({ o2: v }, undefined, true)} />
      <Slider id={`${id}-p`} label="Pressure" value={scenario.pressure_atm} min={0.25} max={3} step={0.005} fmt={(v) => `${psi(v)} (${nf(v, 2)} atm)`} onChange={(v) => setScenario({ pressure_atm: v }, undefined, true)} />
      <Slider id={`${id}-g`} label="Gravity" value={scenario.gravity} min={0} max={1} step={0.005} fmt={(v) => gLabel(v)} onChange={(v) => setScenario({ gravity: v }, undefined, true)} />
      <Slider id={`${id}-w`} label="Ventilation airflow" value={wind} min={0} max={WIND_MAX} step={1} fmt={(v) => (v > 0 ? `${nf(v, 0)} cm/s` : 'off')} onChange={setWind} />
    </div>
  )
}

// O botão e o painel. Ao abrir, o painel vem para a tela e o primeiro controle recebe o foco.
export function FlameConditions({ label = 'Simulate other flame conditions', live = false, defaultOpen = false }: { label?: string; live?: boolean; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  const id = 'cond-' + useId().replace(/:/g, '')
  const box = useRef<HTMLDivElement>(null)
  const opened = useRef(false)
  useEffect(() => {
    if (!open) { opened.current = false; return }
    if (opened.current) return
    opened.current = true
    if (defaultOpen) return   // aberto desde o início: sem rolar a tela nem roubar o foco
    box.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    box.current?.querySelector<HTMLInputElement>('input[type="range"]')?.focus({ preventScroll: true })
  }, [open, defaultOpen])
  return (
    <div className="conditions" ref={box}>
      <button type="button" className="cta conditions-btn" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}>
        <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 6h9M15 6h2M3 14h3M9 14h8" /><circle cx="13.5" cy="6" r="1.8" /><circle cx="7.5" cy="14" r="1.8" /></svg>
        {open ? 'Hide flame conditions' : label}
      </button>
      {open && <ConditionsPanel id={id} live={live} />}
    </div>
  )
}
