// A chama ilustrada em canvas 2D. A forma segue a física conhecida (sem empuxo ela é uma esfera azul;
// com gravidade sobe em gota e amarela). É só desenho: o veredito vem dos testes.
import { useEffect, useRef } from 'react'
import type { MaterialOption } from '../../state'

interface FlameProps { gravity: number; o2: number; strength: number; lit: boolean; mat: MaterialOption }

export function FlameCanvas(props: FlameProps) {
  const ref = useRef<HTMLCanvasElement>(null)
  const p = useRef(props); p.current = props
  useEffect(() => {
    const c = ref.current!, g = c.getContext('2d')!
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
    let raf = 0, t = 0, energy = 0, flash = 0, wasLit = false
    const cur = { gravity: p.current.gravity, o2: p.current.o2, strength: p.current.strength }
    const parts: { x: number; y: number; vx: number; vy: number; life: number }[] = []
    const draw = () => {
      raf = requestAnimationFrame(draw)
      const dpr = Math.min(2, devicePixelRatio)
      const w = (c.width = Math.max(1, c.clientWidth * dpr)), h = (c.height = Math.max(1, c.clientHeight * dpr))
      const q = p.current
      for (const k of ['gravity', 'o2', 'strength'] as const) cur[k] += (q[k] - cur[k]) * (reduce ? 1 : 0.1)
      if (q.lit && !wasLit) flash = 1
      wasLit = q.lit
      energy += ((q.lit ? 1 : 0) - energy) * (reduce ? 1 : 0.07)
      flash *= 0.9
      t += reduce ? 0 : 0.016
      const G = cur.gravity, S = Math.min(w, h)
      const cx = w / 2, floor = h * 0.8
      g.clearRect(0, 0, w, h)

      // chão do estúdio
      const fl = g.createRadialGradient(cx, floor, 0, cx, floor, S * 0.75)
      fl.addColorStop(0, 'rgba(120,150,200,0.16)'); fl.addColorStop(1, 'rgba(120,150,200,0)')
      g.save(); g.translate(cx, floor); g.scale(1, 0.22); g.translate(-cx, -floor)
      g.fillStyle = fl; g.beginPath(); g.arc(cx, floor, S * 0.75, 0, 7); g.fill(); g.restore()

      // a amostra: o que pode pegar fogo
      const kind = q.mat.kind
      let ax = cx, ay = floor - S * 0.3
      g.fillStyle = q.mat.tint; g.strokeStyle = q.mat.tint; g.lineWidth = Math.max(1, S * 0.004)
      if (kind === 'tecido') {
        const sw = S * 0.11, sh = S * 0.3
        g.globalAlpha = 0.85; g.fillRect(cx - sw / 2, floor - sh, sw, sh); g.globalAlpha = 0.25; g.strokeStyle = '#0b1017'
        for (let y = floor - sh; y < floor; y += S * 0.018) { g.beginPath(); g.moveTo(cx - sw / 2, y); g.lineTo(cx + sw / 2, y); g.stroke() }
        g.globalAlpha = 1; ay = floor - sh
      } else if (kind === 'barra') {
        const sw = S * 0.045, sh = S * 0.3
        g.globalAlpha = 0.75; g.beginPath(); g.roundRect(cx - sw / 2, floor - sh, sw, sh, sw / 2); g.fill(); g.globalAlpha = 1; ay = floor - sh
      } else if (kind === 'gota') {
        ay = floor - S * 0.36
        g.globalAlpha = 0.5; g.beginPath(); g.moveTo(cx - S * 0.22, ay); g.lineTo(cx + S * 0.22, ay); g.stroke()   // a fibra que segura a gota
        g.globalAlpha = 0.9; g.beginPath(); g.arc(cx, ay, S * 0.022, 0, 7); g.fill(); g.globalAlpha = 1
      } else {
        const sw = S * 0.035, sh = S * 0.22
        g.globalAlpha = 0.8; g.fillRect(cx - sw / 2, floor - sh, sw, sh); g.globalAlpha = 1; ay = floor - sh
      }

      const power = Math.max(0.3, Math.min(1.5, (cur.o2 - 0.06) / 0.3)) * cur.strength * energy
      if (power > 0.02) {
        const R = S * 0.12 * (0.65 + 0.45 * power) * (1 - 0.25 * G)
        const cy0 = kind === 'gota' ? ay : ay - R * (0.35 - 0.2 * G)
        g.globalCompositeOperation = 'lighter'
        const n = 18
        for (let i = 0; i < n; i++) {
          const f = i / (n - 1)
          const flick = G * (Math.sin(t * 9 + i * 1.7) * 0.5 + Math.sin(t * 5.3 + i) * 0.5)
          const y = cy0 - f * S * 0.4 * G * (0.6 + 0.5 * power)
          const x = ax + flick * R * 0.25 * f
          const r = R * (1 - 0.72 * f * Math.min(1, G * 1.5)) * (1 + 0.035 * Math.sin(t * 3 + i))
          const warm = Math.min(1, G * 1.4) * (0.3 + 0.7 * f)
          const col = [Math.round(70 + 185 * warm), Math.round(150 + 65 * warm), Math.round(255 - 195 * warm)]
          const a = (0.16 + 0.2 * Math.min(1, power)) * (1 - 0.45 * f)
          const gr = g.createRadialGradient(x, y, 0, x, y, r)
          gr.addColorStop(0, `rgba(${col[0]},${col[1]},${col[2]},${a})`)
          gr.addColorStop(0.55, `rgba(${col[0]},${col[1]},${col[2]},${a * 0.45})`)
          gr.addColorStop(1, 'rgba(0,0,0,0)')
          g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill()
        }
        // casca azul: a zona de reação, nítida em 0 g
        g.strokeStyle = `rgba(160,210,255,${0.55 * (1 - Math.min(1, G * 1.6)) * Math.min(1, power)})`; g.lineWidth = Math.max(1.5, S * 0.006)
        g.beginPath(); g.arc(ax, cy0, R * 0.9, 0, 7); g.stroke()
        // reflexo no chão
        const warmAll = Math.min(1, G * 1.4)
        const rf = g.createRadialGradient(cx, floor, 0, cx, floor, S * 0.5)
        rf.addColorStop(0, `rgba(${Math.round(90 + 165 * warmAll)},${Math.round(160 + 30 * warmAll)},${Math.round(255 - 170 * warmAll)},${0.2 * Math.min(1, power)})`)
        rf.addColorStop(1, 'rgba(0,0,0,0)')
        g.save(); g.translate(cx, floor); g.scale(1, 0.18); g.translate(-cx, -floor); g.fillStyle = rf; g.beginPath(); g.arc(cx, floor, S * 0.5, 0, 7); g.fill(); g.restore()
        // fagulhas: sobem com a gravidade, flutuam sem ela
        if (!reduce && Math.random() < 0.35 * Math.min(1, power)) {
          const ang = Math.random() * Math.PI * 2
          parts.push({ x: ax + Math.cos(ang) * R * 0.5, y: cy0 + Math.sin(ang) * R * 0.5, vx: Math.cos(ang) * S * 0.0008 * (1 - G) + (Math.random() - 0.5) * S * 0.0006, vy: Math.sin(ang) * S * 0.0008 * (1 - G) - G * S * 0.004, life: 1 })
        }
        for (let i = parts.length - 1; i >= 0; i--) {
          const s = parts[i]; s.x += s.vx; s.y += s.vy; s.life -= 0.012
          if (s.life <= 0) { parts.splice(i, 1); continue }
          g.fillStyle = `rgba(${Math.round(150 + 105 * warmAll)},${Math.round(200 - 20 * warmAll)},${Math.round(255 - 170 * warmAll)},${0.5 * s.life})`
          g.beginPath(); g.arc(s.x, s.y, S * 0.004, 0, 7); g.fill()
        }
        if (flash > 0.02) {
          const ff = g.createRadialGradient(ax, cy0, 0, ax, cy0, S * 0.45)
          ff.addColorStop(0, `rgba(255,255,255,${0.7 * flash})`); ff.addColorStop(1, 'rgba(255,255,255,0)')
          g.fillStyle = ff; g.beginPath(); g.arc(ax, cy0, S * 0.45, 0, 7); g.fill()
        }
        g.globalCompositeOperation = 'source-over'
      } else parts.length = 0
    }
    draw()
    return () => cancelAnimationFrame(raf)
  }, [])
  return <canvas ref={ref} className="flame-canvas" role="img" aria-label="Illustration of the flame in this environment" />
}
