// Modo leve automático: decide, antes de carregar o simulador 3D (lab3d), se a placa de vídeo dá conta dele.
// Sem WebGL2, sem textura de ponto flutuante ou com renderização por software (sem GPU de verdade), o palco
// mostra a chama ilustrada em vez do solver. A resposta é calculada uma vez por página.
//
// ?lab=on força o simulador e ?lab=off força a ilustração (útil para testar os dois caminhos).

const SOFTWARE = /swiftshader|llvmpipe|softpipe|basic render|software|microsoft basic/i

let cached: string | null | undefined

/** null = o simulador pode rodar; texto = por que o palco usa a ilustração. */
export function labBlocker(): string | null {
  if (cached !== undefined) return cached
  cached = probe()
  return cached
}

function probe(): string | null {
  try {
    const force = new URLSearchParams(location.search).get('lab')
    if (force === 'on') return null
    if (force === 'off') return 'Modo leve: o simulador 3D foi desligado pelo endereço (?lab=off).'
  } catch { /* sem location */ }

  const canvas = document.createElement('canvas')
  // failIfMajorPerformanceCaveat: o navegador recusa o contexto quando só teria renderização por software
  const gl = canvas.getContext('webgl2', { failIfMajorPerformanceCaveat: true, antialias: false, depth: false })
  if (!gl) {
    const any = document.createElement('canvas').getContext('webgl2')
    return any
      ? 'Modo leve: este aparelho não tem aceleração gráfica para o simulador 3D, então a chama é ilustrada.'
      : 'Modo leve: este navegador não oferece WebGL2, então a chama é ilustrada.'
  }
  try {
    if (!gl.getExtension('EXT_color_buffer_float')) return 'Modo leve: a placa de vídeo não calcula em ponto flutuante, então a chama é ilustrada.'
    const dbg = gl.getExtension('WEBGL_debug_renderer_info')
    const name = String(dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER))
    if (SOFTWARE.test(name)) return 'Modo leve: o navegador está desenhando sem placa de vídeo, então a chama é ilustrada.'
    return null
  } finally {
    gl.getExtension('WEBGL_lose_context')?.loseContext()
  }
}
