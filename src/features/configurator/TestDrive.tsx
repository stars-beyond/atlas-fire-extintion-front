// Passo 3: o test drive. Acender, ler o que a NASA sabe, tentar apagar e perguntar.
import { Gaps } from '../../components/Gaps'
import { gLabel, pct, psi } from '../../lib/format'
import { materialOf, useAtlas, type DriveTab } from '../../state'
import { Perguntar } from '../ask/Perguntar'
import { Apagar } from './tabs/Apagar'
import { Evidencia } from './tabs/Evidencia'

export function TestDriveStep() {
  const { ignited, ignite, scenario, meta, setStageView, described, driveTab: tab, setDriveTab: setTab } = useAtlas()
  const mat = materialOf(scenario)
  const hab = meta?.habitats.find((h) => h.id === scenario.habitat)
  if (!ignited) {
    return (
      <div className="step">
        <header className="step-head">
          <span className="eyebrow">Step 3 of 4</span>
          <h1>Ready for the test drive</h1>
          <p>We will ignite <b>{mat.noun}</b> {hab ? <>in <b>{hab.name}</b></> : 'in your environment'}: {pct(scenario.o2)} oxygen, {psi(scenario.pressure_atm)}, {gLabel(scenario.gravity)}.</p>
        </header>
        {described.length > 0 && <div className="badges"><span className="eyebrow">What I understood from your description</span>{described.map((d) => (<span key={d} className="pill">{d}</span>))}</div>}
        <button className="ignite" onClick={() => { setStageView('chama'); ignite() }}>
          <span className="ignite-dot" />Ignite
        </button>
        <p className="hint">The flame on the stage is a study simulation. What counts is what comes next: what NASA has already tested at this condition.</p>
      </div>
    )
  }
  const tabs: [DriveTab, string][] = [['evidencia', 'Evidence'], ['lacunas', 'Gaps'], ['apagar', 'Put it out'], ['perguntar', 'Ask']]
  return (
    <div className="step">
      <header className="step-head tight">
        <span className="eyebrow">Step 3 of 4 · test drive</span>
        <div className="tabs" role="tablist">
          {tabs.map(([id, l]) => (<button key={id} role="tab" aria-selected={tab === id} onClick={() => { setTab(id); if (id === 'apagar') setStageView('chama') }}>{l}</button>))}
        </div>
      </header>
      {tab === 'evidencia' && <Evidencia onGaps={() => setTab('lacunas')} />}
      {tab === 'lacunas' && <div className="block"><h2>What is still untested</h2><Gaps /></div>}
      {tab === 'apagar' && <Apagar />}
      {tab === 'perguntar' && <Perguntar />}
    </div>
  )
}
