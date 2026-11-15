// Grafo de relações: o cenário no centro, os testes mais parecidos ao redor e, por fora,
// o que cada teste tem em comum com os outros (investigação, material, gravidade, desfecho).
// Tocar numa bola abre o foco: ela vai para o centro, cresce, mostra o que é, e só ficam ao redor
// as bolas ligadas a ela. Tocar numa vizinha passa o foco para ela; tocar no fundo volta ao grafo inteiro.
// A ideia e a estrutura de nós e arestas vêm do agente da equipe (agent-fire-space).
import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../../api'
import { useAtlas } from '../../state'
import type { GEdge, GNode } from '../../types'

const COLOR: Record<string, string> = {
  cenario: 'var(--act)', investigacao: 'var(--dim)', material: 'var(--solido)', gravidade: 'var(--g0)', desfecho: 'var(--medido)',
}
const FAMILY: Record<string, string> = { solido: 'var(--solido)', gota: 'var(--gota)', gas: 'var(--gas)' }
const TYPE_NAME: Record<string, string> = { investigacao: 'Investigação', material: 'Material', gravidade: 'Gravidade', desfecho: 'Desfecho' }

interface Placed extends GNode { x: number; y: number; r: number; angle: number }

function layout(nodes: GNode[], edges: GEdge[], w: number, h: number): Placed[] {
  const cx = w / 2, cy = h / 2 + 14, S = Math.min(w, h)
  // o anel de fora deixa espaço para os rótulos dos dois lados e para a barra do topo
  const r1 = S * 0.22, r2x = Math.max(60, Math.min(w / 2 - 100, S * 0.62)), r2y = Math.max(50, h / 2 - 110)
  const tests = nodes.filter((n) => n.type === 'teste')
  const out = new Map<string, Placed>()
  const c = nodes.find((n) => n.type === 'cenario')
  if (c) out.set(c.id, { ...c, x: cx, y: cy, r: 13, angle: 0 })
  tests.forEach((t, i) => {
    const a = -Math.PI / 2 + (i / Math.max(1, tests.length)) * Math.PI * 2
    out.set(t.id, { ...t, x: cx + Math.cos(a) * r1, y: cy + Math.sin(a) * r1, r: 8, angle: a })
  })
  // cada atributo fica no ângulo médio dos testes ligados a ele
  const attrs = nodes.filter((n) => n.type !== 'teste' && n.type !== 'cenario').map((n) => {
    const linked = edges.filter((e) => e.target === n.id).map((e) => out.get(e.source)).filter(Boolean) as Placed[]
    const sx = linked.reduce((s, p) => s + Math.cos(p.angle), 0), sy = linked.reduce((s, p) => s + Math.sin(p.angle), 0)
    return { n, angle: Math.atan2(sy, sx) }
  }).sort((a, b) => a.angle - b.angle)
  const minSep = (Math.PI * 2) / Math.max(attrs.length, 1) * 0.72
  for (let pass = 0; pass < 6; pass++) {
    for (let i = 1; i < attrs.length; i++) if (attrs[i].angle - attrs[i - 1].angle < minSep) attrs[i].angle = attrs[i - 1].angle + minSep
  }
  attrs.forEach(({ n, angle }) => out.set(n.id, { ...n, x: cx + Math.cos(angle) * r2x, y: cy + Math.sin(angle) * r2y, r: 6, angle }))
  return [...out.values()]
}

