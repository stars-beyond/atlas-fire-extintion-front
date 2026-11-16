// Cena 3D da missão (portada do mission-fire-engine, rótulos em inglês): Sol, planetas, rota calculada pelo motor e a nave no instante do cursor.
// Tudo o que é posição vem da série devolvida pela API (x_au, y_au, earth_*, dest_*). Tamanhos de corpos
// são exagerados para leitura; distâncias heliocêntricas estão em escala linear (1 UA = AU unidades).
// A jornada lunar é esquemática, como na vista 2D: o motor não calcula a geometria Terra–Lua.
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { CSS2DObject, CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js'
import { Line2 } from 'three/examples/jsm/lines/Line2.js'
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js'
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js'
import type { MissionEvent, Severity, SimResult, Tier } from './mfe'

export type CameraMode = 'system' | 'follow' | 'top' | 'cinematic'

export interface SceneOptions {
  /** Desloca o centro óptico (fração da largura/altura; x negativo empurra a cena para a direita). */
  viewOffset?: { x: number; y: number }
  /** Igual a viewOffset, para telas estreitas (≤ 700 px). */
  mobileViewOffset?: { x: number; y: number }
  /** Rótulo "Nave · dia X" acima da nave. */
  craftLabel?: boolean
}

export const TIER_HEX: Record<Tier, number> = { medido: 0x4cc38a, delimitado: 0x3fb5c4, parcial: 0xe2b54a, sem_evidencia: 0xef6a6a }
const SEV_HEX: Record<Severity, number> = { info: 0x7ea6d8, atencao: 0xf2b544, critico: 0xff6e5a }
const AU = 30
const TEX = 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r160/examples/textures/planets/'
const PLANET_AU = { Vênus: 0.72333566, Terra: 1.00000261, Marte: 1.52371034 }
const PLANET_EN: Record<keyof typeof PLANET_AU, string> = { Vênus: 'Venus', Terra: 'Earth', Marte: 'Mars' }

export interface SceneCallbacks {
  onPickEvent: (e: MissionEvent) => void
  onPickIndex: (i: number) => void
  onHover: (h: { x: number; y: number; text: string } | null) => void
}

export type ColorMode = 'evidence' | 'spread'

/** Cor da rota pela propagação prevista pelo Atlas (× nominal); cinza onde o modelo não tem número. */
export function spreadHex(ratio: number | null | undefined): number {
  if (ratio == null || !Number.isFinite(ratio)) return 0x56606e
  const stops: [number, number][] = [[0.6, 0x3a8fd9], [1, 0x3fb5c4], [1.5, 0xe2b54a], [2.5, 0xef6a6a]]
  if (ratio <= stops[0][0]) return stops[0][1]
  for (let k = 1; k < stops.length; k++) {
    if (ratio <= stops[k][0]) {
      const t = (ratio - stops[k - 1][0]) / (stops[k][0] - stops[k - 1][0])
      return new THREE.Color(stops[k - 1][1]).lerp(new THREE.Color(stops[k][1]), t).getHex()
    }
  }
  return stops[stops.length - 1][1]
}

export interface SpaceScene {
  setCursor: (i: number) => void
  setSelected: (id: string | null) => void
  setCameraMode: (m: CameraMode, animate?: boolean, seconds?: number) => void
  /** Pinta a rota pelo nível de evidência ou pela propagação prevista pelo modelo treinado. */
  setColorMode: (m: ColorMode) => void
  /** Abertura: a câmera parte de longe e voa até a visão geral. */
  intro: () => void
  dispose: () => void
}

// ---------- texturas procedurais (funcionam offline) ----------
function rand(seed: number) { return () => ((seed = (seed * 16807) % 2147483647) / 2147483647) }

function planetTexture(base: string, spots: string[], seed: number, bands = false) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 256
  const g = c.getContext('2d')!, r = rand(seed)
  g.fillStyle = base; g.fillRect(0, 0, 512, 256)
  if (bands) {
    for (let y = 0; y < 256; y += 4) { g.fillStyle = spots[Math.floor(r() * spots.length)]; g.globalAlpha = 0.18 + r() * 0.2; g.fillRect(0, y, 512, 3 + r() * 6) }
  }
  for (let k = 0; k < 220; k++) {
    g.globalAlpha = 0.08 + r() * 0.25; g.fillStyle = spots[Math.floor(r() * spots.length)]
    const x = r() * 512, y = 20 + r() * 216, rx = 6 + r() * 40, ry = rx * (0.35 + r() * 0.5)
    g.beginPath(); g.ellipse(x, y, rx, ry, r() * Math.PI, 0, Math.PI * 2); g.fill()
  }
  g.globalAlpha = 1
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace
  return t
}

