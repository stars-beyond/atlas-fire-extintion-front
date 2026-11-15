// Peças da cena desenhadas em código: céus, terreno, habitats e a bancada de ensaio.
// Unidades da cena: metros. Tudo aqui é ilustração do lugar; nada disto entra na conta da chama.
import * as THREE from 'three'
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js'

export const C = { hull: 0xe8e5de, hull2: 0xbfc5cc, dark: 0x1b2230, accent: 0xffd466, panel: 0x1d3f8a, gold: 0xb89443, regolith: 0x9a9a9c, mars: 0xa3542f }
export const std = (color: number, o: Partial<THREE.MeshStandardMaterialParameters> = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0.05, ...o })
// casca translúcida: deixa ver o interior de qualquer ângulo
export const glass = (color: number, opacity = 0.3) => new THREE.MeshPhysicalMaterial({ color, roughness: 0.35, metalness: 0.1, transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false })
export function mesh(geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; return m
}
export function label(text: string, cls = 'habl') {
  const el = document.createElement('div'); el.className = 'lbl ' + cls; el.textContent = text
  return new CSS2DObject(el)
}
// sorteio reprodutível: a mesma cena em toda abertura
export function rng(seed: number) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296) }

export function glowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128
  const g = c.getContext('2d')!, gr = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128)
  return new THREE.CanvasTexture(c)
}

// ---------------------------------------------------------------- céus
function earthTexture() {
  const c = document.createElement('canvas'); c.width = 2048; c.height = 1024
  const g = c.getContext('2d')!, r = rng(7)
  const sea = g.createLinearGradient(0, 0, 0, 1024)
  sea.addColorStop(0, '#16407f'); sea.addColorStop(0.5, '#1d5aa8'); sea.addColorStop(1, '#16407f')
  g.fillStyle = sea; g.fillRect(0, 0, 2048, 1024)
  g.filter = 'blur(10px)'
  for (let i = 0; i < 22; i++) {   // continentes: manchas juntas formam massas de terra
    const cx = r() * 2048, cy = 200 + r() * 620
    for (let k = 0; k < 9; k++) {
      g.fillStyle = r() > 0.45 ? '#3d7443' : '#8b7a4c'; g.globalAlpha = 0.9
      g.beginPath(); g.ellipse(cx + (r() - 0.5) * 220, cy + (r() - 0.5) * 130, 30 + r() * 90, 18 + r() * 50, r() * 3, 0, 7); g.fill()
    }
  }
  g.filter = 'blur(7px)'; g.fillStyle = '#ffffff'
  for (let i = 0; i < 520; i++) {  // nuvens em faixas
    g.globalAlpha = 0.1 + r() * 0.3
    g.beginPath(); g.ellipse(r() * 2048, r() * 1024, 30 + r() * 150, 5 + r() * 22, (r() - 0.5) * 0.7, 0, 7); g.fill()
  }
  g.filter = 'blur(14px)'; g.globalAlpha = 0.95; g.fillRect(0, -10, 2048, 70); g.fillRect(0, 964, 2048, 70)   // calotas
  g.filter = 'none'; g.globalAlpha = 1
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t
}
let earthMap: THREE.Texture | null = null
export function earth(radius: number) {
  const grp = new THREE.Group()
  grp.add(new THREE.Mesh(new THREE.SphereGeometry(radius, 96, 64), new THREE.MeshStandardMaterial({ map: (earthMap ??= earthTexture()), roughness: 0.9, metalness: 0 })))
  grp.add(new THREE.Mesh(new THREE.SphereGeometry(radius * 1.025, 96, 64), new THREE.ShaderMaterial({   // atmosfera: brilho na borda
    transparent: true, depthWrite: false, side: THREE.BackSide, blending: THREE.AdditiveBlending,
    vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'varying vec3 vN; varying vec3 vV; void main(){ float f = pow(1.0 - abs(dot(vN, vV)), 2.2); gl_FragColor = vec4(0.35, 0.62, 1.0, 1.0) * f * 0.9; }',
  })))
  return grp
}
export function stars() {
  const r = rng(11), n = 1800, p = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    const u = r() * 2 - 1, a = r() * Math.PI * 2, s = Math.sqrt(1 - u * u)
    p.set([Math.cos(a) * s * 900, u * 900, Math.sin(a) * s * 900], i * 3)
  }
  const g = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(p, 3))
  return new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0.85, fog: false }))
}
export function marsSky() {
  return new THREE.Mesh(new THREE.SphereGeometry(850, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: 'varying float vY; void main(){ vY = normalize(position).y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'varying float vY; void main(){ vec3 lo = vec3(0.82,0.62,0.44), hi = vec3(0.50,0.36,0.27); float t = smoothstep(-0.05, 0.55, vY); gl_FragColor = vec4(mix(lo, hi, t), 1.0); }',
  }))
}

