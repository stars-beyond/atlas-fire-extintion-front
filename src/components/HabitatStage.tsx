// O cenário 3D do ambiente escolhido. É o palco da chama do começo ao fim: no passo do habitat mostra o lugar
// de longe; a partir do material a câmera desce até a câmara de teste, e a chama calculada pelo simulador é
// pintada por cima da cena, dentro da câmara, com a mesma câmera (ver labCam.ts e LabStage em Stage.tsx).
// O lugar é ilustração: os números do ambiente vêm do cenário, e o veredito, dos testes.
import { useEffect, useRef, useState } from 'react'
import type { Scenario } from '../api'
import { useAtlas, useLab } from '../store'
import { createHabitatEngine, type EnvKind, type FlameMode, type HabitatEngine } from '../scene/engine'

const BY_ID: Record<string, EnvKind> = { iss: 'orbita', lua: 'lua', rover: 'rover', marte: 'marte', traje: 'traje', terra: 'terra' }
// ambiente personalizado: o cenário segue a gravidade escolhida
export const envOf = (s: Scenario): EnvKind =>
  BY_ID[s.habitat || ''] ?? (s.gravity <= 0.05 ? 'orbita' : s.gravity < 0.27 ? 'lua' : s.gravity < 0.7 ? 'marte' : 'terra')

export function HabitatStage({ near, flame, onCredits }: { near: boolean; flame: FlameMode; onCredits?: (c: string[]) => void }) {
  const { scenario, wind, meta, setScenario } = useAtlas()
  const lab = useLab()
  const host = useRef<HTMLDivElement>(null), labels = useRef<HTMLDivElement>(null), eng = useRef<HabitatEngine | null>(null)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  // clicar num habitat da cena escolhe o ambiente, como os cartões do painel
  const pick = (k: EnvKind) => { const h = meta?.habitats.find((x) => BY_ID[x.id] === k); if (h) setScenario({ o2: h.o2, pressure_atm: h.pressure_atm, gravity: h.gravity }, h.id) }
  const cb = useRef({ onCredits, pick }); cb.current = { onCredits, pick }
  const kind = envOf(scenario)

  useEffect(() => {
    let e: HabitatEngine
    try { e = createHabitatEngine(host.current!, labels.current!, { ready: () => setReady(true), pick: (k) => cb.current.pick(k) }) } catch { setFailed(true); return }
    eng.current = e
    return () => { e.dispose(); eng.current = null }
  }, [])
  useEffect(() => {
    eng.current?.set({ kind, o2: scenario.o2, gravity: scenario.gravity })
    // os créditos mudam com o ambiente; a troca de cena leva um instante
    const t = setTimeout(() => cb.current.onCredits?.(eng.current?.credits() ?? []), 320)
    return () => clearTimeout(t)
  }, [kind, scenario.o2, scenario.gravity, ready])
  useEffect(() => { if (ready) eng.current?.enter(near) }, [near, ready, kind])
  useEffect(() => { if (ready) eng.current?.setWind(wind) }, [wind, ready])
  // com o simulador, a luz da câmara acompanha a chama calculada
  const burning = !!lab?.burning, hrr = lab?.burning ? Math.round(lab.hrr / 5) * 5 : 0
  useEffect(() => { if (ready) eng.current?.setFlame(flame, { burning, hrr }) }, [flame, burning, hrr, ready])

  return (
    <div className="scene-wrap">
      <div ref={host} className="scene-host" role="img" aria-label="Cenário 3D ilustrativo do ambiente escolhido, com a bancada de ensaio dentro dele" />
      <div ref={labels} className="scene-labels" />
      {!ready && !failed && <p className="lab-wait">Montando o cenário…</p>}
      {failed && <p className="lab-wait">O cenário 3D não abriu neste navegador.</p>}
    </div>
  )
}
