// O mapa 3D: cada teste do PSI é um ponto em O₂ × pressão × gravidade.
// Os andares são gravidades. Lua e Marte existem no mapa e estão vazios: é o que o acervo ainda não tem.
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { CSS2DObject, CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js'
import { pct, type Habitat, type Scenario, type Test, type Tier, type Verdict } from '../api'

export type MapView = 'persp' | 'frente' | 'topo'
export type ColorMode = 'familia' | 'desfecho' | 'gravidade'
const W = 12, H = 6, D = 7, P0 = 0.25, P1 = 5.5
const X = (o2: number) => (o2 - 0.5) * W
const Y = (g: number) => g * H
const Z = (p: number) => D / 2 - ((Math.log(Math.min(P1, Math.max(P0, p))) - Math.log(P0)) / (Math.log(P1) - Math.log(P0))) * D

const css = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim()
const FLOORS = [
  { g: 0, label: '0 g · órbita', v: '--g0', empty: false },
  { g: 0.165, label: '0,17 g · Lua', v: '--lua', empty: true },
  { g: 0.378, label: '0,38 g · Marte', v: '--marte', empty: true },
  { g: 1, label: '1 g · Terra', v: '--g1', empty: false },
]
export const LEGENDS: Record<ColorMode, [string, string][]> = {
  familia: [['Sólidos', '--solido'], ['Gotas', '--gota'], ['Chamas gasosas', '--gas']],
  desfecho: [['Queimou', '--g1'], ['Apagou', '--g0'], ['Gota estourou', '--gas'], ['Não acendeu', '--fumaca'], ['Não tabelado', '--ink-4']],
  gravidade: [['0 g', '--g0'], ['1 g', '--g1']],
}
const TIER_VAR: Record<Tier, string> = { medido: '--medido', delimitado: '--delimitado', parcial: '--parcial', sem_evidencia: '--incognita' }

function colorOf(t: Test, mode: ColorMode): string {
  if (mode === 'gravidade') return t.g >= 0.95 ? '--g1' : '--g0'
  if (mode === 'desfecho') return ({ queimou: '--g1', extinguiu: '--g0', disrupcao: '--gas', nao_acendeu: '--fumaca' } as Record<string, string>)[t.outcome] || '--ink-4'
  return ({ solido: '--solido', gota: '--gota', gas: '--gas' } as Record<string, string>)[t.family] || '--fumaca'
}
const hash = (i: number, k: number) => { const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return x - Math.floor(x) }

function label(text: string, cls: string) {
  const el = document.createElement('div')
  el.className = 'lbl ' + cls
  el.textContent = text
  return new CSS2DObject(el)
}
function glowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128
  const g = c.getContext('2d')!; const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128)
  return new THREE.CanvasTexture(c)
}
function hatchTexture(color: string) {
  const c = document.createElement('canvas'); c.width = c.height = 32
  const g = c.getContext('2d')!; g.strokeStyle = color; g.lineWidth = 1.2
  for (let i = -32; i < 64; i += 8) { g.beginPath(); g.moveTo(i, 32); g.lineTo(i + 32, 0); g.stroke() }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(W * 1.6, D * 1.6)
  return t
}

export interface Engine {
  setData(tests: Test[]): void
  setStyle(o: { mode: ColorMode; family: string; hidden: Set<string>; focusInv: string | null; near: Set<string> }): void
  setProbe(s: Scenario, v: Verdict | null): void
  setSelected(id: string | null): void
  setHabitats(h: Habitat[], active: string): void
  setGaps(list: Place[], selected: number | null): void   // ensaios que faltam: marcadores numerados no andar em que seriam feitos
  view(name: MapView): void
  dispose(): void
}