// ---------------------------------------------------------------- terreno
// O modelo de terreno vem sem textura: aqui ele ganha a cor do solo e um relevo fino (grão do regolito),
// gerado em código e repetido pela superfície, para não parecer plástico liso de perto.
function grainTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256
  const g = c.getContext('2d')!, r = rng(23), img = g.createImageData(256, 256)
  for (let i = 0; i < 256 * 256; i++) { const v = 120 + r() * 100; img.data.set([v, v, v, 255], i * 4) }
  g.putImageData(img, 0, 0)
  g.filter = 'blur(1.2px)'; g.drawImage(c, 0, 0); g.filter = 'none'
  for (let i = 0; i < 90; i++) {   // pedrinhas e pequenas covas
    const x = r() * 256, y = r() * 256, s = 1 + r() * 4
    g.fillStyle = r() > 0.5 ? 'rgba(255,255,255,.5)' : 'rgba(0,0,0,.45)'; g.beginPath(); g.arc(x, y, s, 0, 7); g.fill()
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return t
}
let grain: THREE.Texture | null = null
export interface Ground { group: THREE.Group; height: (x: number, z: number) => number }
export function ground(src: THREE.Object3D | null | undefined, color: number): Ground {
  const group = new THREE.Group()
  const mat = std(color, { roughness: 1, metalness: 0, bumpMap: (grain ??= grainTexture()), bumpScale: 1.4 })
  if (!src) {
    const plane = mesh(new THREE.PlaneGeometry(260, 260, 1, 1), mat); plane.rotation.x = -Math.PI / 2; plane.castShadow = false; group.add(plane)
    return { group, height: () => 0 }
  }
  const t = src.clone(true)
  t.traverse((o) => {
    const m = o as THREE.Mesh; if (!m.isMesh) return
    const geo = m.geometry.clone(), p = geo.getAttribute('position'), uv = new Float32Array(p.count * 2)
    for (let i = 0; i < p.count; i++) { uv[i * 2] = p.getX(i) / 6; uv[i * 2 + 1] = p.getZ(i) / 6 }   // o grão se repete a cada 6 m
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
    m.geometry = geo; m.material = mat; m.receiveShadow = true; m.castShadow = true
  })
  group.add(t)
  // altura do terreno em (x, z), a partir dos vértices (o terreno é uma superfície de uma só camada)
  const N = 128, grid = new Float32Array(N * N).fill(-1e9)
  const box = new THREE.Box3().setFromObject(t), size = box.getSize(new THREE.Vector3()), v = new THREE.Vector3()
  const ix = (x: number) => Math.min(N - 1, Math.max(0, Math.floor(((x - box.min.x) / size.x) * N)))
  const iz = (z: number) => Math.min(N - 1, Math.max(0, Math.floor(((z - box.min.z) / size.z) * N)))
  t.updateWorldMatrix(true, true)
  t.traverse((o) => {
    const m = o as THREE.Mesh; if (!m.isMesh) return
    const p = m.geometry.getAttribute('position')
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(m.matrixWorld)
      const k = iz(v.z) * N + ix(v.x); if (v.y > grid[k]) grid[k] = v.y
    }
  })
  return { group, height: (x, z) => { const h = grid[iz(z) * N + ix(x)]; return h > -1e8 ? h : box.min.y } }
}
// ponto mais plano perto de (cx, cz), para assentar um habitat de raio r
export function flatSpot(h: Ground['height'], cx: number, cz: number, reach: number, r: number) {
  let best = { x: cx, z: cz, s: 1e9 }
  for (let x = cx - reach; x <= cx + reach; x += reach / 6) for (let z = cz - reach; z <= cz + reach; z += reach / 6) {
    let lo = 1e9, hi = -1e9
    for (let a = 0; a < 8; a++) { const y = h(x + Math.cos(a * 0.785) * r, z + Math.sin(a * 0.785) * r); lo = Math.min(lo, y); hi = Math.max(hi, y) }
    const s = hi - lo + Math.hypot(x - cx, z - cz) * 0.02
    if (s < best.s) best = { x, z, s }
  }
  return best
}