function glowTexture(inner: string, outer: string) {
  const c = document.createElement('canvas'); c.width = c.height = 128
  const g = c.getContext('2d')!, grad = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  grad.addColorStop(0, inner); grad.addColorStop(0.25, inner); grad.addColorStop(1, outer)
  g.fillStyle = grad; g.fillRect(0, 0, 128, 128)
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace
  return t
}

function glow(color: string, size: number, opacity = 1) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture(color, 'rgba(0,0,0,0)'), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity,
  }))
  s.scale.setScalar(size)
  return s
}

function label(text: string, cls = '') {
  const div = document.createElement('div')
  div.className = `s3d-label ${cls}`; div.textContent = text
  return new CSS2DObject(div)
}

function ring(radius: number, color: number, opacity: number, dashed = false) {
  const pts: THREE.Vector3[] = []
  for (let i = 0; i <= 256; i++) { const a = (i / 256) * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a) * radius, 0, -Math.sin(a) * radius)) }
  const geo = new THREE.BufferGeometry().setFromPoints(pts)
  const mat = dashed
    ? new THREE.LineDashedMaterial({ color, transparent: true, opacity, dashSize: 0.6, gapSize: 0.6 })
    : new THREE.LineBasicMaterial({ color, transparent: true, opacity })
  const line = new THREE.Line(geo, mat)
  if (dashed) line.computeLineDistances()
  return line
}

function planet(radius: number, tex: THREE.Texture, opts: { emissive?: number; tilt?: number } = {}) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(radius, 48, 32), new THREE.MeshStandardMaterial({
    map: tex, roughness: 0.95, metalness: 0, emissive: opts.emissive ?? 0x000000, emissiveIntensity: 0.12,
  }))
  m.rotation.z = (opts.tilt ?? 0) * Math.PI / 180
  return m
}

function tryTexture(mesh: THREE.Mesh, file: string) {
  new THREE.TextureLoader().setCrossOrigin('anonymous').load(TEX + file, (t) => {
    t.colorSpace = THREE.SRGBColorSpace
    const mat = mesh.material as THREE.MeshStandardMaterial
    mat.map?.dispose(); mat.map = t; mat.needsUpdate = true
  }, undefined, () => { /* offline: mantém a textura procedural */ })
}

function rocket() {
  const g = new THREE.Group()
  const white = new THREE.MeshStandardMaterial({ color: 0xe8eef6, roughness: 0.4, metalness: 0.3 })
  const accent = new THREE.MeshStandardMaterial({ color: 0xf2b544, roughness: 0.5, metalness: 0.2 })
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.8, 20), white)
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.36, 20), accent)
  nose.position.y = 0.58
  const fins = new THREE.Group()
  for (let k = 0; k < 3; k++) {
    const f = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.26, 0.22), accent)
    const a = (k / 3) * Math.PI * 2
    f.position.set(Math.cos(a) * 0.2, -0.3, Math.sin(a) * 0.2); f.rotation.y = -a
    fins.add(f)
  }
  const flame = glow('rgba(255,170,80,1)', 0.7, 0.9)
  flame.position.y = -0.55
  const inner = new THREE.Group()
  inner.add(body, nose, fins, flame)
  inner.rotation.x = Math.PI / 2   // eixo do foguete em +Z: Object3D.lookAt aponta +Z para o alvo
  g.add(inner)
  return { group: g, flame }
}

