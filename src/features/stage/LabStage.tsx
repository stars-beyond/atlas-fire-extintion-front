// A chama simulada: o Laboratório de chama 3D da equipe (lab3d) rodando num iframe, como uma camada por cima
// da cena 3D do habitat. O Atlas manda o cenário e a câmera da cena; o simulador pinta a chama dentro da bancada
// de ensaio do habitat, no mesmo ponto de vista, e devolve se ela está acesa e quanto calor libera.
import { useEffect, useRef, useState } from 'react'
import { API_BASE } from '../../api'
import { materialOf, setLab, useAtlas } from '../../state'
import { labCam, type LabCam } from '../../three/labCam'

export function LabStage({ mat }: { mat: number }) {
  const { scenario, ignited, step, agent, conc, wind, igniteSeq, setLabOff } = useAtlas()
  const ref = useRef<HTMLIFrameElement>(null)
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const h = (e: MessageEvent) => {
      if (e.source !== ref.current?.contentWindow || e.origin !== location.origin) return
      const d = e.data
      if (d?.type === 'atlas:lab') { if (d.status === 'ready') setReady(true); else setLabOff(d.message || 'O simulador 3D não abriu neste navegador.') }
      else if (d?.type === 'atlas:metrics') setLab(d)
    }
    window.addEventListener('message', h)
    return () => { window.removeEventListener('message', h); setLab(null) }
  }, [setLabOff])
  // a câmera da cena chega a cada quadro; a página do simulador tem a mesma origem, então é uma chamada direta
  useEffect(() => {
    if (!ready) return
    const send = (c: LabCam) => { (ref.current?.contentWindow as (Window & { atlasCam?: (c: LabCam) => void }) | null | undefined)?.atlasCam?.(c) }
    labCam.send = send
    if (labCam.last) send(labCam.last)
    return () => { if (labCam.send === send) labCam.send = null }
  }, [ready])
  // palco fora da tela (rolagem, celular): o simulador pausa e libera a thread da página
  useEffect(() => {
    const el = ref.current
    if (!ready || !el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([e]) => {
      el.contentWindow?.postMessage({ type: 'atlas:pause', paused: !e.isIntersecting }, location.origin)
    })
    io.observe(el)
    return () => io.disconnect()
  }, [ready])
  const lit = ignited && step >= 2
  useEffect(() => {
    if (!ready) return
    ref.current?.contentWindow?.postMessage({
      type: 'atlas:set', o2: scenario.o2 * 100, press: scenario.pressure_atm * 14.696, g: scenario.gravity, mat,
      material: materialOf(scenario).material,   // o simulador acha o material pelo id; o índice (mat) fica de reserva
      lit, agent, frac: conc, vent: wind > 0, wind, seq: igniteSeq,
    }, location.origin)
  }, [ready, scenario.o2, scenario.pressure_atm, scenario.gravity, mat, lit, agent, conc, wind, igniteSeq])
  return (
    <>
      <iframe ref={ref} className="lab-frame embed" src={`/lab3d/stage.html?embed=1&api=${encodeURIComponent(API_BASE)}`} title="Chama simulada em 3D" tabIndex={-1} />
      {!ready && <p className="lab-wait low">Preparando o simulador…</p>}
    </>
  )
}
