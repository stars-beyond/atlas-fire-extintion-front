// Liberação do que uma cena criou na placa de vídeo, na hora de desmontar a vista.
// O three.js não libera nada sozinho: geometria, material e textura ficam na GPU até alguém chamar dispose().
// `keep` são os objetos que NÃO pertencem à cena: caches de módulo reaproveitados pela próxima cena (os modelos
// carregados em assets.ts, com seus materiais e texturas, e as texturas geradas uma vez em parts.ts).
import * as THREE from 'three'

type Keep = ReadonlySet<object>
const NONE: Keep = new Set<object>()

// texturas de um material: os mapas (map, bumpMap, ...) e as que estiverem nos uniforms de um ShaderMaterial
export function texturesOf(m: THREE.Material): THREE.Texture[] {
  const out: THREE.Texture[] = []
  for (const v of Object.values(m)) if (v && (v as THREE.Texture).isTexture) out.push(v as THREE.Texture)
  const u = (m as THREE.ShaderMaterial).uniforms
  if (u) for (const k of Object.keys(u)) { const v = u[k]?.value; if (v && (v as THREE.Texture).isTexture) out.push(v as THREE.Texture) }
  return out
}

function disposeMaterial(m: THREE.Material, keep: Keep = NONE) {
  if (keep.has(m)) return
  for (const t of texturesOf(m)) if (!keep.has(t)) t.dispose()
  m.dispose()
}

// Geometrias, materiais, texturas e mapas de sombra de tudo o que está pendurado em `root`.
// Chamar dispose() mais de uma vez no mesmo objeto (um material usado por várias malhas) não tem efeito.
export function disposeObject(root: THREE.Object3D, keep: Keep = NONE) {
  root.traverse((o) => {
    const m = o as THREE.Mesh
    if (m.geometry) m.geometry.dispose()
    const mat = m.material as THREE.Material | THREE.Material[] | undefined
    if (Array.isArray(mat)) mat.forEach((x) => disposeMaterial(x, keep)); else if (mat) disposeMaterial(mat, keep)
    const shadow = (o as { shadow?: { dispose?: () => void } }).shadow
    shadow?.dispose?.()
  })
}