// ---------- geometria: série → coordenadas da cena ----------
const helio = (x: number, y: number) => new THREE.Vector3(x * AU, 0, -y * AU)

interface Layout {
  path: THREE.Vector3[]
  earth: (i: number) => THREE.Vector3
  dest: ((i: number) => THREE.Vector3) | null
  sites: { name: string; pos: THREE.Vector3; normal: THREE.Vector3 }[]
}

const MOON_POS = new THREE.Vector3(34, 0, -6)
const EARTH_R_LUNAR = 4.2, MOON_R = 2.8

function lunarLayout(result: SimResult): Layout {
  const s = result.series, arrival = result.profile.transit_days
  // locais na face da Lua voltada para a rota: pouso, depois cada habitat na ordem em que aparece
  const names: string[] = []
  s.t_day.forEach((d, i) => { if (d >= arrival && !names.includes(s.habitat[i])) names.push(s.habitat[i]) })
  const sites = names.map((name, k) => {
    const a = 0.05 + (names.length > 1 ? (1.35 * k) / (names.length - 1) : 0.6)   // face voltada à Terra e à câmera
    const normal = new THREE.Vector3(-Math.cos(a), k % 2 ? -0.45 : 0.55, Math.sin(a)).normalize()
    return { name, normal, pos: MOON_POS.clone().addScaledVector(normal, MOON_R * 1.02) }
  })
  const start = new THREE.Vector3(EARTH_R_LUNAR * 1.35, 0.4, 0)
  const land = sites[0]?.pos ?? MOON_POS.clone().add(new THREE.Vector3(-MOON_R, 0, 0))
  const curve = new THREE.CubicBezierCurve3(start, new THREE.Vector3(12, 5, 14), new THREE.Vector3(26, 3.5, 8), land)
  const path = s.t_day.map((d, i) => {
    if (d < arrival) return curve.getPoint(Math.min(d / arrival, 1))
    const site = sites.find((x) => x.name === s.habitat[i]) ?? sites[0]
    return site.pos.clone().addScaledVector(site.normal, 0.35)   // apoiada no solo
  })
  return { path, earth: () => new THREE.Vector3(), dest: () => MOON_POS.clone(), sites }
}

function helioLayout(result: SimResult): Layout {
  const s = result.series
  return {
    path: s.x_au.map((x, i) => helio(x, s.y_au[i])),
    earth: (i) => helio(s.earth_x[i], s.earth_y[i]),
    dest: (i) => helio(s.dest_x[i], s.dest_y[i]),
    sites: [],
  }
}

