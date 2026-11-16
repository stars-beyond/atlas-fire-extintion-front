// Vista "Thermal" do palco: a câmera térmica. As redes da equipe (Atlas-MachineL) rodam no backend para o ar
// do cenário e devolvem o filme da temperatura da superfície de um filme fino de acrílico em 0 g; aqui ele só
// é desenhado. "Compare" mostra o ensaio de exemplo do modelo ao lado da gravação medida no ZARM.
// O filme diz como a chama anda, não se ela apaga: longe dos ensaios a API não devolve filme nenhum.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { api } from '../../api'
import { nf } from '../../lib/format'
import { useAtlas } from '../../state'
import type { Thermal } from '../../types'

type Layer = 'temp' | 'std'
export interface Film { d: Thermal; frames: Uint8Array; std: Uint8Array; metal: Uint8Array; measured: Uint8Array | null; n: number }

// zlib em base64 → bytes (o navegador descomprime)
async function inflate(b64: string): Promise<Uint8Array> {
  const bin = atob(b64), raw = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) raw[i] = bin.charCodeAt(i)
  const stream = new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}
export async function decode(d: Thermal): Promise<Film> {
  const [hist, fut, std, metal, meas] = await Promise.all([inflate(d.history_b64), inflate(d.frames_b64), inflate(d.std_b64), inflate(d.metal_b64), d.measured_b64 ? inflate(d.measured_b64) : null])
  const px = d.w * d.h
  const frames = new Uint8Array(hist.length + fut.length); frames.set(hist); frames.set(fut, hist.length)
  let measured: Uint8Array | null = null
  if (meas) { measured = new Uint8Array(hist.length + meas.length); measured.set(hist); measured.set(meas, hist.length) }
  return { d, frames, std, metal, measured, n: frames.length / px }
}

// paletas: temperatura (preto, vermelho, laranja, branco) e discordância (azul-escuro a verde-limão)
function lut(stops: [number, number, number, number][]): Uint8ClampedArray {
  const out = new Uint8ClampedArray(256 * 3)
  for (let i = 0; i < 256; i++) {
    const t = i / 255
    let k = 0
    while (k < stops.length - 2 && t > stops[k + 1][0]) k++
    const a = stops[k], b = stops[k + 1], f = Math.min(1, Math.max(0, (t - a[0]) / (b[0] - a[0])))
    for (let c = 0; c < 3; c++) out[i * 3 + c] = a[c + 1] + (b[c + 1] - a[c + 1]) * f
  }
  return out
}
export const TEMP = lut([[0, 6, 8, 20], [0.12, 46, 16, 92], [0.3, 140, 28, 100], [0.5, 221, 68, 50], [0.7, 250, 150, 20], [0.86, 252, 222, 90], [1, 255, 255, 235]])
const STD = lut([[0, 8, 12, 24], [0.25, 40, 60, 130], [0.55, 40, 150, 140], [0.8, 150, 215, 70], [1, 250, 240, 90]])
const grad = (l: Uint8ClampedArray) => `linear-gradient(90deg, ${[0, 32, 64, 96, 128, 160, 192, 224, 255].map((i) => `rgb(${l[i * 3]},${l[i * 3 + 1]},${l[i * 3 + 2]})`).join(',')})`

export function paint(cv: HTMLCanvasElement | null, src: Uint8Array, w: number, h: number, i: number, pal: Uint8ClampedArray, metal: Uint8Array | null, gain = 1) {
  if (!cv) return
  if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h }
  const g = cv.getContext('2d')!, img = g.createImageData(w, h), off = i * w * h
  for (let p = 0; p < w * h; p++) {
    const v = Math.min(255, src[off + p] * gain) | 0
    let r = pal[v * 3], gr = pal[v * 3 + 1], b = pal[v * 3 + 2]
    if (metal && metal[p] > 127) { r = r * 0.55 + 70; gr = gr * 0.55 + 78; b = b * 0.55 + 90 }   // barreira de metal: cinza por cima
    img.data[p * 4] = r; img.data[p * 4 + 1] = gr; img.data[p * 4 + 2] = b; img.data[p * 4 + 3] = 255
  }
  g.putImageData(img, 0, 0)
}