// ---------------------------------------------------------------- habitats
// Cada habitat devolve o corpo e a altura da superfície onde a bancada de ensaio fica apoiada (bench).
export interface Body { group: THREE.Group; bench: THREE.Vector3 }

function solarArray(w: number, h: number) {
  const g = new THREE.Group()
  g.add(mesh(new THREE.BoxGeometry(w, 0.06, h), std(C.panel, { roughness: 0.35, metalness: 0.6, emissive: 0x0a1c4a, emissiveIntensity: 0.35 })))
  g.add(mesh(new THREE.BoxGeometry(w + 0.12, 0.04, 0.08), std(C.hull2)))
  return g
}
export function panelsField() {
  const g = new THREE.Group()
  for (let i = 0; i < 4; i++) { const p = solarArray(5, 2.4); p.position.set(i * 5.6, 1.5, 0); p.rotation.x = -0.6; g.add(p); g.add(mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.5, 6), std(C.hull2), i * 5.6, 0.75, 0.2)) }
  return g
}

// Base de superfície: cúpula pressurizada translúcida sobre uma berma do solo local, eclusa, módulo de serviço e antena.
// Por dentro: a bancada no centro (onde o ensaio acontece), armários e uma estufa encostados no fundo.
export function domeBase(r: number, soil: number): Body {
  const g = new THREE.Group()
  const skin = mesh(new THREE.SphereGeometry(r, 64, 24, 0, Math.PI * 2, 0, Math.PI / 2), glass(C.hull, 0.2)); skin.castShadow = false; g.add(skin)
  for (let i = 0; i < 10; i++) { const rib = mesh(new THREE.TorusGeometry(r * 1.003, 0.07, 6, 28, Math.PI / 2), std(C.hull2)); rib.rotation.y = (i / 10) * Math.PI * 2; g.add(rib) }
  for (const f of [0.45, 0.8]) {   // cintas horizontais
    const hoop = mesh(new THREE.TorusGeometry(r * Math.cos(Math.asin(f)) * 1.003, 0.06, 6, 64), std(C.hull2), 0, r * f, 0); hoop.rotation.x = Math.PI / 2; g.add(hoop)
  }
  g.add(mesh(new THREE.CylinderGeometry(r * 1.1, r * 1.32, 2.4, 48), std(soil, { roughness: 1 }), 0, -1.1, 0))
  const floor = mesh(new THREE.CircleGeometry(r * 0.985, 48), std(0x3a424e, { roughness: 0.6 }), 0, 0.12, 0); floor.rotation.x = -Math.PI / 2; g.add(floor)
  const ring = mesh(new THREE.TorusGeometry(r, 0.14, 8, 64), std(C.accent, { emissive: C.accent, emissiveIntensity: 0.5 }), 0, 0.2, 0); ring.rotation.x = Math.PI / 2; g.add(ring)
  // eclusa e módulo de serviço, do lado oposto ao da câmera
  const lock = mesh(new THREE.CylinderGeometry(1.4, 1.4, 5, 24), std(C.hull), -r - 1.6, 1.6, 0); lock.rotation.z = Math.PI / 2; g.add(lock)
  const svc = mesh(new THREE.CapsuleGeometry(2.1, 7, 8, 24), std(C.hull, { roughness: 0.6 }), -r - 6, 2.1, 0); svc.rotation.x = Math.PI / 2; g.add(svc)
  for (const z of [-3, 0, 3]) g.add(mesh(new THREE.TorusGeometry(2.12, 0.07, 6, 32), std(C.accent), -r - 6, 2.1, z))
  g.add(mesh(new THREE.CylinderGeometry(0.06, 0.06, 8, 8), std(C.hull2), -r - 6, 6.5, -4))
  g.add(mesh(new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), std(C.hull2, { side: THREE.DoubleSide }), -r - 6, 10.4, -4).rotateX(Math.PI * 0.8))
  // interior: bancada central
  g.add(mesh(new THREE.BoxGeometry(3.4, 0.9, 1.6), std(0x2c343f, { roughness: 0.5, metalness: 0.3 }), 0, 0.57, 0))
  g.add(mesh(new THREE.BoxGeometry(3.5, 0.05, 1.7), std(0x59636f, { roughness: 0.4, metalness: 0.5 }), 0, 1.045, 0))
  // armários e estufa no arco de trás
  const R = r * 0.8
  for (let i = 0; i < 7; i++) {
    const a = Math.PI * (1.08 + (i / 6) * 0.84), x = Math.cos(a) * R, z = Math.sin(a) * R
    const grow = i === 2 || i === 3
    const rack = mesh(new THREE.BoxGeometry(1.9, grow ? 1.9 : 2.5, 0.8), std(grow ? 0x2a3138 : C.hull2, { roughness: 0.6 }), x, (grow ? 0.95 : 1.25) + 0.12, z); rack.lookAt(0, rack.position.y, 0); g.add(rack)
    if (grow) for (const y of [0.7, 1.3, 1.9]) { const s = mesh(new THREE.BoxGeometry(1.7, 0.1, 0.1), std(0x6fe08a, { emissive: 0x3ddc77, emissiveIntensity: 1.1 }), x * 0.955, y, z * 0.955); s.lookAt(0, y, 0); s.castShadow = false; g.add(s) }
  }
  for (const [x, z] of [[4.6, 1.2], [5.3, -0.4]]) g.add(mesh(new THREE.BoxGeometry(0.9, 0.7, 0.9), std(C.gold, { roughness: 0.6 }), x, 0.47, z))
  const lamp = new THREE.PointLight(0xffe2b8, 40, 40, 1.6); lamp.position.set(0, r * 0.7, 0); g.add(lamp)
  return { group: g, bench: new THREE.Vector3(0, 1.07, 0) }
}