// ---------- cena ----------
export function createSpaceScene(container: HTMLElement, result: SimResult, cb: SceneCallbacks, opts: SceneOptions = {}): SpaceScene | null {
  let renderer: THREE.WebGLRenderer
  try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false }) } catch { return null }
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.domElement.className = 's3d-canvas'
  container.appendChild(renderer.domElement)
  const labels = new CSS2DRenderer()
  labels.domElement.className = 's3d-labels'
  container.appendChild(labels.domElement)

  const lunar = result.profile.id === 'terra-lua'
  const s = result.series, n = s.t_day.length
  const L = lunar ? lunarLayout(result) : helioLayout(result)

  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x05080d)
  const camera = new THREE.PerspectiveCamera(42, 1, 0.05, 4000)
  const controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true; controls.dampingFactor = 0.08
  controls.minDistance = 2; controls.maxDistance = lunar ? 160 : 260

  // estrelas
  const stars: number[] = [], r = rand(7)
  for (let i = 0; i < 3000; i++) {
    const d = 900 + r() * 600, a = r() * Math.PI * 2, b = Math.acos(2 * r() - 1)
    stars.push(d * Math.sin(b) * Math.cos(a), d * Math.cos(b), d * Math.sin(b) * Math.sin(a))
  }
  const starGeo = new THREE.BufferGeometry(); starGeo.setAttribute('position', new THREE.Float32BufferAttribute(stars, 3))
  scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xc9d6e8, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0.8 })))
  scene.add(new THREE.AmbientLight(0xffffff, lunar ? 0.18 : 0.08))

  const spin: THREE.Object3D[] = []
  let earthMesh: THREE.Object3D, destMesh: THREE.Object3D | null = null

  if (lunar) {
    const sunLight = new THREE.DirectionalLight(0xfff4e0, 2.6); sunLight.position.set(-60, 25, 50); scene.add(sunLight)
    const earth = planet(EARTH_R_LUNAR, planetTexture('#2a5d9a', ['#3f8a5a', '#6aa36e', '#d9e3ea', '#1f4c80'], 3), { tilt: 23.4 })
    tryTexture(earth, 'earth_atmos_2048.jpg')
    const atmo = glow('rgba(120,180,255,0.55)', EARTH_R_LUNAR * 3.1, 0.55)
    const el = label('Earth'); el.position.set(0, -EARTH_R_LUNAR - 1.1, 0)
    scene.add(earth, atmo, el); spin.push(earth); earthMesh = earth
    const moon = planet(MOON_R, planetTexture('#8d8f94', ['#6c6e73', '#a7a9ad', '#595b60'], 11))
    tryTexture(moon, 'moon_1024.jpg')
    moon.position.copy(MOON_POS); scene.add(moon); destMesh = moon
    const ml = label('Moon · 0.165 g'); ml.position.set(MOON_R + 2.6, 0, 0); moon.add(ml)
    scene.add(ring(MOON_POS.length(), 0x5f6f85, 0.25, true))
    L.sites.forEach((site, k) => {
      const m = new THREE.Mesh(k === 0 ? new THREE.ConeGeometry(0.12, 0.3, 12) : new THREE.BoxGeometry(0.22, 0.14, 0.3),
        new THREE.MeshStandardMaterial({ color: 0xb7c7da, roughness: 0.6 }))
      m.position.copy(site.pos); m.lookAt(site.pos.clone().add(site.normal)); m.rotateX(Math.PI / 2)
      const lb = label(site.name, 'site'); lb.position.copy(site.pos.clone().addScaledVector(site.normal, 1.3))
      scene.add(m, lb)
    })
    camera.position.set(19, 21, 50)
    controls.target.set(19, 0, -3)
  } else {
    const sun = new THREE.Mesh(new THREE.SphereGeometry(2.4, 48, 32), new THREE.MeshBasicMaterial({ color: 0xffe7a3 }))
    scene.add(sun, glow('rgba(255,214,120,1)', 11, 0.8), glow('rgba(255,170,60,0.5)', 26, 0.3))
    const sl = label('Sun', 'sun'); sl.position.set(0, -3.6, 0); scene.add(sl)
    scene.add(new THREE.PointLight(0xfff1d6, 3.2, 0, 0))
    // órbitas de contexto (circulares e coplanares, como no motor)
    const rEnd = s.r_au[n - 1]
    Object.entries(PLANET_AU).forEach(([name, au]) => {
      scene.add(ring(au * AU, 0x2d3a4d, 0.9))
      const lb = label(PLANET_EN[name as keyof typeof PLANET_AU], 'orbit'); lb.position.set(au * AU * 0.7071, 0, -au * AU * 0.7071); scene.add(lb)
    })
    const named = Object.values(PLANET_AU).some((au) => Math.abs(au - rEnd) < 0.01)
    if (!named) {
      scene.add(ring(rEnd * AU, 0xef6a6a, 0.5, true))
      const lb = label(`perihelion ${rEnd.toFixed(2)} AU`, 'orbit warn'); lb.position.set(0, 0, rEnd * AU); scene.add(lb)
    }
    const earth = planet(1.6, planetTexture('#2a5d9a', ['#3f8a5a', '#6aa36e', '#d9e3ea', '#1f4c80'], 3), { tilt: 23.4 })
    tryTexture(earth, 'earth_atmos_2048.jpg')
    const earthHolder = new THREE.Group(), el = label('Earth'); el.position.set(0, -2.7, 0)
    earthHolder.add(earth, glow('rgba(120,180,255,0.6)', 5, 0.6), el)
    scene.add(earthHolder); spin.push(earth); earthMesh = earthHolder
    const kind = Math.abs(rEnd - PLANET_AU.Marte) < 0.01 ? 'Marte' : Math.abs(rEnd - PLANET_AU.Vênus) < 0.01 ? 'Vênus' : null
    if (kind === 'Marte') {
      destMesh = planet(1.25, planetTexture('#b5532f', ['#8a3a20', '#d7804f', '#6e2c18', '#e3a07a'], 5), { tilt: 25 })
    } else if (kind === 'Vênus') {
      destMesh = planet(1.5, planetTexture('#d9b46e', ['#c99a52', '#efd6a0', '#b68a48'], 9, true), { tilt: 177 })
    } else {
      destMesh = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.07, 8, 40), new THREE.MeshBasicMaterial({ color: 0xef6a6a }))
      destMesh.rotation.x = Math.PI / 2
    }
    const destHolder = new THREE.Group(), dl = label(kind === 'Marte' ? 'Mars' : kind === 'Vênus' ? 'Venus' : 'Arrival point'); dl.position.set(0, -2.5, 0)
    destHolder.add(destMesh, dl)
    if (kind) spin.push(destMesh)
    scene.add(destHolder); destMesh = destHolder
    const R = Math.max(1.1, ...s.r_au) * AU
    // todas as transferências percorrem θ = 0 → π (lado −z da cena, ao fundo); a metade da frente fica livre
    // para as leituras no canto inferior
    camera.position.set(R * 0.1, R * 1.25, R * 1.45)
    controls.target.set(0, 0, -R * 0.38)
  }
  const home = { pos: camera.position.clone(), target: controls.target.clone() }

  // rota: inteira e esmaecida + trecho percorrido, ambas coloridas pelo nível de evidência
  let colorMode: ColorMode = 'evidence'
  const hexAt = (i: number) => colorMode === 'spread' ? spreadHex(s.ml_spread_ratio?.[i]) : TIER_HEX[s.evidence_tier[i]]
  const positions: number[] = []
  L.path.forEach((p) => positions.push(p.x, p.y, p.z))
  const routeColors = () => {
    const colors: number[] = [], dim: number[] = [], c = new THREE.Color()
    L.path.forEach((_, i) => { c.setHex(hexAt(i)); colors.push(c.r, c.g, c.b); dim.push(c.r * 0.45, c.g * 0.45, c.b * 0.45) })
    return { colors, dim }
  }
  const { colors, dim } = routeColors()
  const mkLine = (cols: number[], width: number, opacity: number) => {
    const geo = new LineGeometry(); geo.setPositions(positions); geo.setColors(cols)
    const mat = new LineMaterial({ vertexColors: true, linewidth: width, transparent: true, opacity, worldUnits: false })
    const line = new Line2(geo, mat); line.computeLineDistances()
    return { line, geo, mat }
  }
  const full = mkLine(dim, 1.6, 0.7)
  const past = mkLine(colors, 3.6, 1)
  scene.add(full.line, past.line)

  // linha Sol → nave: a distância que governa a irradiância
  const sunLineGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()])
  const sunLine = new THREE.Line(sunLineGeo, new THREE.LineDashedMaterial({ color: 0xf2d15c, transparent: true, opacity: 0.55, dashSize: 0.8, gapSize: 0.6 }))
  const sunLineLabel = label('', 'sunline')
  if (!lunar) scene.add(sunLine, sunLineLabel)

  // nave
  const craft = rocket()
  craft.group.scale.setScalar(lunar ? 0.9 : 2.4)
  const halo = glow('rgba(255,255,255,1)', lunar ? 1.8 : 4.5, 0.5)
  const craftLabel = label('', 'craft')
  craftLabel.position.set(0, lunar ? 0.9 : 2.4, 0)
  const craftHolder = new THREE.Group()
  craftHolder.add(craft.group, halo, craftLabel)
  scene.add(craftHolder)

  // eventos não informativos como marcadores clicáveis
  const markers: { mesh: THREE.Mesh; event: MissionEvent; base: number }[] = []
  const markerGeo = new THREE.OctahedronGeometry(lunar ? 0.32 : 0.7)
  result.events.filter((e) => e.severity !== 'info' && e.kind !== 'fase').forEach((e) => {
    let i = s.t_day.findIndex((d) => d >= e.day); if (i < 0) i = n - 1
    const mesh = new THREE.Mesh(markerGeo, new THREE.MeshBasicMaterial({ color: SEV_HEX[e.severity], transparent: true, opacity: 0.95 }))
    mesh.position.copy(L.path[i]).add(new THREE.Vector3(0, lunar ? 0.6 : 1.6, 0))
    const stem = new THREE.Line(new THREE.BufferGeometry().setFromPoints([L.path[i], mesh.position.clone()]),
      new THREE.LineBasicMaterial({ color: SEV_HEX[e.severity], transparent: true, opacity: 0.45 }))
    scene.add(mesh, stem)
    markers.push({ mesh, event: e, base: mesh.position.y })
  })

  // ---------- estado e interação ----------
  let cursor = 0, selected: string | null = null, mode: CameraMode = 'system'
  const shown = L.path[0].clone(), target = L.path[0].clone()
  const tmp = new THREE.Vector3()

  function heading(i: number) {
    const a = L.path[Math.max(0, Math.min(i, n - 2))], b = L.path[Math.max(1, Math.min(i + 1, n - 1))]
    return b.clone().sub(a)
  }

  function applyCursor() {
    target.copy(L.path[cursor])
    past.geo.instanceCount = Math.max(0, cursor)
    earthMesh.position.copy(L.earth(cursor))
    if (destMesh && L.dest && !lunar) destMesh.position.copy(L.dest(cursor))
    ;(halo.material as THREE.SpriteMaterial).color.setHex(hexAt(cursor))
    const d = s.t_day[cursor]
    craftLabel.element.textContent = `Craft · day ${d.toFixed(d < 10 ? 1 : 0)}`
    craft.flame.visible = s.phase[cursor] === 'trânsito'
    craftLabel.visible = opts.craftLabel !== false && (!lunar || s.phase[cursor] === 'trânsito')   // na superfície, o local já tem rótulo
  }

  const tracking = (m: CameraMode) => m === 'follow' || m === 'cinematic'

  function poseFor(m: CameraMode): { pos: THREE.Vector3; target: THREE.Vector3 } {
    if (m === 'top') {
      const R = lunar ? 48 : Math.max(1.1, ...s.r_au) * AU * 2.3
      const t = lunar ? new THREE.Vector3(18, 0, -2) : new THREE.Vector3()
      return { pos: new THREE.Vector3(t.x, R, t.z + 0.01), target: t }
    }
    if (m === 'system') return { pos: home.pos.clone(), target: home.target.clone() }
    const site = lunar && s.phase[cursor] !== 'trânsito' ? L.sites.find((x) => x.name === s.habitat[cursor]) : null
    let off: THREE.Vector3
    if (site) off = site.normal.clone().multiplyScalar(m === 'cinematic' ? 15 : 7).add(new THREE.Vector3(m === 'cinematic' ? -6 : 0, m === 'cinematic' ? 4 : 2, m === 'cinematic' ? 7 : 4))
    else {
      const fwd = heading(cursor).normalize(), up = new THREE.Vector3(0, 1, 0)
      if (m === 'cinematic') {
        // três quartos: de lado e um pouco atrás, deixando a rota à frente visível
        const side = new THREE.Vector3().crossVectors(fwd, up).normalize()
        const k = lunar ? 0.6 : 1.7
        off = fwd.multiplyScalar(-6 * k).addScaledVector(side, 9 * k).addScaledVector(up, 4.5 * k)
      } else off = fwd.multiplyScalar(lunar ? -6 : -11).addScaledVector(up, lunar ? 3 : 5.5)
    }
    return { pos: shown.clone().add(off), target: shown.clone() }
  }

  let tween: { from: { pos: THREE.Vector3; target: THREE.Vector3 }; start: number; dur: number } | null = null
  const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

  function frameCamera(m: CameraMode, animate = false, dur = 1.8) {
    if (animate && !reduced) {
      tween = { from: { pos: camera.position.clone(), target: controls.target.clone() }, start: performance.now(), dur: dur * 1000 }
      return
    }
    tween = null
    const p = poseFor(m)
    camera.position.copy(p.pos); controls.target.copy(p.target)
    controls.update()
  }

  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2()
  let down: { x: number; y: number } | null = null
  function pick(ev: PointerEvent) {
    const rect = renderer.domElement.getBoundingClientRect()
    ndc.set(((ev.clientX - rect.left) / rect.width) * 2 - 1, -((ev.clientY - rect.top) / rect.height) * 2 + 1)
    ray.setFromCamera(ndc, camera)
    const hit = ray.intersectObjects(markers.map((m) => m.mesh))[0]
    if (hit) return { event: markers.find((m) => m.mesh === hit.object)!.event, index: -1 }
    // ponto da rota mais próximo na tela (até 14 px)
    let best = -1, bestD = 14 * 14
    for (let i = 0; i < n; i += 1) {
      tmp.copy(L.path[i]).project(camera)
      if (tmp.z > 1) continue
      const dx = (tmp.x * 0.5 + 0.5) * rect.width - (ev.clientX - rect.left), dy = (-tmp.y * 0.5 + 0.5) * rect.height - (ev.clientY - rect.top)
      const dd = dx * dx + dy * dy
      if (dd < bestD) { bestD = dd; best = i }
    }
    return best >= 0 ? { event: null, index: best } : null
  }
  const onDown = (ev: PointerEvent) => { down = { x: ev.clientX, y: ev.clientY } }
  const onUp = (ev: PointerEvent) => {
    if (!down || Math.hypot(ev.clientX - down.x, ev.clientY - down.y) > 5) { down = null; return }
    down = null
    const p = pick(ev)
    if (p?.event) cb.onPickEvent(p.event)
    else if (p && p.index >= 0) cb.onPickIndex(p.index)
  }
  const onMove = (ev: PointerEvent) => {
    if (ev.buttons) { cb.onHover(null); return }
    const p = pick(ev)
    const rect = renderer.domElement.getBoundingClientRect()
    renderer.domElement.style.cursor = p ? 'pointer' : 'grab'
    if (!p) { cb.onHover(null); return }
    const at = { x: ev.clientX - rect.left, y: ev.clientY - rect.top }
    if (p.event) cb.onHover({ ...at, text: `Day ${p.event.day.toFixed(1)} · ${p.event.title}` })
    else {
      const i = p.index
      cb.onHover({ ...at, text: `Day ${s.t_day[i].toFixed(1)} · ${lunar ? s.habitat[i] : `${s.r_au[i].toFixed(3)} AU`} · click to go` })
    }
  }
  const onLeave = () => cb.onHover(null)
  const dom = renderer.domElement
  dom.addEventListener('pointerdown', onDown)
  dom.addEventListener('pointerup', onUp)
  dom.addEventListener('pointermove', onMove)
  dom.addEventListener('pointerleave', onLeave)
  controls.addEventListener('start', () => { tween = null; if (!tracking(mode)) mode = 'system' })

  function resize() {
    const w = container.clientWidth, h = container.clientHeight
    if (!w || !h) return
    renderer.setSize(w, h, false); labels.setSize(w, h)
    camera.aspect = w / h
    // centro óptico deslocado para longe dos controles sobrepostos
    const vo = w > 700 ? opts.viewOffset ?? { x: 0, y: Math.min(40, h * 0.08) / h } : opts.mobileViewOffset
    if (vo) camera.setViewOffset(w, h, vo.x * w, vo.y * h, w, h)
    else camera.clearViewOffset()
    camera.updateProjectionMatrix()
    full.mat.resolution.set(w, h); past.mat.resolution.set(w, h)
  }
  const ro = new ResizeObserver(resize); ro.observe(container); resize()

  let visible = true
  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting }); io.observe(container)

  applyCursor(); shown.copy(target); frameCamera('system')
  const clock = new THREE.Clock()
  let raf = 0
  const loop = () => {
    raf = requestAnimationFrame(loop)
    const dt = Math.min(clock.getDelta(), 0.1)
    if (!visible) return
    const before = shown.clone()
    shown.lerp(target, reduced ? 1 : 1 - Math.exp(-dt * 9))
    craftHolder.position.copy(shown)
    const h = heading(cursor)
    if (h.lengthSq() > 1e-8 && s.phase[cursor] === 'trânsito') craft.group.lookAt(tmp.copy(shown).add(h))
    else if (lunar && L.sites.length) {
      const site = L.sites.find((x) => x.name === s.habitat[cursor]) ?? L.sites[0]
      craft.group.lookAt(tmp.copy(shown).add(site.normal))
    }
    if (!lunar) {
      sunLineGeo.attributes.position.setXYZ(1, shown.x, shown.y, shown.z); sunLineGeo.attributes.position.needsUpdate = true
      sunLine.computeLineDistances()
      sunLineLabel.position.copy(shown).multiplyScalar(0.5)
      sunLineLabel.element.textContent = `${s.r_au[cursor].toFixed(3)} AU`
    }
    if (tween) {
      const k = Math.min(1, (performance.now() - tween.start) / tween.dur), e = ease(k), end = poseFor(mode)
      camera.position.lerpVectors(tween.from.pos, end.pos, e); controls.target.lerpVectors(tween.from.target, end.target, e)
      if (k >= 1) tween = null
    } else if (tracking(mode)) {
      const delta = shown.clone().sub(before)
      camera.position.add(delta); controls.target.add(delta)
    }
    // marcadores com tamanho aparente estável: não crescem quando a câmera chega perto
    const markerScale = (m: { mesh: THREE.Mesh; event: MissionEvent }) =>
      (m.event.id === selected ? 1.8 : 1) * THREE.MathUtils.clamp(camera.position.distanceTo(m.mesh.position) / (lunar ? 30 : 60), 0.18, 1)
    if (reduced) markers.forEach((m) => m.mesh.scale.setScalar(markerScale(m)))
    if (!reduced) {
      const t = clock.elapsedTime
      spin.forEach((o) => { o.rotation.y += dt * 0.25 })
      craft.flame.scale.setScalar(0.6 + Math.sin(t * 22) * 0.08)
      markers.forEach((m, k) => {
        m.mesh.rotation.y = t * 1.2 + k
        m.mesh.position.y = m.base + Math.sin(t * 2 + k) * 0.12
        m.mesh.scale.setScalar(markerScale(m))
      })
    }
    controls.update()
    renderer.render(scene, camera)
    labels.render(scene, camera)
  }
  loop()

  return {
    setCursor(i) { cursor = Math.max(0, Math.min(n - 1, i)); applyCursor() },
    setSelected(id) { selected = id },
    setColorMode(m) {
      if (m === colorMode) return
      colorMode = m
      const c = routeColors()
      full.geo.setColors(c.dim); past.geo.setColors(c.colors)
      applyCursor()
    },
    setCameraMode(m, animate = false, seconds = 1.8) { mode = m; frameCamera(m, animate, seconds) },
    intro() {
      mode = 'system'
      const p = poseFor('system')
      camera.position.copy(p.target).addScaledVector(p.pos.clone().sub(p.target), 3.2).add(new THREE.Vector3(0, -p.pos.y * 0.6, 0))
      controls.target.copy(p.target); controls.update()
      frameCamera('system', true, 3.2)
    },
    dispose() {
      cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); controls.dispose()
      dom.removeEventListener('pointerdown', onDown); dom.removeEventListener('pointerup', onUp)
      dom.removeEventListener('pointermove', onMove); dom.removeEventListener('pointerleave', onLeave)
      scene.traverse((o) => {
        const m = o as THREE.Mesh
        m.geometry?.dispose()
        const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : []
        mats.forEach((mat) => { (mat as THREE.MeshStandardMaterial).map?.dispose(); mat.dispose() })
      })
      renderer.dispose(); renderer.domElement.remove(); labels.domElement.remove()
    },
  }
}
