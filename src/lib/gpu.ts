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
    if (force === 'off') return 'Light mode: the 3D simulator was turned off by the URL (?lab=off).'
  } catch { /* sem location */ }

  const canvas = document.createElement('canvas')
  // failIfMajorPerformanceCaveat: o navegador recusa o contexto quando só teria renderização por software
  const gl = canvas.getContext('webgl2', { failIfMajorPerformanceCaveat: true, antialias: false, depth: false })
  if (!gl) {
    const any = document.createElement('canvas').getContext('webgl2')
    return any
      ? 'Light mode: this device has no graphics acceleration for the 3D simulator, so the flame is illustrated.'
      : 'Light mode: this browser does not support WebGL2, so the flame is illustrated.'
  }
  try {
    if (!gl.getExtension('EXT_color_buffer_float')) return 'Light mode: the graphics card cannot compute in floating point, so the flame is illustrated.'
    const dbg = gl.getExtension('WEBGL_debug_renderer_info')
    const name = String(dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER))
    if (SOFTWARE.test(name)) return 'Light mode: the browser is rendering without a graphics card, so the flame is illustrated.'
    return null
  } finally {
    gl.getExtension('WEBGL_lose_context')?.loseContext()
  }
}
