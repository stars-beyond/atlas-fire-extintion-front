// A chama prevista no capítulo: o filme térmico das redes da equipe (Atlas-MachineL), servido pela API do Atlas em
// /api/predict/thermal, para o ar da cabine naquele instante. Vale para um filme fino de acrílico (PMMA) em
// microgravidade; fora da faixa do modelo a API não devolve filme e a razão é mostrada.
import { useEffect, useRef, useState } from 'react'
import { api } from '../../api'
import type { Thermal } from '../../types'
import { decode, paint, TEMP, type Film } from '../stage/ThermalStage'
import { num } from './format'

const cache = new Map<string, Promise<Thermal>>()
function load(o2: number, kpa: number, flow: number) {
  const key = `${o2.toFixed(1)}|${kpa.toFixed(1)}|${flow.toFixed(1)}`
  let p = cache.get(key)
  if (!p) {
    // o motor fala em % de O₂ e kPa; o cenário do Atlas, em fração de O₂ e atm
    p = api.thermal({ o2: o2 / 100, pressure_atm: kpa / 101.325, gravity: 0, family: 'solido', material: 'pmma' }, flow, false)
    p.catch(() => cache.delete(key))
    cache.set(key, p)
  }
  return p
}

export function StoryFlame({ o2, p, flow }: { o2: number; p: number; flow: number }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const [film, setFilm] = useState<Film | null>(null)
  const [none, setNone] = useState<string | null>(null)
  const [frame, setFrame] = useState(0)

  useEffect(() => {
    let live = true
    setFilm(null); setNone(null)
    load(o2, p, flow)
      .then(async (d) => {
        if (!live) return
        if (!d.available) { setNone(d.reason || 'The model has no film for this atmosphere.'); return }
        const f = await decode(d)
        if (live) setFilm(f)
      })
      .catch((e) => { if (live) setNone(e.message || 'The predicted flame is unavailable.') })
    return () => { live = false }
  }, [o2, p, flow])

  useEffect(() => {
    if (!film) return
    const { d, frames, metal, n } = film
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduce) { paint(canvas.current, frames, d.w, d.h, n - 1, TEMP, metal); setFrame(n - 1); return }
    let raf = 0, last = -1
    const start = performance.now(), hold = 1.2   // segura o último quadro antes de recomeçar
    const tick = (now: number) => {
      const t = ((now - start) / 1000) % (n / d.fps + hold)
      const k = Math.min(n - 1, Math.floor(t * d.fps))
      if (k !== last) { paint(canvas.current, frames, d.w, d.h, k, TEMP, metal); setFrame(k); last = k }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [film])

  if (none) return <p className="story-flame-none">{none}</p>
  const d = film?.d
  const predicted = d ? frame >= d.history : false
  return (
    <figure className="story-flame-fig">
      <div className="story-flame-stage">
        <canvas ref={canvas} role="img" aria-label="Thermal map of the flame predicted by the trained model" />
        <span className={`story-flame-tag${predicted ? ' pred' : ''}`}>
          {d ? `${predicted ? 'model prediction' : 'measured history (ZARM)'} · t = ${num(frame / d.fps, 1)} s` : 'loading frames…'}
        </span>
      </div>
      {d && (
        <figcaption>
          {d.v_mm_s != null ? <>Flame front at <b className="mono">{num(d.v_mm_s, 2)} mm/s</b>{d.nets_mm_s ? <> (networks {num(d.nets_mm_s[0], 2)}–{num(d.nets_mm_s[1], 2)})</> : null}. </> : null}
          {num(d.o2_pct, 1)}% O₂, {num(d.pressure_kpa, 0)} kPa, {num(d.flow_cm_s, 0)} cm/s. The first {d.history} frames are a real ZARM test; the rest is predicted. Grey = metal barriers.
        </figcaption>
      )}
    </figure>
  )
}
