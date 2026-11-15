// O palco: a chama no ambiente escolhido, ou o mapa 3D de todos os testes da NASA.
// A chama é uma ilustração. A forma segue a física conhecida (sem empuxo ela é uma esfera azul;
// com gravidade sobe em gota e amarela). O veredito vem dos testes, nunca do desenho.
// Este arquivo só orquestra: cada vista e cada camada do palco mora no seu próprio arquivo.
import { useEffect, useState } from 'react'
import { nf, pct } from '../../lib/format'
import { LAB_MAT, materialOf, useAtlas } from '../../state'
import type { MapView } from '../../three/map3d'
import { GraphStage } from './GraphStage'
import { HabitatStage } from './HabitatStage'
import { LabHud } from './LabHud'
import { LabStage } from './LabStage'
import { LimitsStage } from './LimitsStage'
import { MapStage } from './MapStage'
import { SimTrustCard, useSimValidation } from './SimTrust'
import { TestCard } from './TestCard'

// Como ler o mapa em cada ponto de vista. O prédio em 3D mostra o vazio da Lua e de Marte; as vistas chapadas
// servem para ler valores sem a perspectiva atrapalhar.
const MAP_VIEWS: [MapView, string, string][] = [
  ['persp', '3D', 'Each dot is a NASA test. Oxygen runs left to right, pressure front to back, and each floor is a gravity level.'],
  ['frente', 'Front', 'Oxygen across, gravity up. The Moon and Mars floors are empty: nobody has tested there.'],
  ['topo', 'Top', 'Oxygen across, pressure up, with all gravity levels stacked.'],
]

