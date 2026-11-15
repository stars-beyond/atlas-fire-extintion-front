// Modelos 3D da cena (public/models/manifest.json): carregados uma vez por página.
// Cada vaga com 'file' usa o GLB indicado; vaga vazia usa a peça desenhada em código (parts.ts).
import * as THREE from 'three'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

export type Slot = 'terrain_moon' | 'terrain_mars' | 'suit' | 'station' | 'habitat' | 'rover'
type Manifest = Partial<Record<Slot, { file: string; credit?: string } | null>>
export interface Assets { model: Partial<Record<Slot, THREE.Object3D | null>>; credit: Partial<Record<Slot, string>> }

const SLOTS: Slot[] = ['terrain_moon', 'terrain_mars', 'suit', 'station', 'habitat', 'rover']
let gltf: GLTFLoader | null = null
function loader() {
  if (!gltf) {
    const draco = new DRACOLoader(); draco.setDecoderPath('/draco/')
    gltf = new GLTFLoader(); gltf.setDRACOLoader(draco)
  }
  return gltf
}
// Materiais de modelos exportados: fica só cor, rugosidade e metal. Alguns arquivos vêm com transmissão total
// (vidro) em todas as peças, o que sem um mapa de ambiente aparece como uma silhueta preta.
function sanitize(obj: THREE.Object3D) {
  obj.traverse((o) => {
    const m = o as THREE.Mesh; if (!m.isMesh) return
    const fix = (mat: THREE.Material) => {
      const src = mat as THREE.MeshStandardMaterial
      return new THREE.MeshStandardMaterial({ color: src.color ?? new THREE.Color(0xcccccc), map: src.map ?? null, roughness: Math.max(0.55, src.roughness ?? 0.8), metalness: Math.min(0.3, src.metalness ?? 0), side: THREE.DoubleSide })
    }
    m.material = Array.isArray(m.material) ? m.material.map(fix) : fix(m.material)
  })
  return obj
}

let cache: Promise<Assets> | null = null
export function loadAssets(): Promise<Assets> {
  return (cache ??= (async () => {
    const mf: Manifest = await fetch('/models/manifest.json').then((r) => (r.ok ? r.json() : {})).catch(() => ({}))
    const out: Assets = { model: {}, credit: {} }
    await Promise.all(SLOTS.map(async (s) => {
      const e = mf[s]
      if (!e?.file) return
      out.model[s] = await loader().loadAsync('/models/' + e.file).then((g) => sanitize(g.scene as THREE.Object3D)).catch(() => null)
      if (out.model[s] && e.credit) out.credit[s] = e.credit
    }))
    return out
  })())
}

// encaixa um modelo numa altura (ou no maior lado) e apoia a base em y = 0, centrado em x e z
export function fit(obj: THREE.Object3D, size: number, by: 'height' | 'max' = 'max') {
  const g = new THREE.Group(); g.add(obj)
  const b = new THREE.Box3().setFromObject(obj), s = b.getSize(new THREE.Vector3())
  obj.scale.multiplyScalar(size / (by === 'height' ? s.y : Math.max(s.x, s.y, s.z) || 1))
  const b2 = new THREE.Box3().setFromObject(obj), c = b2.getCenter(new THREE.Vector3())
  obj.position.sub(new THREE.Vector3(c.x, b2.min.y, c.z))
  obj.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true } })
  return g
}
