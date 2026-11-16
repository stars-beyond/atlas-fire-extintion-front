// O motor da cena dos habitats.
//
// A cena é feita de MUNDOS, e cada mundo tem um ou mais HABITATS:
//   lua     terreno do local de pouso da Apollo 14, com a base e o rover pressurizado estacionado ao lado
//   orbita  a estação e, do lado de fora, o astronauta de traje
//   marte   o mesmo terreno recolorido (ou o de Marte, se houver modelo), com a base
//   terra   uma sala fechada
// Trocar de habitat dentro do mesmo mundo é um voo de câmera; trocar de mundo é um corte rápido.
// Dá para escolher o habitat clicando nele ou na etiqueta dele.
//
// O ensaio acontece DENTRO do habitat: uma bancada de ensaio apoiada numa superfície de lá (parts.ts, rig).
// De longe, um farol marca onde ela está; de perto, a câmera entra no habitat, a exposição cai como a de uma
// câmera apontada para o fogo, e a chama calculada pelo simulador é pintada dentro da bancada com esta mesma
// câmera (labCam.ts). Sem simulador para o material, a cena desenha uma chama ilustrativa que segue a gravidade.
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { CSS2DObject, CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js'
import { fit, loadAssets, type Assets } from './assets'
import { disposeObject } from './dispose'
import { labCam } from './labCam'
import { LOCALE } from '../lib/format'
import { C, RIG, domeBase, earth, flatSpot, glowTexture, ground, label, marsSky, mesh, panelsField, rig, roomBody, roverBody, sharedTextures, stars, stationBody, std, type Body } from './parts'

export type EnvKind = 'orbita' | 'lua' | 'rover' | 'marte' | 'traje' | 'terra'
export interface SceneState { kind: EnvKind; o2: number; gravity: number }
// de onde vem a chama: desenhada pela cena (ilustração), calculada pelo simulador (pintada por cima) ou nenhuma
export type FlameMode = 'sketch' | 'sim' | 'off'
export interface HabitatEngine {
  set(s: SceneState): void
  enter(on: boolean): void          // entra no habitat, até a bancada de ensaio (ou volta ao plano geral)
  setFlame(mode: FlameMode, sim?: { burning: boolean; hrr: number }): void
  setWind(cm_s: number): void
  credits(): string[]
  dispose(): void
}
export interface SceneCallbacks { ready?(): void; pick?(kind: EnvKind): void }

type WorldId = 'lua' | 'marte' | 'orbita' | 'terra'
const WORLD_OF: Record<EnvKind, WorldId> = { lua: 'lua', rover: 'lua', marte: 'marte', orbita: 'orbita', traje: 'orbita', terra: 'terra' }
const NAME: Record<EnvKind, string> = { orbita: 'Space station', lua: 'Lunar base', rover: 'Pressurized rover', marte: 'Mars base', traje: 'Spacesuit', terra: 'Room on Earth' }
const LAB_W = 12   // comprimento do duto do simulador, em cm

interface Spot {
  kind: EnvKind; body: THREE.Object3D
  cell: THREE.Vector3; scale: number            // centro e escala da bancada de ensaio
  home: THREE.Vector3; target: THREE.Vector3    // câmera do plano geral
  tag: CSS2DObject
}
interface World { id: WorldId; group: THREE.Group; spots: Map<EnvKind, Spot>; ground: boolean; sky: 'space' | 'mars' | 'room'; sun: number; ambient: number; credits: string[] }

export function createHabitatEngine(host: HTMLDivElement, labelHost: HTMLDivElement, cb: SceneCallbacks = {}): HabitatEngine {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 2500)
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio))
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05
  host.appendChild(renderer.domElement)
  const labels = new CSS2DRenderer({ element: labelHost })
  const controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true; controls.dampingFactor = 0.08; controls.enablePan = false
  controls.maxDistance = 150; controls.autoRotateSpeed = 0.4; controls.autoRotate = !reduce
  controls.addEventListener('start', () => { controls.autoRotate = false })

  // luz: um sol baixo e duro (sombras compridas) e um pouco de luz de preenchimento
  const sun = new THREE.DirectionalLight(0xfff4e6, 3)
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.6
  const sc = sun.shadow.camera; sc.left = sc.bottom = -70; sc.right = sc.top = 70; sc.near = 1; sc.far = 400
  const hemi = new THREE.HemisphereLight(0x9ab8ff, 0x20242c, 0.1)
  scene.add(sun, sun.target, hemi)
  const SUN_DIR = new THREE.Vector3(-0.62, 0.34, 0.5).normalize()
  const starField = stars(), sky = marsSky(); sky.visible = false; scene.add(starField, sky)

  // ---- bancada de ensaio (uma só, levada de habitat em habitat)
  const cell = new THREE.Group(); scene.add(cell)
  const bench = rig(); cell.add(bench.group)
  const glow = glowTexture()
  const flames: THREE.Sprite[] = []
  for (let i = 0; i < 8; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); flames.push(s); cell.add(s) }
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.35 })); halo.scale.setScalar(2.6); cell.add(halo)
  // fundo escuro atrás da chama do simulador, sempre de frente para a câmera: dá contraste de qualquer ângulo
  const shade = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0x000000, transparent: true, opacity: 0, depthWrite: false })); shade.scale.setScalar(3.4); shade.renderOrder = 2; cell.add(shade)
  const flameLight = new THREE.PointLight(0x7fb8ff, 0, 9, 1.8); cell.add(flameLight)
  const arrow = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(-RIG.W / 2 - 1.15, 0, 0), 0.8, 0xe9eff8, 0.24, 0.14); cell.add(arrow)
  const windLabel = label('air: 10 cm/s', ''); windLabel.position.set(-RIG.W / 2 - 0.75, 0.32, 0); cell.add(windLabel)
  const rigLabel = label('test rig', 'habl on'); rigLabel.position.set(0, RIG.H / 2, 0); rigLabel.center.set(0.5, 1.4); cell.add(rigLabel)
  // farol: marca de longe onde a chama fica, mesmo através da casca do habitat
  const beacon = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, transparent: true, sizeAttenuation: false }))
  beacon.renderOrder = 5; scene.add(beacon)

  let mode: FlameMode = 'sketch', simState = { burning: false, hrr: 0 }
  let state: SceneState = { kind: 'orbita', o2: 0.21, gravity: 0 }
  let assets: Assets | null = null
  const worlds = new Map<WorldId, World>()
  let world: World | null = null, spot: Spot | null = null
  let goal: { pos: THREE.Vector3; tgt: THREE.Vector3 } | null = null
  let inside = false, disposed = false, raf = 0, frames = 0, exposure = 1.05

  // ---- montagem dos mundos (na primeira vez em que são pedidos)
  function tag(kind: EnvKind) {
    const t = label(NAME[kind], 'habl pick'); t.center.set(0.5, 1)
    t.element.addEventListener('click', () => cb.pick?.(kind))
    return t
  }
  function addSpot(w: World, kind: EnvKind, body: Body, at: THREE.Vector3, scale: number, home: [number, number, number], target: [number, number, number], tagY: number) {
    body.group.position.copy(at); w.group.add(body.group)
    const cellAt = at.clone().add(body.bench); cellAt.y += (RIG.H / 2 + 0.06) * scale
    const t = tag(kind); t.position.set(0, tagY, 0); body.group.add(t)
    w.spots.set(kind, { kind, body: body.group, cell: cellAt, scale, home: at.clone().add(new THREE.Vector3(...home)), target: at.clone().add(new THREE.Vector3(...target)), tag: t })
  }
  const custom = (slot: 'habitat' | 'rover' | 'station', size: number, benchY: number): Body | null => {
    const m = assets!.model[slot]; if (!m) return null
    return { group: fit(m.clone(true), size), bench: new THREE.Vector3(0, benchY, 0) }
  }
  function astronaut(height: number): THREE.Group {
    const m = assets!.model.suit
    if (m) return fit(m.clone(true), height, 'height')
    const g = new THREE.Group(); g.add(mesh(new THREE.CapsuleGeometry(height * 0.16, height * 0.55, 8, 16), std(0xe07a2e), 0, height / 2, 0)); return g
  }

  function build(id: WorldId): World {
    const group = new THREE.Group(); group.visible = false; scene.add(group)
    const cr = assets!.credit, credits: string[] = []
    const w: World = { id, group, spots: new Map(), ground: true, sky: 'space', sun: 3, ambient: 0.08, credits }
    if (id === 'lua' || id === 'marte') {
      const mars = id === 'marte', soil = mars ? C.mars : C.regolith
      const terrain = ground((mars && assets!.model.terrain_mars) || assets!.model.terrain_moon, soil); group.add(terrain.group)
      const h = terrain.height
      if (mars && assets!.model.terrain_mars) credits.push(cr.terrain_mars!)
      else if (cr.terrain_moon) credits.push(cr.terrain_moon + (mars ? ', recolored to stand in for Mars' : ''))
      const b = flatSpot(h, 0, 0, 54, 12), by = h(b.x, b.z), at = new THREE.Vector3(b.x, by, b.z)
      const base = custom('habitat', 22, 12) ?? domeBase(9, soil)
      if (assets!.model.habitat) credits.push(cr.habitat!)
      addSpot(w, mars ? 'marte' : 'lua', base, at, 0.3, [22, 9.5, 27], [0, 3, 0], 11.5)
      const field = panelsField(); field.position.set(b.x - 14, h(b.x - 14, b.z - 20) + 0.2, b.z - 20); field.rotation.y = 0.5; group.add(field)
      const man = astronaut(2.2); man.position.set(b.x + 12, h(b.x + 12, b.z + 7), b.z + 7); man.rotation.y = 0.75; group.add(man)
      if (assets!.model.suit) credits.push(cr.suit!)
      if (!mars) {
        // o rover fica estacionado ao lado da base: é outro habitat do mesmo lugar
        const r = flatSpot(h, b.x + 24, b.z - 5, 6, 4), rAt = new THREE.Vector3(r.x, h(r.x, r.z), r.z)
        const rover = custom('rover', 7, 4.6) ?? roverBody()
        if (assets!.model.rover) credits.push(cr.rover!)
        rover.group.rotation.y = -0.5
        rover.bench.applyAxisAngle(new THREE.Vector3(0, 1, 0), -0.5)
        addSpot(w, 'rover', rover, rAt, 0.22, [9, 5, 12], [0, 2.2, 0], 6.2)
        const e = earth(30); e.position.set(b.x - 250, by + 62, b.z - 330); e.rotation.set(0.6, 1.2, 0.3); group.add(e)
      } else { w.sky = 'mars'; w.sun = 1.9; w.ambient = 0.55 }
    } else if (id === 'orbita') {
      w.ground = false; w.ambient = 0.22
      const e = earth(640); e.position.set(0, -690, -80); e.rotation.set(1.15, 0, 0.4); group.add(e)
      const st = custom('station', 26, 9) ?? stationBody()
      if (assets!.model.station) credits.push(cr.station!)
      addSpot(w, 'orbita', st, new THREE.Vector3(), 0.3, [-8, 6, 19], [0.8, 0, 0], 4.2)
      // o astronauta fora da estação: o traje é um habitat de uma pessoa só
      const man = astronaut(2.1); man.rotation.y = 0.5
      const at = new THREE.Vector3(-9, 1.2, 8)
      addSpot(w, 'traje', { group: man, bench: new THREE.Vector3(0, 1.32, 0.42).applyAxisAngle(new THREE.Vector3(0, 1, 0), 0.5) }, at, 0.1, [1.6, 1.9, 5.2], [0, 1.1, 0], 2.6)
      if (assets!.model.suit) credits.push(cr.suit!)
      const tether = new THREE.Line(new THREE.BufferGeometry().setFromPoints(new THREE.CatmullRomCurve3([at.clone().add(new THREE.Vector3(0, 1, -0.2)), new THREE.Vector3(-7.5, 2.6, 4), new THREE.Vector3(-5.6, 1.2, 0.6)]).getPoints(24)), new THREE.LineBasicMaterial({ color: C.accent }))
      group.add(tether)
    } else {
      w.sky = 'room'; w.sun = 0; w.ambient = 0.5
      addSpot(w, 'terra', roomBody(), new THREE.Vector3(), 0.3, [8, 5.2, 13.5], [0, 2, 0], 5)
    }
    return w
  }

  // ---- câmera
  function aim(jump: boolean) {
    if (!spot) return
    let pos: THREE.Vector3, tgt: THREE.Vector3
    if (inside) {   // dentro do habitat, colado na bancada, vindo da direção do plano geral
      const dir = spot.home.clone().sub(spot.cell); dir.y = Math.max(dir.y, 0) * 0.5; dir.normalize()
      pos = spot.cell.clone().addScaledVector(dir, 4.6 * spot.scale + 0.25); tgt = spot.cell.clone()
    } else {
      // palco estreito: recua para o conjunto inteiro caber; palco largo e baixo: chega mais perto
      const k = Math.min(2, Math.max(0.62, 1.25 / camera.aspect))
      tgt = spot.target.clone(); pos = tgt.clone().add(spot.home.clone().sub(tgt).multiplyScalar(k))
    }
    controls.minDistance = inside ? 1.5 * spot.scale + 0.15 : 3
    if (jump || reduce) { camera.position.copy(pos); controls.target.copy(tgt); goal = null } else goal = { pos, tgt }
  }
  function place() {
    if (!world || !spot) return
    cell.position.copy(spot.cell); cell.scale.setScalar(spot.scale)
    if (spot.kind === 'rover') cell.rotation.y = -0.5; else cell.rotation.y = 0
    beacon.position.copy(spot.cell)
    for (const s of world.spots.values()) s.tag.element.classList.toggle('on', s === spot)
    sun.target.position.copy(spot.target); sun.position.copy(spot.target).addScaledVector(SUN_DIR, 160)
  }
  function show(kind: EnvKind, jump: boolean) {
    const id = WORLD_OF[kind]
    let w = worlds.get(id); if (!w) { w = build(id); worlds.set(id, w) }
    for (const x of worlds.values()) x.group.visible = x === w
    world = w; spot = w.spots.get(kind) ?? [...w.spots.values()][0]
    starField.visible = w.sky === 'space'; sky.visible = w.sky === 'mars'
    scene.background = new THREE.Color(w.sky === 'room' ? 0x141a22 : w.sky === 'mars' ? 0xc79f78 : 0x02040a)
    scene.fog = w.sky === 'mars' ? new THREE.Fog(0xc79f78, 70, 330) : null
    sun.intensity = w.sun; hemi.intensity = w.ambient; sun.color.set(w.sky === 'mars' ? 0xffe3c2 : 0xffffff)
    hemi.color.set(w.sky === 'mars' ? 0xe9c9a4 : 0x9ab8ff); hemi.groundColor.set(w.sky === 'mars' ? 0x5c3a28 : 0x20242c)
    controls.maxPolarAngle = w.ground || w.sky === 'room' ? Math.PI * 0.495 : Math.PI
    place(); aim(jump)
  }

  // ---- chama desenhada e luz
  const tmp = new THREE.Color(), blue = new THREE.Color(0x5fb0ff), orange = new THREE.Color(0xff9a3d)
  function drawFlame(t: number) {
    const g = Math.min(1, Math.max(0, state.gravity)), lift = Math.pow(g, 0.55), warm = Math.min(1, g * 1.5)
    const sketch = mode === 'sketch'
    for (const s of flames) s.visible = sketch
    halo.visible = sketch; bench.sample.visible = mode !== 'sim'
    shade.material.opacity += (shadeGoal() - shade.material.opacity) * 0.1
    flameLight.color.copy(blue).lerp(orange, warm)
    // etiquetas e farol: de longe os nomes dos habitats e o farol; de perto, a bancada
    const far = !inside
    beacon.visible = far && mode !== 'off'
    if (beacon.visible) { beacon.material.color.copy(blue).lerp(orange, warm); beacon.scale.setScalar(0.05 * (reduce ? 1 : 1 + 0.18 * Math.sin(t * 3))) }
    rigLabel.visible = !far; windLabel.visible = !far; arrow.visible = !far && windOn
    if (world) for (const s of world.spots.values()) s.tag.visible = far
    if (!sketch) {
      // com o simulador, a luz da bancada acompanha o calor que a chama calculada libera
      flameLight.intensity = mode === 'sim' && simState.burning ? 5 * Math.min(1.6, Math.sqrt(Math.max(simState.hrr, 0) / 60)) : 0
      return
    }
    const power = Math.max(0.55, Math.min(1.5, (state.o2 - 0.06) / 0.3))
    const R = 0.34 * (0.7 + 0.4 * power) * (1 - 0.22 * lift)
    flames.forEach((s, i) => {
      const f = i / (flames.length - 1)
      const flick = reduce ? 0 : lift * (Math.sin(t * 9 + i * 1.7) * 0.5 + Math.sin(t * 5.3 + i) * 0.5)
      s.position.set(flick * 0.05 * f, f * 0.52 * lift * (0.7 + 0.4 * power), 0)
      s.scale.setScalar(R * (1 - 0.72 * f * Math.min(1, g * 1.6)) * (1 + (reduce ? 0 : 0.04 * Math.sin(t * 3 + i))) * 2.2)
      tmp.copy(blue).lerp(orange, warm * (0.3 + 0.7 * f))
      s.material.color.copy(tmp); s.material.opacity = (0.34 + 0.2 * Math.min(1, power)) * (1 - 0.5 * f)
    })
    halo.material.color.copy(blue).lerp(orange, warm); halo.position.y = 0.2 * lift
    flameLight.intensity = 3 * power * (reduce ? 1 : 1 + 0.08 * Math.sin(t * 7))
  }
  let windOn = true
  const shadeGoal = () => (mode === 'sim' && inside ? 0.62 : 0)

  // ---- escolher um habitat clicando nele
  const ray = new THREE.Raycaster(), mouse = new THREE.Vector2(); let down: [number, number] | null = null
  const hit = (ev: PointerEvent): Spot | null => {
    if (!world || inside || world.spots.size < 2) return null
    const r = renderer.domElement.getBoundingClientRect()
    mouse.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1)
    ray.setFromCamera(mouse, camera)
    let best: { s: Spot; d: number } | null = null
    for (const s of world.spots.values()) { const h = ray.intersectObject(s.body, true)[0]; if (h && (!best || h.distance < best.d)) best = { s, d: h.distance } }
    return best && best.s !== spot ? best.s : null
  }
  const el = renderer.domElement
  const onMove = (ev: PointerEvent) => { if (!down) el.style.cursor = hit(ev) ? 'pointer' : 'grab' }
  const onDown = (ev: PointerEvent) => { down = [ev.clientX, ev.clientY] }
  const onUp = (ev: PointerEvent) => {
    const d = down; down = null
    if (!d || Math.hypot(ev.clientX - d[0], ev.clientY - d[1]) > 5) return
    const s = hit(ev); if (s) cb.pick?.(s.kind)
  }
  el.addEventListener('pointermove', onMove); el.addEventListener('pointerdown', onDown); el.addEventListener('pointerup', onUp)

  // ---- laço: a cena anima sem parar enquanto gira sozinha ou desenha a chama ilustrativa; com a chama do
  // simulador ela só redesenha quando algo muda, para a placa de vídeo ficar com a simulação
  const eye = new THREE.Vector3(), tgt = new THREE.Vector3()
  function publishCam() {   // câmera no referencial do simulador: centímetros a partir do centro do duto
    const k = (RIG.W * cell.scale.x) / LAB_W, inv = -cell.rotation.y, up = new THREE.Vector3(0, 1, 0)
    eye.copy(camera.position).sub(cell.position).applyAxisAngle(up, inv).divideScalar(k)
    tgt.copy(controls.target).sub(cell.position).applyAxisAngle(up, inv).divideScalar(k)
    const c = { eye: eye.toArray(), target: tgt.toArray(), up: [0, 1, 0], fov: camera.fov }
    labCam.last = c; labCam.send?.(c)
  }
  const continuous = () => mode === 'sketch' || controls.autoRotate || beacon.visible
  const frame = (now: number) => {
    raf = 0
    if (disposed) return
    if (goal) {
      camera.position.lerp(goal.pos, 0.07); controls.target.lerp(goal.tgt, 0.07)
      if (camera.position.distanceTo(goal.pos) < 0.02) goal = null
    }
    // exposição: de perto, com a chama do simulador, a cena escurece como numa câmera apontada para o fogo
    const want = inside && mode === 'sim' ? 0.5 : 1.05
    exposure += (want - exposure) * (reduce ? 1 : 0.08); renderer.toneMappingExposure = exposure
    drawFlame(now / 1000)
    controls.update(); renderer.render(scene, camera); labels.render(scene, camera)
    publishCam()
    frames = Math.max(0, frames - 1)
    // !raf: o controls.update() acima dispara 'change' → kick(), que pode já ter agendado o próximo quadro.
    // Agendar de novo aqui dobraria a cadeia a cada quadro (a cena chegava a ser desenhada centenas de vezes por quadro).
    if (!raf && (continuous() || frames > 0 || goal || Math.abs(want - exposure) > 0.01 || Math.abs(shadeGoal() - shade.material.opacity) > 0.01)) raf = requestAnimationFrame(frame)
  }
  const kick = (n = 60) => { frames = Math.max(frames, n); if (!raf && !disposed) raf = requestAnimationFrame(frame) }
  controls.addEventListener('change', () => kick(40))

  const resize = () => {
    const w = host.clientWidth || 600, h = host.clientHeight || 400
    renderer.setSize(w, h); labels.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix()
    if (spot && !goal && controls.autoRotate) aim(true)
    kick(10)
  }
  const ro = new ResizeObserver(resize); ro.observe(host); resize()

  loadAssets().then((a) => {
    if (disposed) return
    assets = a; show(state.kind, true); kick(); cb.ready?.()
  })

  return {
    set(s) {
      const prev = state.kind
      state = s
      if (!assets || (s.kind === prev && spot?.kind === s.kind)) { kick(3); return }
      if (world && WORLD_OF[s.kind] === world.id) {
        // mesmo lugar, outro habitat: a câmera voa até ele
        spot = world.spots.get(s.kind) ?? spot; place(); aim(false); kick()
      } else {
        // outro mundo: corte rápido, para não mostrar a cena pela metade
        host.style.transition = 'opacity .22s'; host.style.opacity = '0'
        setTimeout(() => { if (disposed) return; show(state.kind, true); controls.autoRotate = !reduce && !inside; host.style.opacity = '1'; kick() }, 230)
      }
    },
    enter(on) { if (inside === on) return; inside = on; controls.autoRotate = false; aim(false); kick() },
    setFlame(m, sim) { mode = m; if (sim) simState = sim; kick(30) },
    setWind(w) { windOn = w > 0; windLabel.element.textContent = windOn ? `air: ${w.toLocaleString(LOCALE, { maximumFractionDigits: 1 })} cm/s` : 'still air'; kick(3) },
    credits() { return world ? [...new Set(world.credits)] : [] },
    dispose() {
      if (disposed) return
      disposed = true; cancelAnimationFrame(raf); raf = 0; ro.disconnect(); controls.dispose()
      el.removeEventListener('pointermove', onMove); el.removeEventListener('pointerdown', onDown); el.removeEventListener('pointerup', onUp)
      // Todos os mundos já montados estão pendurados na cena (os escondidos também). Saem da placa de vídeo as
      // geometrias, os materiais, as texturas e o mapa de sombra desta cena; o que é cache de módulo (materiais e
      // texturas dos modelos carregados, a textura da Terra e o grão do solo) fica para a próxima cena.
      disposeObject(scene, new Set<object>([...(assets?.shared ?? []), ...sharedTextures()]))
      // cada vista cria o seu WebGLRenderer: sem devolver o contexto, o navegador os acumula até descartar os mais antigos
      renderer.dispose(); renderer.forceContextLoss()
      if (el.parentNode === host) host.removeChild(el); labelHost.replaceChildren()
    },
  }
}
