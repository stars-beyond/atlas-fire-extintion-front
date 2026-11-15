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
  ['persp', '3D', 'Cada ponto é um teste da NASA. Para os lados, o oxigênio; para o fundo, a pressão; cada andar é uma gravidade.'],
  ['frente', 'De frente', 'Oxigênio na horizontal, gravidade na vertical. Os andares da Lua e de Marte estão vazios: ninguém testou lá.'],
  ['topo', 'De cima', 'Oxigênio na horizontal, pressão na vertical, com todas as gravidades sobrepostas.'],
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
    <section className={`stage v-${stageView}`} aria-label="Palco">
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
            <span className="eyebrow">{inScene ? 'Onde o ensaio acontece' : hab ? hab.name : 'Ambiente personalizado'}</span>
            <span className="stage-mat">{inScene ? (hab ? hab.name : 'Ambiente personalizado') : mat.name}</span>
            {step >= 1 && <button className="scene-back" onClick={() => setFar((f) => !f)}>{far ? 'Entrar no habitat' : 'Ver o lugar de longe'}</button>}
            {(inScene || far) && credits.length > 0 && <span className="scene-credit">Modelos: {credits.join('; ')}.</span>}
          </div>
        ) : stageView === 'mapa' ? (
          <div className="stage-explain">
            <span className="eyebrow">Mapa · o que a NASA já queimou</span>
            <p>{MAP_VIEWS.find((v) => v[0] === mapView)![2]}</p>
            <div className="map-mode" role="group" aria-label="Ponto de vista do mapa">
              {MAP_VIEWS.map(([id, l]) => <button key={id} aria-pressed={mapView === id} onClick={() => setMapView(id)}>{l}</button>)}
            </div>
          </div>
        ) : stageView === 'grafo' ? (
          <div className="stage-explain">
            <span className="eyebrow">Grafo · os parentes do seu cenário</span>
            <p>Seu cenário fica no centro, ligado aos testes mais parecidos com ele; por fora, o que esses testes têm em comum. Toque numa bola para seguir a ligação.</p>
          </div>
        ) : (
          <div className="stage-explain">
            <span className="eyebrow">Limites · queima ou apaga?</span>
            <p>À direita da curva a chama se sustenta; à esquerda, apaga. Arraste o ponto amarelo para testar outro ar.</p>
          </div>
        )}
        <div className="toggle" role="group" aria-label="O que mostrar no palco">
          <button aria-pressed={stageView === 'chama'} onClick={() => setStageView('chama')}>Chama</button>
          <button aria-pressed={stageView === 'limites'} onClick={() => setStageView('limites')}>Limites</button>
          <button aria-pressed={stageView === 'mapa'} onClick={() => setStageView('mapa')}>Mapa</button>
          <button aria-pressed={stageView === 'grafo'} onClick={() => setStageView('grafo')}>Grafo</button>
        </div>
      </div>
      {stageView === 'chama' && (
        <>
          {useLab3d && !inScene && <LabHud />}
          <div className="stage-foot">
          <div className="gauges compact" aria-label="Atmosfera do ambiente">
            <div><b>{pct(scenario.o2, scenario.o2 * 100 % 1 ? 1 : 0)}</b><span>oxigênio</span></div>
            <div><b>{nf(scenario.pressure_atm * 14.696, 1)}</b><span>psi de pressão</span></div>
            <div><b>{scenario.gravity <= 0.005 ? '0' : nf(scenario.gravity, 2)} g</b><span>gravidade</span></div>
          </div>
          <p className="stage-hint">
            <span className="hint-long">{inScene
              ? 'O ponto de luz marca a bancada de ensaio dentro do habitat. Clique em outro habitat da cena para ir até ele; arraste para girar. O lugar é ilustrativo.'
              : useLab3d
              ? compared
                ? `A chama é do simulador (o lugar é ilustrativo). Sem gravidade, o oxigênio mínimo dela fica a ${nf(val!.rms_o2, 1)} ponto da curva da NASA; os tempos não são fiéis. O veredito vem dos testes da NASA.`
                : `A chama é do simulador (o lugar é ilustrativo)${mat.material === 'nomex' ? ', com parâmetros hipotéticos para o Nomex' : ''}, sem comparação com dados da NASA para este material. O veredito vem dos testes da NASA.`
              : labOff ? `${labOff} A chama desenhada só segue a gravidade; o veredito continua vindo dos testes da NASA.`
              : 'Ilustração: o simulador 3D ainda não tem este material. A chama desenhada só segue a gravidade.'}</span>
            <span className="hint-short">
              {inScene ? 'O ponto de luz marca onde o ensaio acontece.'
                : useLab3d ? (compared ? 'Chama do simulador; lugar ilustrativo. O veredito vem dos testes da NASA.' : 'Chama do simulador, sem comparação com a NASA neste material.')
                : 'Ilustração: a chama desenhada só segue a gravidade.'}
            </span>
            {useLab3d && !inScene && val?.available && <>{' '}<button className="link" onClick={() => setTrust((t) => !t)} aria-expanded={trust}>Quanto confiar</button></>}
          </p>
          </div>
          {trust && val?.available && <SimTrustCard v={val} onClose={() => setTrust(false)} />}
        </>
      )}
      <TestCard />
    </section>
  )
}