export function GraphStage() {
  const { scenario, selectTest, selectedTest } = useAtlas()
  const box = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 600, h: 400 })
  const [g, setG] = useState<{ nodes: GNode[]; edges: GEdge[] } | null>(null)
  const [hover, setHover] = useState<string | null>(null)
  const [focus, setFocus] = useState<string | null>(null)
  useEffect(() => {
    const el = box.current!
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth || 600, h: el.clientHeight || 400 }))
    ro.observe(el); return () => ro.disconnect()
  }, [])
  useEffect(() => {
    const t = setTimeout(() => { api.graph(scenario).then((r) => { setG(r); setFocus(null) }).catch(() => setG(null)) }, 150)
    return () => clearTimeout(t)
  }, [scenario])
  const base = useMemo(() => (g ? layout(g.nodes, g.edges, size.w, size.h) : []), [g, size])
  const linked = (a: string, b: string) => !!g?.edges.some((e) => (e.source === a && e.target === b) || (e.target === a && e.source === b))
  const around = useMemo(() => (focus && g ? base.filter((p) => linked(focus, p.id)) : []), [focus, g, base])
  // com foco: a bola escolhida no centro e as ligadas a ela num anel; as outras somem
  const placed = useMemo(() => {
    if (!focus || !base.some((p) => p.id === focus)) return base
    // o anel fica na metade de cima do palco: embaixo, à esquerda, entra o cartão da bola em foco
    const cx = size.w / 2 + 14, cy = size.h / 2 - 10, S = Math.min(size.w, size.h)
    const rx = Math.max(70, Math.min(size.w / 2 - 110, S * 0.42)), ry = Math.max(46, Math.min(size.h / 2 - 96, S * 0.32))
    const ids = around.map((p) => p.id)
    return base.map((p) => {
      if (p.id === focus) return { ...p, x: cx, y: cy, r: 17, angle: 0 }
      const i = ids.indexOf(p.id)
      if (i < 0) return p
      // arco de 250° que deixa livre o canto de baixo à esquerda, onde fica o cartão
      const ang = ((190 + ((i + 0.5) / ids.length) * 250) * Math.PI) / 180
      return { ...p, x: cx + Math.cos(ang) * rx, y: cy + Math.sin(ang) * ry, r: 9, angle: ang }
    })
  }, [base, focus, around, size])
  const by = useMemo(() => new Map(placed.map((p) => [p.id, p])), [placed])
  const shown = (id: string) => !focus || id === focus || around.some((p) => p.id === id)
  const lit = (id: string) => (focus ? shown(id) : !hover || id === hover || linked(hover, id))
  const cur = focus ? by.get(focus) : undefined
  const pick = (p: Placed) => { setHover(null); setFocus(p.id === focus ? null : p.id) }
  return (
    <div ref={box} style={{ position: 'absolute', inset: 0 }}>
      <svg className={`graph-svg${focus ? ' focused' : ''}`} role="img" aria-label="Grafo das relações entre o cenário e os testes mais parecidos" onClick={() => setFocus(null)}>
        {g?.edges.map((e, i) => {
          const a = by.get(e.source), b = by.get(e.target); if (!a || !b) return null
          const near = e.type === 'PROXIMO'
          const on = focus ? e.source === focus || e.target === focus : !hover || e.source === hover || e.target === hover
          return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={near ? 'var(--act)' : 'var(--line-2)'} strokeWidth={near ? 1.5 : 1}
            strokeDasharray={near ? '4 4' : undefined} opacity={on ? (near ? 0.75 : 0.8) : focus ? 0 : 0.12} />
        })}
        {placed.map((p) => {
          const fill = p.type === 'teste' ? FAMILY[p.family ?? ''] ?? 'var(--fumaca)' : COLOR[p.type]
          const isFocus = p.id === focus, center = isFocus || (!focus && p.type === 'cenario')
          const right = Math.cos(p.angle) >= 0, outer = p.type !== 'teste' && p.type !== 'cenario'
          const tx = center ? 0 : (right ? p.r + 5 : -p.r - 5), anchor = center ? 'middle' : right ? 'start' : 'end'
          const max = focus ? 30 : 20
          return (
            <g key={p.id} className={`n-node n-${p.type}${isFocus ? ' on' : ''}`} style={{ transform: `translate(${p.x}px, ${p.y}px)`, opacity: lit(p.id) ? 1 : focus ? 0 : 0.25, pointerEvents: shown(p.id) ? undefined : 'none' }}
              onMouseEnter={() => setHover(p.id)} onMouseLeave={() => setHover(null)}
              onClick={(ev) => { ev.stopPropagation(); pick(p) }}>
              <circle r={p.r} fill={fill} fillOpacity={p.type === 'teste' && !p.inside ? 0.55 : 1}
                stroke={isFocus || (p.test_id && p.test_id === selectedTest) ? 'var(--act)' : 'var(--ink-0)'} strokeWidth={isFocus ? 3 : 2} />
              <text x={tx} y={center ? p.r + 15 : 4} textAnchor={anchor} className={center || p.type === 'teste' ? 'lbl-main' : ''}>
                {p.label.length > max ? p.label.slice(0, max - 1) + '…' : p.label}
              </text>
              {outer && !isFocus && <text x={tx} y={16} textAnchor={anchor} style={{ fontSize: 9.5, fill: 'var(--faint)' }}>{TYPE_NAME[p.type]}</text>}
              <title>{p.detail ? `${p.label} · ${p.detail}` : p.label}</title>
            </g>
          )
        })}
      </svg>
      {cur && (
        <aside className="graph-focus" aria-live="polite">
          <span className="cap">{cur.type === 'cenario' ? 'Seu cenário' : cur.type === 'teste' ? 'Teste da NASA' : TYPE_NAME[cur.type]}</span>
          <b>{cur.label}</b>
          {cur.detail && <span>{cur.detail}</span>}
          <span className="faint">{around.length === 1 ? '1 ligação' : `${around.length} ligações`} ao redor. Toque numa delas para seguir.</span>
          <div className="actions">
            {cur.test_id && <button className="link" onClick={() => selectTest(cur.test_id!)}>Abrir o teste</button>}
            <button className="link" onClick={() => setFocus(null)}>Voltar ao grafo inteiro</button>
          </div>
        </aside>
      )}
      <div className="graph-legend" aria-label="O que cada bola é">
        <span><i style={{ background: 'var(--act)' }} />Seu cenário</span>
        <span><i style={{ background: 'var(--solido)' }} />Teste parecido</span>
        <span><i className="dash" />Parecido com o seu</span>
        <span><i style={{ background: 'var(--dim)' }} />Investigação</span>
        <span><i style={{ background: 'var(--g0)' }} />Gravidade</span>
        <span><i style={{ background: 'var(--medido)' }} />Desfecho</span>
      </div>
      {!g && <p className="lab-wait">Montando o grafo…</p>}
      {g && g.nodes.length <= 1 && <p className="lab-wait">Nenhum teste deste tipo tem oxigênio e pressão tabelados.</p>}
    </div>
  )
}