export function roverBody(): Body {
  const g = new THREE.Group()
  const cabin = mesh(new THREE.CapsuleGeometry(1.5, 3.4, 8, 24), glass(C.hull, 0.26), 0, 2.5, 0)
  cabin.rotation.z = Math.PI / 2; cabin.castShadow = false; g.add(cabin)
  for (const x of [-2.3, 2.3]) g.add(mesh(new THREE.TorusGeometry(1.5, 0.09, 8, 40), std(C.accent), x, 2.5, 0).rotateY(Math.PI / 2))   // aros da cabine
  g.add(mesh(new THREE.BoxGeometry(6.6, 0.7, 2.7), std(C.gold, { metalness: 0.6, roughness: 0.4 }), 0, 1.15, 0))
  const nose = mesh(new THREE.SphereGeometry(1.25, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), glass(0x7fb4ff, 0.34), 3.25, 2.5, 0).rotateZ(-Math.PI / 2); nose.castShadow = false; g.add(nose)
  for (const x of [-2.4, 0, 2.4]) for (const z of [-1.7, 1.7]) {
    const w = mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.55, 20), std(0x2a2f38, { roughness: 0.9 }), x, 0.8, z); w.rotation.x = Math.PI / 2; g.add(w)
    g.add(mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.6, 12), std(C.hull2), x, 0.8, z).rotateX(Math.PI / 2))
  }
  // interior: piso, console (onde o ensaio acontece) e dois bancos
  g.add(mesh(new THREE.BoxGeometry(5.2, 0.08, 2.1), std(0x3a424e), 0, 1.55, 0))
  g.add(mesh(new THREE.BoxGeometry(1.5, 0.5, 0.9), std(0x2c343f, { roughness: 0.5, metalness: 0.3 }), 0.2, 1.84, 0))
  for (const z of [-0.55, 0.55]) { g.add(mesh(new THREE.BoxGeometry(0.6, 0.5, 0.55), std(0x55606e), 2.2, 1.84, z)); g.add(mesh(new THREE.BoxGeometry(0.12, 0.8, 0.55), std(0x55606e), 1.9, 2.4, z)) }
  const arr = solarArray(3.2, 1.8); arr.position.set(-1.2, 4.35, 0); g.add(arr)
  g.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.2, 6), std(C.hull2), 1.6, 5, 0.6))
  const lamp = new THREE.PointLight(0xffe2b8, 10, 14, 1.8); lamp.position.set(-0.6, 3.4, 0); g.add(lamp)
  return { group: g, bench: new THREE.Vector3(0.2, 2.1, 0) }
}

