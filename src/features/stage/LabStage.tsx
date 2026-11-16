// A chama simulada: o Laboratório de chama 3D da equipe (lab3d) rodando num iframe, como uma camada por cima
// da cena 3D do habitat. O Atlas manda o cenário e a câmera da cena; o simulador pinta a chama dentro da bancada
// de ensaio do habitat, no mesmo ponto de vista, e devolve se ela está acesa e quanto calor libera.
//
// Mensagens entre o app e o iframe (mesma origem; a origem e a janela de cada mensagem são conferidas dos dois lados):
//   iframe → app   atlas:config-request   ao carregar, repetida até ser atendida: pede a configuração do simulador
//   app → iframe   atlas:config           { config } como a API publica em /sim/config, ou { config: null, error }
//   iframe → app   atlas:lab              status 'ready' (com config: de onde veio a configuração em uso e o que a
//                                         validação recusou) ou 'error' (com message)
//   app → iframe   atlas:set, atlas:pause o cenário e a pausa fora da tela
//   iframe → app   atlas:metrics          o estado da chama, algumas vezes por segundo
// O simulador só é construído depois de receber a configuração; se ela não chegar em 5 s, ou vier inválida, ele
// segue com a embutida e diz isso na mensagem de pronto (ver public/lab3d/bridge.js).
import { useEffect, useRef, useState } from 'react'
import { labConfigOf, loadSimConfig, setLabConfig } from '../../lib/simConfig'
import { materialOf, setLab, useAtlas } from '../../state'
import { labCam, type LabCam } from '../../three/labCam'

export function LabStage({ mat }: { mat: number }) {
  const { scenario, ignited, step, agent, conc, wind, igniteSeq, setLabOff } = useAtlas()
  const ref = useRef<HTMLIFrameElement>(null)
  const [ready, setReady] = useState(false)
  useEffect(() => {
    let live = true, answering = false
    // A configuração da API: pedida já na montagem, para estar à mão quando o iframe a pedir. O iframe pode ficar
    // pronto antes ou depois dela; a resposta sai quando as duas coisas tiverem acontecido. Se a API falhar, o
    // iframe é avisado na hora (config: null) e segue com a configuração embutida, sem esperar o prazo dele.
    loadSimConfig().catch(() => {})
    const answer = () => {
      if (answering) return   // o iframe repete o pedido enquanto não é atendido
      answering = true
      const send = (m: { config: unknown; error?: string }) => {
        answering = false
        if (live) ref.current?.contentWindow?.postMessage({ type: 'atlas:config', ...m }, location.origin)
      }
      loadSimConfig().then((config) => send({ config }), (e) => send({ config: null, error: String(e?.message || e) }))
    }
    const h = (e: MessageEvent) => {
      if (e.source !== ref.current?.contentWindow || e.origin !== location.origin) return
      const d = e.data
      if (d?.type === 'atlas:config-request') answer()
      else if (d?.type === 'atlas:lab') {
        if (d.status === 'ready') {
          const cfg = labConfigOf(d.config)
          setLabConfig(cfg)
          if (cfg && (cfg.from !== 'api' || cfg.problems.length > 0)) console.warn(`Atlas: the 3D simulator is running with the ${cfg.from === 'api' ? 'API' : cfg.from === 'embedded' ? 'built-in' : 'file'} configuration${cfg.reason ? ` (${cfg.reason})` : ''}`, cfg.problems)
          setReady(true)
        } else setLabOff(d.message || 'The 3D simulator did not open in this browser.')
      }
      else if (d?.type === 'atlas:metrics') setLab(d)
    }
    window.addEventListener('message', h)
    return () => { live = false; window.removeEventListener('message', h); setLab(null); setLabConfig(null) }
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
      <iframe ref={ref} className="lab-frame embed" src="/lab3d/stage.html?embed=1" title="Simulated 3D flame" tabIndex={-1} />
      {!ready && <p className="lab-wait low">Loading the simulator…</p>}
    </>
  )
}
