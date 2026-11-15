// Passo 3: o test drive. Acender, ler o que a NASA sabe, tentar apagar e perguntar.
import { useState } from 'react'
import { Gaps } from '../../components/Gaps'
import { gLabel, pct, psi } from '../../lib/format'
import { materialOf, useAtlas } from '../../state'
import { Perguntar } from '../ask/Perguntar'
import { Apagar } from './tabs/Apagar'
import { Evidencia } from './tabs/Evidencia'

type Tab = 'evidencia' | 'lacunas' | 'apagar' | 'perguntar'

export function TestDriveStep() {
  const { ignited, ignite, scenario, meta, setStageView, described } = useAtlas()
  const [tab, setTab] = useState<Tab>('evidencia')
  const mat = materialOf(scenario)
  const hab = meta?.habitats.find((h) => h.id === scenario.habitat)
  if (!ignited) {
    return (
      <div className="step">
        <header className="step-head">
          <span className="eyebrow">Passo 3 de 4</span>
          <h1>Pronto para o test drive</h1>
          <p>Vamos acender <b>{mat.name.toLowerCase()}</b> {hab ? <>em <b>{hab.name.toLowerCase()}</b></> : 'no seu ambiente'}: {pct(scenario.o2)} de oxigênio, {psi(scenario.pressure_atm)}, {gLabel(scenario.gravity)}.</p>
        </header>
        {described.length > 0 && <div className="badges"><span className="eyebrow">Entendi da sua descrição</span>{described.map((d) => (<span key={d} className="pill">{d}</span>))}</div>}
        <button className="ignite" onClick={() => { setStageView('chama'); ignite() }}>
          <span className="ignite-dot" />Acender
        </button>
        <p className="hint">A chama no palco é uma simulação de estudo. O que vale é o que vem depois: o que a NASA já testou nessa condição.</p>
      </div>
    )
  }
  const tabs: [Tab, string][] = [['evidencia', 'Evidência'], ['lacunas', 'Falta testar'], ['apagar', 'Apagar'], ['perguntar', 'Perguntar']]
  return (
    <div className="step">
      <header className="step-head tight">
        <span className="eyebrow">Passo 3 de 4 · test drive</span>
        <div className="tabs" role="tablist">
          {tabs.map(([id, l]) => (<button key={id} role="tab" aria-selected={tab === id} onClick={() => { setTab(id); if (id === 'apagar') setStageView('chama') }}>{l}</button>))}
        </div>
      </header>
      {tab === 'evidencia' && <Evidencia onGaps={() => setTab('lacunas')} />}
      {tab === 'lacunas' && <div className="block"><h2>O que falta testar</h2><Gaps /></div>}
      {tab === 'apagar' && <Apagar />}
      {tab === 'perguntar' && <Perguntar />}
    </div>
  )
}