export function stationBody(): Body {
  const g = new THREE.Group()
  const hull = mesh(new THREE.CylinderGeometry(2.3, 2.3, 10, 40, 1, true), glass(C.hull, 0.24)); hull.rotation.z = Math.PI / 2; hull.castShadow = false; g.add(hull)
  for (const x of [-5, 5]) {
    const cap = mesh(new THREE.CylinderGeometry(1.1, 2.3, 1.4, 32), std(C.hull, { roughness: 0.6, metalness: 0.2 }), x + Math.sign(x) * 0.7, 0, 0); cap.rotation.z = -Math.sign(x) * Math.PI / 2; g.add(cap)
    g.add(mesh(new THREE.TorusGeometry(2.32, 0.1, 8, 40), std(C.accent, { emissive: C.accent, emissiveIntensity: 0.4 }), x, 0, 0).rotateY(Math.PI / 2))
  }
  for (const x of [-2.5, 0, 2.5]) g.add(mesh(new THREE.TorusGeometry(2.31, 0.05, 6, 40), std(C.hull2), x, 0, 0).rotateY(Math.PI / 2))
  g.add(mesh(new THREE.BoxGeometry(9.6, 0.12, 3.4), std(0x4a5360), 0, -1.25, 0))   // piso de equipamentos
  g.add(mesh(new THREE.BoxGeometry(2.4, 0.6, 1.2), std(0x2c343f, { roughness: 0.5, metalness: 0.3 }), 0, -0.9, 0))
  for (const x of [-3.4, 3.4]) g.add(mesh(new THREE.BoxGeometry(1.4, 2.2, 0.7), std(C.hull2), x, -0.1, -1.5))   // racks no fundo
  // treliça e painéis, na ponta de trás, para não tapar o módulo
  g.add(mesh(new THREE.BoxGeometry(0.5, 0.5, 30), std(C.hull2, { metalness: 0.5 }), 7.6, 0, 0))
  for (const z of [-11.5, -5.5, 5.5, 11.5]) for (const y of [4.8, -4.8]) { const p = solarArray(2.6, 4.6); p.rotation.z = Math.PI / 2; p.rotation.x = 0.3; p.position.set(7.6, y, z); g.add(p) }
  g.add(mesh(new THREE.BoxGeometry(0.1, 3.2, 5), std(0xf4f4f0), 7.6, 0, 0))
  const lamp = new THREE.PointLight(0xdfeaff, 24, 24, 1.6); lamp.position.set(0, 1.4, 0.5); g.add(lamp)
  return { group: g, bench: new THREE.Vector3(0, -0.6, 0) }
}