export function Stage() {
  const { scenario, ignited, prediction, stageView, setStageView, meta, step, agent, labOff } = useAtlas()
  const mat = materialOf(scenario)
  const hab = meta?.habitats.find((h) => h.id === scenario.habitat)
  const labMat = LAB_MAT[mat.material]
  const useLab3d = labMat !== undefined && !labOff
  // a medição do simulador contra a curva da NASA: só existe para o material que tem curva publicada
  const val = useSimValidation()
  const [trust, setTrust] = useState(false)
  const compared = !!val?.available && LAB_MAT[val.sample.material] === labMat && val.stale.length === 0
  // O palco da chama é a cena 3D do habitat, do começo ao fim. No passo do habitat ela aparece de longe; depois,
  // a câmera desce até a câmara de teste, onde a chama do simulador é pintada. "far" é a pessoa pedindo o plano geral.
  const [far, setFar] = useState(false)
  const [credits, setCredits] = useState<string[]>([])
  const [mapView, setMapView] = useState<MapView>('persp')
  useEffect(() => { setFar(false) }, [step])
  const inScene = stageView === 'chama' && step === 0
  const near = step >= 1 && !far
  // de onde vem a chama da câmara: ilustração no passo do habitat; simulador quando ele conhece o material;
  // senão, ilustração só depois de acender
  const flame = step === 0 ? 'sketch' : useLab3d ? 'sim' : ignited && step >= 2 ? 'sketch' : 'off'
  const strength = agent !== 'nenhum' && prediction && prediction.baseline_k_mm2_s > 0 ? Math.max(0.12, Math.min(1.4, Math.pow(prediction.k_mm2_s / prediction.baseline_k_mm2_s, 3))) : 1
  return (
    <section className={`stage v-${stageView}`} aria-label="Stage">
      {stageView === 'limites' ? <LimitsStage /> : stageView === 'grafo' ? <GraphStage /> : stageView === 'mapa' ? <MapStage view={mapView} />
        : (
          <>
            <HabitatStage near={near} flame={flame} onCredits={setCredits} />
            {step >= 1 && useLab3d && <LabStage mat={labMat} />}
          </>
        )}
      <div className="stage-top">
        {stageView === 'chama' ? (
          <div className="stage-title">
            <span className="eyebrow">{inScene ? 'Where the test runs' : hab ? hab.name : 'Custom environment'}</span>
            <span className="stage-mat">{inScene ? (hab ? hab.name : 'Custom environment') : mat.name}</span>
            {step >= 1 && <button className="scene-back" onClick={() => setFar((f) => !f)}>{far ? 'Enter the habitat' : 'View from outside'}</button>}
            {(inScene || far) && credits.length > 0 && <span className="scene-credit">Models: {credits.join('; ')}.</span>}
          </div>
        ) : stageView === 'mapa' ? (
          <div className="stage-explain">
            <span className="eyebrow">Map · what NASA has already burned</span>
            <p>{MAP_VIEWS.find((v) => v[0] === mapView)![2]}</p>
            <div className="map-mode" role="group" aria-label="Map viewpoint">
              {MAP_VIEWS.map(([id, l]) => <button key={id} aria-pressed={mapView === id} onClick={() => setMapView(id)}>{l}</button>)}
            </div>
          </div>
        ) : stageView === 'grafo' ? (
          <div className="stage-explain">
            <span className="eyebrow">Graph · your scenario's closest relatives</span>
            <p>Your scenario sits in the center, linked to the most similar tests; around the edge is what those tests have in common. Tap a node to follow a link.</p>
          </div>
        ) : (
          <div className="stage-explain">
            <span className="eyebrow">Limits · burns or goes out?</span>
            <p>Right of the curve the flame keeps burning; left of it, it goes out. Drag the yellow dot to try other air conditions.</p>
          </div>
        )}
        <div className="toggle" role="group" aria-label="What to show on the stage">
          <button aria-pressed={stageView === 'chama'} onClick={() => setStageView('chama')}>Flame</button>
          <button aria-pressed={stageView === 'limites'} onClick={() => setStageView('limites')}>Limits</button>
          <button aria-pressed={stageView === 'mapa'} onClick={() => setStageView('mapa')}>Map</button>
          <button aria-pressed={stageView === 'grafo'} onClick={() => setStageView('grafo')}>Graph</button>
        </div>
      </div>
      {stageView === 'chama' && (
        <>
          {useLab3d && !inScene && <LabHud />}
          <div className="stage-foot">
          <div className="gauges compact" aria-label="Environment atmosphere">
            <div><b>{pct(scenario.o2, scenario.o2 * 100 % 1 ? 1 : 0)}</b><span>oxygen</span></div>
            <div><b>{nf(scenario.pressure_atm * 14.696, 1)}</b><span>psi pressure</span></div>
            <div><b>{scenario.gravity <= 0.005 ? '0' : nf(scenario.gravity, 2)} g</b><span>gravity</span></div>
          </div>
          <p className="stage-hint">
            <span className="hint-long">{inScene
              ? 'The point of light marks the test rig inside the habitat. Click another habitat in the scene to go there; drag to rotate. The setting is illustrative.'
              : useLab3d
              ? compared
                ? `The flame comes from the simulator (the setting is illustrative). In zero gravity, its minimum oxygen is within ${nf(val!.rms_o2, 1)} percentage points of the NASA curve; timings are not accurate. The verdict comes from NASA tests.`
                : `The flame comes from the simulator (the setting is illustrative)${mat.material === 'nomex' ? ', with hypothetical parameters for Nomex' : ''}, with no NASA data to compare against for this material. The verdict comes from NASA tests.`
              : labOff ? `${labOff} The drawn flame only follows gravity; the verdict still comes from NASA tests.`
              : 'Illustration: the 3D simulator does not support this material yet. The drawn flame only follows gravity.'}</span>
            <span className="hint-short">
              {inScene ? 'The point of light marks where the test runs.'
                : useLab3d ? (compared ? 'Simulator flame; illustrative setting. The verdict comes from NASA tests.' : 'Simulator flame, not compared with NASA data for this material.')
                : 'Illustration: the drawn flame only follows gravity.'}
            </span>
            {useLab3d && !inScene && val?.available && <>{' '}<button className="link" onClick={() => setTrust((t) => !t)} aria-expanded={trust}>How far to trust it</button></>}
          </p>
          </div>
          {trust && val?.available && <SimTrustCard v={val} onClose={() => setTrust(false)} />}
        </>
      )}
      <TestCard />
    </section>
  )
}