export interface Place { o2: number; pressure_atm: number; gravity: number }
export function createEngine(host: HTMLDivElement, labelHost: HTMLDivElement, cb: { hover(t: Test | null, x: number, y: number): void; pick(id: string): void; habitat(h: Habitat): void; place(p: Place): void; gap?(i: number): void }): Engine {
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 200)
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio))
  host.appendChild(renderer.domElement)
  const labels = new CSS2DRenderer({ element: labelHost })
  const controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true; controls.dampingFactor = 0.08; controls.maxDistance = 70; controls.minDistance = 3
  controls.maxPolarAngle = Math.PI * 0.62
  const HOME = { pos: new THREE.Vector3(2.4, 6.6, 14.2), tgt: new THREE.Vector3(-0.6, 2.2, 0) }
  const HOME0 = { pos: HOME.pos.clone(), tgt: HOME.tgt.clone() }; let fitK = 1
  camera.position.copy(HOME.pos); controls.target.copy(HOME.tgt)
  let camGoal: { pos: THREE.Vector3; tgt: THREE.Vector3 } | null = null
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches

  // ----- andares, grade e rótulos
  const o2Ticks = [0.1, 0.21, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1]
  const pTicks: [number, string][] = [[0.2925, '4,3 psi'], [1, '14,7 psi'], [5, '5 atm']]
  for (const f of FLOORS) {
    const col = new THREE.Color(css(f.v))
    const pts: number[] = []
    for (const o of o2Ticks) pts.push(X(o), 0, -D / 2, X(o), 0, D / 2)
    for (const p of [0.2925, 0.558, 0.694, 1, 2, 3, 5]) pts.push(-W / 2, 0, Z(p), W / 2, 0, Z(p))
    const grid = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)),
      new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: f.empty ? 0.1 : 0.2 }))
    const edge = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-W / 2, 0, -D / 2), new THREE.Vector3(W / 2, 0, -D / 2), new THREE.Vector3(W / 2, 0, D / 2), new THREE.Vector3(-W / 2, 0, D / 2)]),
      new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: 0.55 }))
    const grp = new THREE.Group(); grp.position.y = Y(f.g); grp.add(grid, edge)
    if (f.empty) {
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshBasicMaterial({
        map: hatchTexture(css('--incognita')), transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false }))
      plane.rotation.x = -Math.PI / 2; grp.add(plane)
      const v = label('nenhum teste da NASA aqui', 'void'); v.position.set(2.4, 0.02, -D / 2 + 0.6); grp.add(v)
      // faixa do enunciado: 30% de O₂ ou mais, 10,2 psi ou menos (até o traje, 4,3 psi)
      const x0 = X(0.3), x1 = X(1), z0 = Z(0.694), z1 = Z(0.2925)
      const band = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, Math.abs(z1 - z0)), new THREE.MeshBasicMaterial({
        color: css('--act'), transparent: true, opacity: 0.07, side: THREE.DoubleSide, depthWrite: false }))
      band.rotation.x = -Math.PI / 2; band.position.set((x0 + x1) / 2, 0.01, (z0 + z1) / 2); grp.add(band)
      const out = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(x0, 0.01, z0), new THREE.Vector3(x1, 0.01, z0), new THREE.Vector3(x1, 0.01, z1), new THREE.Vector3(x0, 0.01, z1)]),
        new THREE.LineBasicMaterial({ color: css('--act'), transparent: true, opacity: 0.6 }))
      grp.add(out)
      if (f.g < 0.2) { const b = label('ar previsto para a Lua e Marte', 'band'); b.position.set((x0 + x1) / 2, 0.02, z1 + 0.2); grp.add(b) }
    }
    const fl = label(f.label, 'floor'); (fl.element as HTMLElement).style.color = css(f.v); fl.position.set(-W / 2 - 0.9, 0, -D / 2); grp.add(fl)
    scene.add(grp)
  }
  for (const o of [0.21, 0.4, 0.6, 0.8, 1]) { const l = label(pct(o), ''); l.position.set(X(o), 0, D / 2 + 0.35); scene.add(l) }
  const ax = label('oxigênio', 'axis'); ax.position.set(X(0.02), 0, D / 2 + 0.35); scene.add(ax)
  for (const [p, t] of pTicks) { const l = label(t, ''); l.position.set(W / 2 + 0.55, 0, Z(p)); scene.add(l) }
  const az = label('pressão', 'axis'); az.position.set(W / 2 + 0.55, 0, Z(P1) - 0.5); scene.add(az)
  // pilares nos cantos: ligam os andares
  const pil: number[] = []
  for (const [x, z] of [[-W / 2, -D / 2], [W / 2, -D / 2], [W / 2, D / 2], [-W / 2, D / 2]]) pil.push(x, 0, z, x, H, z)
  scene.add(new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pil, 3)),
    new THREE.LineBasicMaterial({ color: css('--line-2'), transparent: true, opacity: 0.5 })))

  // ----- pontos (testes)
  let tests: Test[] = []
  const pos = new Map<string, THREE.Vector3>()
  let alpha = new Float32Array(0)
  const geo = new THREE.BufferGeometry()
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uScale: { value: 1 } },
    vertexShader: `attribute vec3 aColor; attribute float aSize; attribute float aAlpha; varying vec3 vC; varying float vA; uniform float uScale;
      void main(){ vC=aColor; vA=aAlpha; vec4 mv=modelViewMatrix*vec4(position,1.0); gl_PointSize=aSize*uScale/-mv.z; gl_Position=projectionMatrix*mv; }`,
    fragmentShader: `varying vec3 vC; varying float vA;
      void main(){ float d=length(gl_PointCoord-0.5); if(d>0.5||vA<0.01) discard; float a=smoothstep(0.5,0.4,d); float rim=smoothstep(0.34,0.46,d);
        gl_FragColor=vec4(mix(vC,vC*0.45,rim),vA*a); }`,
  })
  const points = new THREE.Points(geo, mat); points.frustumCulled = false; scene.add(points)

  // ----- sonda
  const probe = new THREE.Group(); scene.add(probe)
  const flame = new THREE.Mesh(new THREE.SphereGeometry(0.15, 28, 18), new THREE.MeshBasicMaterial({ color: css('--g0') }))
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: css('--g0'), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }))
  glow.scale.set(1.5, 1.5, 1)
  const box = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)), new THREE.LineBasicMaterial({ color: css('--incognita') }))
  probe.add(flame, glow, box)
  // rótulo do cenário: só aparece quando ele não é um dos ambientes prontos (esses já levam o próprio nome)
  const probeLabel = label('seu cenário', 'habl on'); probeLabel.center.set(0.5, 1.9); probeLabel.visible = false; probe.add(probeLabel)
  const plumb = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, H, 0)]),
    new THREE.LineDashedMaterial({ color: css('--text'), dashSize: 0.12, gapSize: 0.1, transparent: true, opacity: 0.45 }))
  plumb.computeLineDistances(); scene.add(plumb)
  const links = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: css('--text'), transparent: true, opacity: 0.5 }))
  links.frustumCulled = false; scene.add(links)
  const ring = new THREE.Sprite(new THREE.SpriteMaterial({ map: (() => {
    const c = document.createElement('canvas'); c.width = c.height = 96; const g = c.getContext('2d')!
    g.strokeStyle = '#fff'; g.lineWidth = 7; g.beginPath(); g.arc(48, 48, 36, 0, Math.PI * 2); g.stroke(); return new THREE.CanvasTexture(c) })(),
    color: css('--act'), transparent: true, depthTest: false }))
  ring.scale.set(0.5, 0.5, 1); ring.visible = false; scene.add(ring)
  const goal = new THREE.Vector3(X(0.21), 0, Z(1))
  probe.position.copy(goal)
  let nearIds: string[] = []
  const tolX = 0.02 * W, tolZ = (0.2 / (Math.log(P1) - Math.log(P0))) * D, tolY = 0.05 * H
  box.scale.set(tolX * 2, tolY * 2, tolZ * 2)

  // ----- habitats (balizas)
  const habGroup = new THREE.Group(); scene.add(habGroup)
  let habMeshes: { mesh: THREE.Mesh; h: Habitat; el: HTMLElement }[] = []

  // ----- o que falta testar
  const gapGroup = new THREE.Group(); scene.add(gapGroup)

  // ----- interação
  const ray = new THREE.Raycaster(); ray.params.Points = { threshold: 0.2 }
  const mouse = new THREE.Vector2(); let down: [number, number] | null = null
  const hit = (ev: PointerEvent) => {
    const r = renderer.domElement.getBoundingClientRect()
    mouse.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1)
    ray.setFromCamera(mouse, camera)
    const hb = ray.intersectObjects(habMeshes.map((m) => m.mesh))[0]
    if (hb) return { hab: habMeshes.find((m) => m.mesh === hb.object)!.h }
    let best: { i: number; d: number } | null = null
    for (const it of ray.intersectObject(points)) {
      const i = it.index!; if (alpha[i] < 0.05) continue
      const d = it.distanceToRay ?? 9
      if (!best || d < best.d) best = { i, d }
    }
    return best ? { test: tests[best.i] } : {}
  }
  const onMove = (ev: PointerEvent) => {
    const h = hit(ev); const r = host.getBoundingClientRect()
    renderer.domElement.style.cursor = h.test || h.hab ? 'pointer' : 'grab'
    cb.hover(h.test ?? null, ev.clientX - r.left, ev.clientY - r.top)
  }
  // ponto de um andar sob o cursor, convertido de volta para oxigênio, pressão e gravidade (o andar mais perto da câmera)
  const floorAt = (ev: PointerEvent): Place | null => {
    const r = renderer.domElement.getBoundingClientRect()
    mouse.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1)
    ray.setFromCamera(mouse, camera)
    const o = ray.ray.origin, d = ray.ray.direction
    let best: { t: number; x: number; z: number; g: number } | null = null
    for (const f of FLOORS) {
      if (Math.abs(d.y) < 1e-6) continue
      const t = (Y(f.g) - o.y) / d.y
      if (t <= 0) continue
      const x = o.x + d.x * t, z = o.z + d.z * t
      if (Math.abs(x) > W / 2 || Math.abs(z) > D / 2) continue
      if (!best || t < best.t) best = { t, x, z, g: f.g }
    }
    if (!best) return null
    const p = Math.exp(Math.log(P0) + ((D / 2 - best.z) / D) * (Math.log(P1) - Math.log(P0)))
    return { o2: Math.round(Math.min(1, Math.max(0.05, best.x / W + 0.5)) * 200) / 200, pressure_atm: Math.round(p * 100) / 100, gravity: best.g }
  }
  const onDown = (ev: PointerEvent) => { down = [ev.clientX, ev.clientY] }
  const onUp = (ev: PointerEvent) => {
    if (!down || Math.hypot(ev.clientX - down[0], ev.clientY - down[1]) > 5) return
    // botão direito sem arrastar: leva o cenário até aquele ponto do andar (arrastando, continua a mover a câmera)
    if (ev.button === 2) { const f = floorAt(ev); if (f) cb.place(f); return }
    const h = hit(ev); if (h.hab) cb.habitat(h.hab); else if (h.test) cb.pick(h.test.id)
  }
  const onMenu = (ev: Event) => ev.preventDefault()
  const onLeave = () => cb.hover(null, 0, 0)
  const el = renderer.domElement
  el.addEventListener('pointermove', onMove); el.addEventListener('pointerdown', onDown); el.addEventListener('pointerup', onUp); el.addEventListener('pointerleave', onLeave)
  el.addEventListener('contextmenu', onMenu)

  const resize = () => {
    const w = host.clientWidth || 600, h = host.clientHeight || 400
    renderer.setSize(w, h); labels.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix()
    mat.uniforms.uScale.value = h * 0.9
    // em palcos estreitos a câmera recua para o prédio inteiro caber
    const k = Math.max(1, 1.62 / camera.aspect)
    if (Math.abs(k - fitK) > 0.03) {
      fitK = k
      const pos = HOME0.tgt.clone().add(HOME0.pos.clone().sub(HOME0.tgt).multiplyScalar(k))
      HOME.pos.copy(pos); camera.position.copy(pos); controls.target.copy(HOME.tgt)
    }
  }
  const ro = new ResizeObserver(resize); ro.observe(host); resize()

  let raf = 0
  const updateLinks = () => {
    const arr: number[] = []
    for (const id of nearIds) { const p = pos.get(id); if (p) arr.push(probe.position.x, probe.position.y, probe.position.z, p.x, p.y, p.z) }
    links.geometry.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3))
  }
  const tick = () => {
    raf = requestAnimationFrame(tick)
    if (probe.position.distanceToSquared(goal) > 1e-6) {
      reduce ? probe.position.copy(goal) : probe.position.lerp(goal, 0.18)
      plumb.position.set(probe.position.x, 0, probe.position.z); updateLinks()
    }
    if (camGoal) {
      camera.position.lerp(camGoal.pos, reduce ? 1 : 0.12); controls.target.lerp(camGoal.tgt, reduce ? 1 : 0.12)
      if (camera.position.distanceTo(camGoal.pos) < 0.02) camGoal = null
    }
    const s = 1 + Math.sin(performance.now() / 420) * 0.05; glow.scale.setScalar(1.5 * (reduce ? 1 : s))
    controls.update(); renderer.render(scene, camera); labels.render(scene, camera)
  }
  tick()

  return {
    setData(list) {
      tests = list.filter((t) => t.o2 != null && t.p != null)
      const p = new Float32Array(tests.length * 3)
      pos.clear()
      tests.forEach((t, i) => {
        const v = new THREE.Vector3(X(t.o2!) + (hash(i, 1) - 0.5) * 0.13, Y(t.g) + 0.03 + hash(i, 2) * 0.2, Z(t.p!) + (hash(i, 3) - 0.5) * 0.13)
        p.set([v.x, v.y, v.z], i * 3); pos.set(t.id, v)
      })
      geo.setAttribute('position', new THREE.BufferAttribute(p, 3))
      geo.computeBoundingSphere() // o raycaster guarda a esfera antiga; sem isto nenhum ponto é clicável
      geo.setAttribute('aColor', new THREE.BufferAttribute(new Float32Array(tests.length * 3), 3))
      geo.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(tests.length), 1))
      alpha = new Float32Array(tests.length); geo.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1))
    },
    setStyle({ mode, family, hidden, focusInv, near }) {
      if (!tests.length) return
      const col = geo.getAttribute('aColor') as THREE.BufferAttribute, size = geo.getAttribute('aSize') as THREE.BufferAttribute
      const c = new THREE.Color(); const cache = new Map<string, THREE.Color>()
      tests.forEach((t, i) => {
        const v = colorOf(t, mode); let cc = cache.get(v); if (!cc) { cc = new THREE.Color(css(v)); cache.set(v, cc) }
        c.copy(cc); col.setXYZ(i, c.r, c.g, c.b)
        let a = family === 'todas' || t.family === family ? 0.95 : 0.32
        if (focusInv) a = t.inv === focusInv ? 1 : a * 0.3
        if (hidden.has(t.inv)) a = 0
        alpha[i] = a
        size.setX(i, near.has(t.id) ? 0.46 : 0.3)
      })
      col.needsUpdate = true; size.needsUpdate = true; (geo.getAttribute('aAlpha') as THREE.BufferAttribute).needsUpdate = true
    },
    setProbe(s, v) {
      goal.set(X(s.o2), Y(s.gravity), Z(s.pressure_atm))
      probeLabel.visible = !s.habitat
      const tierCol = new THREE.Color(css(TIER_VAR[v?.tier ?? 'sem_evidencia']))
      ;(box.material as THREE.LineBasicMaterial).color.copy(tierCol); (links.material as THREE.LineBasicMaterial).color.copy(tierCol)
      const fc = new THREE.Color(css('--g0')).lerp(new THREE.Color(css('--g1')), Math.min(1, s.gravity * 1.4))
      ;(flame.material as THREE.MeshBasicMaterial).color.copy(fc); glow.material.color.copy(fc)
      flame.scale.set(1 - 0.25 * s.gravity, 1 + 1.5 * s.gravity, 1 - 0.25 * s.gravity); flame.position.y = 0.2 * s.gravity
      nearIds = (v?.nearest ?? []).slice(0, 6).map((n) => n.test.id); updateLinks()
    },
    setSelected(id) {
      const p = id ? pos.get(id) : null
      ring.visible = !!p; if (p) ring.position.copy(p)
    },
    setHabitats(list, active) {
      habMeshes.forEach((m) => { m.mesh.clear(); m.el.remove(); habGroup.remove(m.mesh) }); habMeshes = []
      for (const h of list) {
        const mesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.11), new THREE.MeshBasicMaterial({ color: h.id === active ? css('--act') : css('--text'), wireframe: true }))
        mesh.position.set(X(h.o2), Y(h.gravity) + 0.45, Z(h.pressure_atm))
        const l = label(h.name, 'habl' + (h.id === active ? ' on' : '')); l.center.set(0.5, 1.6)
        if (h.id === active) mesh.add(l)   // só o ambiente escolhido leva nome; os outros são balizas clicáveis
        habGroup.add(mesh); habMeshes.push({ mesh, h, el: l.element as HTMLElement })
      }
    },
    setGaps(list, selected) {
      for (const o of [...gapGroup.children]) { o.traverse((c) => (c as CSS2DObject).element?.remove()); gapGroup.remove(o) }
      list.forEach((g, i) => {
        const p = new THREE.Vector3(X(g.o2), Y(g.gravity) + 0.06, Z(g.pressure_atm))
        const m = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.27, 28), new THREE.MeshBasicMaterial({ color: css('--incognita'), side: THREE.DoubleSide, transparent: true, opacity: i === selected ? 1 : 0.7 }))
        m.rotation.x = -Math.PI / 2; m.position.copy(p)
        const l = label(String(i + 1), 'gap' + (i === selected ? ' on' : '')); l.center.set(0.5, 0.5); l.position.set(0, 0, 0.02)
        l.element.title = 'Ensaio que falta'; l.element.addEventListener('click', () => cb.gap?.(i))
        m.add(l); gapGroup.add(m)
      })
    },
    view(name) {
      // as vistas chapadas recuam junto com o prédio em palcos estreitos
      camGoal = name === 'frente' ? { pos: new THREE.Vector3(0, 3, 21 * fitK), tgt: new THREE.Vector3(0, 3, 0) }
        : name === 'topo' ? { pos: new THREE.Vector3(0, 21 * fitK, 0.01), tgt: new THREE.Vector3(0, 0, 0) }
        : { pos: HOME.pos.clone(), tgt: HOME.tgt.clone() }
    },
    dispose() {
      cancelAnimationFrame(raf); ro.disconnect(); controls.dispose()
      el.removeEventListener('pointermove', onMove); el.removeEventListener('pointerdown', onDown); el.removeEventListener('pointerup', onUp); el.removeEventListener('pointerleave', onLeave)
      el.removeEventListener('contextmenu', onMenu)
      renderer.dispose(); host.removeChild(renderer.domElement); labelHost.replaceChildren()
    },
  }
}