export function roomBody(): Body {
  const g = new THREE.Group()
  const room = mesh(new THREE.BoxGeometry(20, 7, 14), std(0x39424f, { side: THREE.BackSide, roughness: 0.9 }), 0, 3.5, 0); room.castShadow = false; g.add(room)
  const grid = new THREE.GridHelper(20, 20, 0x5b6777, 0x2c3542); grid.position.y = 0.02; g.add(grid)
  for (let i = 0; i < 6; i++) {   // armários de baterias ou servidores
    const x = -8 + i * 3.2; g.add(mesh(new THREE.BoxGeometry(2.2, 4.4, 1.6), std(0x232b36, { roughness: 0.5, metalness: 0.3 }), x, 2.2, -5.4))
    for (let k = 0; k < 6; k++) g.add(mesh(new THREE.BoxGeometry(1.6, 0.08, 0.04), std(0x3ddc97, { emissive: 0x3ddc97, emissiveIntensity: 1.2 }), x, 0.8 + k * 0.6, -4.58))
  }
  g.add(mesh(new THREE.BoxGeometry(3, 0.12, 1.5), std(0x6a7482), 0, 0.96, 0))
  for (const [x, z] of [[-1.35, -0.6], [1.35, -0.6], [-1.35, 0.6], [1.35, 0.6]]) g.add(mesh(new THREE.BoxGeometry(0.12, 0.9, 0.12), std(0x4a5360), x, 0.45, z))
  const lamp = new THREE.PointLight(0xfff1dd, 120, 40, 1.4); lamp.position.set(0, 6.2, 2); g.add(lamp)
  return { group: g, bench: new THREE.Vector3(0, 1.02, 0) }
}

// ---------------------------------------------------------------- bancada de ensaio
// O volume que o simulador calcula (um duto de 12 × 6 × 6 cm, aqui ampliado) apoiado numa superfície do habitat:
// base, ventilador que sopra o ar, as arestas do volume e a amostra. A chama é pintada dentro dele.
export const RIG = { W: 1.8, H: 0.9, D: 0.9 }
export function rig() {
  const { W, H, D } = RIG, g = new THREE.Group()
  const metal = std(0x1a2029, { roughness: 0.45, metalness: 0.6 })
  const plate = mesh(new THREE.BoxGeometry(W * 1.2, 0.06, D * 1.15), metal, -0.08, -H / 2 - 0.03, 0); g.add(plate)
  const fan = mesh(new THREE.BoxGeometry(0.16, H * 0.86, D * 0.86), std(0x39434f, { roughness: 0.5, metalness: 0.4 }), -W / 2 - 0.1, -0.03, 0); g.add(fan)
  const grille = mesh(new THREE.PlaneGeometry(D * 0.74, H * 0.74), std(0x0c1016, { roughness: 0.9 }), -W / 2 - 0.015, -0.03, 0); grille.rotation.y = Math.PI / 2; grille.castShadow = false; g.add(grille)
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(W, H, D)), new THREE.LineBasicMaterial({ color: C.accent, transparent: true, opacity: 0.4 })); g.add(edges)
  // amostra da chama desenhada (com o simulador, é ele quem pinta a amostra)
  const sample = new THREE.Group()
  sample.add(new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 12), new THREE.MeshStandardMaterial({ color: 0xcfd8dc, roughness: 0.4 })))
  sample.add(mesh(new THREE.CylinderGeometry(0.012, 0.012, H / 2, 6), metal, 0, -H / 4, 0))
  g.add(sample)
  return { group: g, sample }
}