export function ThermalStage() {
  const { scenario, wind, meta } = useAtlas()
  const [film, setFilm] = useState<Film | null>(null)
  const [none, setNone] = useState<Thermal | null>(null)      // a API respondeu sem filme (fora da faixa do modelo)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [compare, setCompare] = useState(false)
  const [layer, setLayer] = useState<Layer>('temp')
  const [playing, setPlaying] = useState(true)
  const [i, setI] = useState(0)
  const applies = scenario.family === 'solido' && scenario.material === 'pmma'
  const main = useRef<HTMLCanvasElement>(null), side = useRef<HTMLCanvasElement>(null), host = useRef<HTMLDivElement>(null)
  // palco baixo (painel pequeno ou celular): o filme vai para a esquerda e os controles para a direita
  const [compact, setCompact] = useState(false)
  useLayoutEffect(() => {
    const el = host.current
    if (!el) return
    const measure = () => setCompact(el.clientHeight < 400)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [applies])

  useEffect(() => {
    if (!applies) { setFilm(null); setNone(null); return }
    let live = true
    setBusy(true); setError(null)
    const t = setTimeout(() => {
      api.thermal(scenario, wind, compare)
        .then(async (d) => {
          if (!live) return
          if (!d.available) { setNone(d); setFilm(null); return }
          const f = await decode(d)
          if (live) { setFilm(f); setNone(null); setI(0); setPlaying(true) }
        })
        // the film on screen belongs to the previous air: a failed request removes it instead of leaving it as if it were current
        .catch((e) => { if (live) { setFilm(null); setNone(null); setError(typeof DecompressionStream === 'undefined' ? 'This browser cannot unpack the film.' : String(e.message || e)) } })
        .finally(() => { if (live) setBusy(false) })
    }, 450)
    return () => { live = false; clearTimeout(t) }
  }, [applies, scenario.o2, scenario.pressure_atm, scenario.gravity, wind, compare])

  // o filme toca no tempo real da gravação (8,33 quadros/s) e para um instante no fim antes de recomeçar
  useEffect(() => {
    if (!film || !playing) return
    const id = setInterval(() => setI((k) => (k + 1) % (film.n + 8)), 1000 / film.d.fps)
    return () => clearInterval(id)
  }, [film, playing])

  const k = film ? Math.min(i, film.n - 1) : 0
  useEffect(() => {
    if (!film) return
    const { d } = film
    const metal = compare ? film.metal : null
    if (layer === 'std' && k >= d.history) paint(main.current, film.std, d.std_w, d.std_h, k - d.history, STD, null, 2.5)
    else paint(main.current, film.frames, d.w, d.h, k, TEMP, metal)
    if (compare && film.measured) paint(side.current, film.measured, d.w, d.h, Math.min(k, film.measured.length / (d.w * d.h) - 1), TEMP, metal)
  }, [film, k, layer, compare])

  const hab = meta?.habitats.find((x) => x.id === scenario.habitat)?.name ?? 'Your scenario'
  const info = useMemo(() => {
    if (!film) return null
    const { d } = film
    const air = `${nf(d.o2_pct, 1)}% O₂ · ${nf(d.pressure_kpa / 6.894757, 1)} psi · ${nf(d.flow_cm_s, 0)} cm/s against the flame · 0 g`
    return { air, size: `${nf(d.w * d.mm_px, 0)} × ${nf(d.h * d.mm_px, 0)} mm` }
  }, [film])

  if (!applies) return <div ref={host} className="thermal"><p className="lab-wait">The thermal camera only knows thin acrylic film. Choose Acrylic (PMMA) as the material.</p></div>
  const d = film?.d
  const front = d && k < d.front_px.length ? d.front_px[k] : null
  const future = d ? k >= d.history : false
  const err = d?.mae_c && future ? d.mae_c[k - d.history] : null
  return (
    <div ref={host} className={`thermal${compare ? ' two' : ''}${compact ? ' compact' : ''}`}>
      <div className="thermal-body">
        {film && d ? (
          <div className="thermal-films">
            {compare && film.measured && (
              <figure>
                <div className="thermal-cv" style={{ aspectRatio: `${d.w} / ${d.h}` }}><canvas ref={side} /></div>
                <figcaption><b>Measured</b> infrared camera, ZARM run {d.sample?.trial.split(':')[1]}{d.measured_v_mm_s != null ? ` · ${nf(d.measured_v_mm_s, 1)} mm/s` : ''}</figcaption>
              </figure>
            )}
            <figure>
              <div className="thermal-cv" style={{ aspectRatio: `${d.w} / ${d.h}` }}>
                <canvas ref={main} />
                {layer === 'temp' && front != null && front > d.fuel_end_px + 1 && <i className="thermal-front" style={{ left: `${(front / d.w) * 100}%` }} />}
                {!future && <span className="thermal-badge">{compare ? 'recorded start' : 'starting frames'}</span>}
              </div>
              <figcaption>
                <b>{layer === 'std' ? 'Where the networks disagree' : compare ? 'Model' : 'Predicted'}</b> {d.nets} networks{d.v_mm_s != null ? ` · ${nf(d.v_mm_s, 1)} mm/s` : ''}
                {err != null ? ` · off by ${nf(err, 0)} °C per pixel now` : ''}
              </figcaption>
            </figure>
          </div>
        ) : none ? (
          <p className="thermal-none"><span className="tag warn">No film</span> {none.reason}</p>
        ) : error ? (
          <p className="thermal-none"><span className="tag warn">Not available</span> {error}</p>
        ) : <p className="lab-wait">Running the networks for this air…</p>}
      </div>
      <div className="thermal-ctl">
        {film && d && (
          <>
            <div className="thermal-row">
              <button className="thermal-play" onClick={() => setPlaying((p) => !p)} aria-label={playing ? 'Pause' : 'Play'}>{playing ? '❚❚' : '▶'}</button>
              <input type="range" min={0} max={film.n - 1} step={1} value={k} aria-label="Time" onChange={(e) => { setPlaying(false); setI(+e.target.value) }} style={{ ['--fill' as string]: `${(k / Math.max(1, film.n - 1)) * 100}%` }} />
              <b className="thermal-time">{nf(k / d.fps, 1)} s</b>
            </div>
            <div className="thermal-row wrap">
              <div className="map-mode" role="group" aria-label="What the film shows">
                <button aria-pressed={layer === 'temp'} onClick={() => setLayer('temp')}>Temperature</button>
                <button aria-pressed={layer === 'std'} onClick={() => setLayer('std')}>Disagreement</button>
              </div>
              <span className="thermal-scale"><i style={{ background: grad(layer === 'std' ? STD : TEMP) }} />{layer === 'std' ? `0 to ${nf(d.std_max_c / 2.5, 0)} °C between networks` : `20 to ${nf(d.t_max_c, 0)} °C`}</span>
              <button className="link" onClick={() => setCompare((c) => !c)} aria-pressed={compare}>{compare ? `Back to ${hab}` : 'Compare with a real recording'}</button>
            </div>
            <p className="thermal-note">
              <span className={`tag${d.level === 'extrapolado' ? ' warn' : ' ok'}`}>{compare ? 'Real test' : d.level === 'extrapolado' ? 'Outside the tested range' : 'Within the tested range'}</span>{' '}
              {compare ? `ZARM drop tower, ${info!.air}, with metal barriers (grey).` : `What an infrared camera would see: a thin acrylic film (${info!.size}) burning in the air of ${hab}, ${info!.air}. The flame moves from right to left.`}
              {!compare && d.gravity_ignored ? ' The model has no gravity: this is the air of this place in weightlessness.' : ''}
              {!compare && d.level === 'extrapolado' ? ` ${d.out_of_range.join(' ')}` : ''}
              {compare ? ` ${d.caveats?.[0] ?? ''}` : ' It shows how the flame moves, not whether it goes out.'}
            </p>
          </>
        )}
        {!film && (none || error) && <button className="link" onClick={() => setCompare((c) => !c)}>{compare ? `Back to ${hab}` : 'Compare with a real recording'}</button>}
        {busy && film && <span className="thermal-busy">Running the networks for this air…</span>}
      </div>
    </div>
  )
}
