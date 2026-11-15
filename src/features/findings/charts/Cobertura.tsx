// Achado "cobertura": a faixa de O₂ testada por família de combustível, com as referências dos habitats.
import { FAMILY, nf, pct } from '../../../lib/format'
import { Frame, Wd, lin } from './Frame'

export function Cobertura({ data }: { data: { family: string; n: number; o2_min: number; o2_max: number }[] }) {
  const x = lin(0, 1, 110, Wd - 16); const refs: [number, string, string][] = [[0.21, 'ISS 21%', 'var(--g0)'], [0.3, 'Lua ≥30%', 'var(--act)'], [0.34, 'exploração 34%', 'var(--act)']]
  const col: Record<string, string> = { solido: 'var(--solido)', gota: 'var(--gota)', gas: 'var(--gas)' }
  return (
    <Frame h={170} label="Faixa de O₂ testada por família de combustível">
      {[0, 0.2, 0.4, 0.6, 0.8, 1].map((t) => (<g key={t}><line className="grid" x1={x(t)} x2={x(t)} y1={34} y2={140} /><text x={x(t)} y={156} textAnchor="middle">{pct(t)}</text></g>))}
      {data.map((d, i) => (<g key={d.family}>
        <text x={0} y={62 + i * 30}>{FAMILY[d.family]} ({nf(d.n)})</text>
        <rect x={x(d.o2_min)} y={50 + i * 30} width={Math.max(3, x(d.o2_max) - x(d.o2_min))} height={16} rx={3} fill={col[d.family]} />
        <text x={x(d.o2_max) + 6} y={62 + i * 30}>{pct(d.o2_min)}–{pct(d.o2_max)}</text>
      </g>))}
      {refs.map(([v, l, c], i) => (<g key={l}><line x1={x(v)} x2={x(v)} y1={30 - i * 0} y2={140} stroke={c} strokeDasharray="3 3" /><text x={x(v) + 3} y={12 + i * 11} fill={c} style={{ fill: c }}>{l}</text></g>))}
    </Frame>
  )
}
