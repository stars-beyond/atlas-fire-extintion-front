// linkCitations: as citações [n] viram links internos (#cite-n), menos dentro de fórmulas e de código.
import { describe, expect, it } from 'vitest'
import { linkCitations } from './Markdown'

describe('linkCitations', () => {
  it('troca [n] por um link interno', () => {
    expect(linkCitations('A chama apaga [1].')).toBe('A chama apaga [1](#cite-1).')
    expect(linkCitations('[1] e [23]')).toBe('[1](#cite-1) e [23](#cite-23)')
    expect(linkCitations('duas juntas [1][2]')).toBe('duas juntas [1](#cite-1)[2](#cite-2)')
  })
  it('não mexe em texto sem citação', () => {
    for (const t of ['', 'Sem citação nenhuma.', 'lista [a] e [x1]', 'vazio []', 'intervalo [1, 2]', 'decimal [1.5]', '[ 1 ]'])
      expect(linkCitations(t)).toBe(t)
  })
  it('faixas como [6–8] viram [6][7][8], com travessão ou hífen', () => {
    expect(linkCitations('ver [6–8]')).toBe('ver [6](#cite-6)[7](#cite-7)[8](#cite-8)')
    expect(linkCitations('ver [6-8]')).toBe('ver [6](#cite-6)[7](#cite-7)[8](#cite-8)')
    expect(linkCitations('ver [1 – 2]')).toBe('ver [1](#cite-1)[2](#cite-2)')
    expect(linkCitations('ver [3–3]')).toBe('ver [3](#cite-3)')
  })
  it('faixa invertida não é citação: o texto fica como veio', () => {
    expect(linkCitations('ver [8–6]')).toBe('ver [8–6]')
    expect(linkCitations('a conta [3-1] dá 2')).toBe('a conta [3-1] dá 2')
  })
  it('faixa grande demais para ser de citações fica como veio (não trava a página)', () => {
    expect(linkCitations('entre [1900–2020]')).toBe('entre [1900–2020]')
    expect(linkCitations('[1–4000000000]')).toBe('[1–4000000000]')
    expect(linkCitations('[1-99999999999999999999]')).toBe('[1-99999999999999999999]')
    expect(linkCitations('[1–20]').match(/#cite-/g)).toHaveLength(20)
  })
  it('não troca dentro de código em linha', () => {
    expect(linkCitations('use `a[1]` como em [2]')).toBe('use `a[1]` como em [2](#cite-2)')
    expect(linkCitations('`[1]` `[2]` [3]')).toBe('`[1]` `[2]` [3](#cite-3)')
  })
  it('não troca dentro de bloco de código', () => {
    const md = 'Antes [1].\n```python\nx = a[0] + b[1]\ny = c[2-3]\n```\nDepois [2].'
    expect(linkCitations(md)).toBe('Antes [1](#cite-1).\n```python\nx = a[0] + b[1]\ny = c[2-3]\n```\nDepois [2](#cite-2).')
  })
  it('não troca dentro de fórmula em linha', () => {
    expect(linkCitations('a taxa $K[1] = d^2/t$ medida em [3]')).toBe('a taxa $K[1] = d^2/t$ medida em [3](#cite-3)')
    expect(linkCitations('$x_{[1]}$ e $y_{[2]}$ [4]')).toBe('$x_{[1]}$ e $y_{[2]}$ [4](#cite-4)')
    expect(linkCitations('com cifrão escapado $a\\$[1]$ [2]')).toBe('com cifrão escapado $a\\$[1]$ [2](#cite-2)')
  })
  it('não troca dentro de fórmula em bloco', () => {
    const md = 'Segundo [1]:\n$$\nA[1] + B[2-3] = C\n$$\ncomo em [2].'
    expect(linkCitations(md)).toBe('Segundo [1](#cite-1):\n$$\nA[1] + B[2-3] = C\n$$\ncomo em [2](#cite-2).')
  })
  it('uma fórmula em linha não atravessa a quebra de linha', () => {
    expect(linkCitations('custa $5 [1]\ne depois $6 [2]')).toBe('custa $5 [1](#cite-1)\ne depois $6 [2](#cite-2)')
  })
  it('crase ou cifrão sem par não escondem as citações', () => {
    expect(linkCitations('uma crase ` solta [1]')).toBe('uma crase ` solta [1](#cite-1)')
    expect(linkCitations('custa $5 [1]')).toBe('custa $5 [1](#cite-1)')
  })
  it('junta de volta o texto inteiro, na ordem', () => {
    const md = '[1] `c[1]` [2] $m[1]$ [3] $$d[1]$$ [4]\n```\nf[1]\n```\n[5–6]'
    expect(linkCitations(md)).toBe('[1](#cite-1) `c[1]` [2](#cite-2) $m[1]$ [3](#cite-3) $$d[1]$$ [4](#cite-4)\n```\nf[1]\n```\n[5](#cite-5)[6](#cite-6)')
  })
})
