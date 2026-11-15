// Achado "flex_desfecho": desfecho dos testes do FLEX e a taxa de queima das gotas contra o O₂.
import { nf, pct } from '../../../lib/format'
import { Frame, Wd, lin } from './Frame'

export function FlexChart({ data }: { data: { groups: any[]; points: { o2: number; k: number; dil: string }[] } }) {
  const keys: [string, string, string][] = [['extinguiu', 'Apagou', 'var(--g0)'], ['disrupcao', 'Gota estourou', 'var(--gas)'], ['queimou', 'Queimou até o fim', 'var(--g1)']]
  const x = lin(0, 1, 150, Wd - 10)
  const dcol: Record<string, string> = { 'só N₂': 'var(--dim)', 'com CO₂': 'var(--g0)', 'com He': 'var(--g1)' }
  const sx = lin(0.1, 0.36, 40, Wd - 12), sy = lin(0, 1.2, 190, 14)
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div className="badges">{keys.map(([, l, c]) => (<span key={l} className="pill"><i className="swatch" style={{ background: c }} />{l}</span>))}</div>
      <Frame h={data.groups.length * 26 + 6} label="Desfecho dos testes do FLEX por combustível e diluente">
        {data.groups.map((g, i) => { let acc = 0; return (<g key={g.group}>
          <text x={0} y={17 + i * 26}>{g.group} ({g.n})</text>
          {keys.map(([k, , c]) => { const v = g[k] as number; const x0 = x(acc); acc += v; return v > 0 ? (<g key={k}>
            <rect x={x0} y={4 + i * 26} width={Math.max(0, x(acc) - x0 - 1)} height={18} fill={c} />
            {v > 0.09 && <text x={x0 + 4} y={17 + i * 26} style={{ fill: '#0b1017', fontWeight: 600 }}>{pct(v)}</text>}</g>) : null })}
        </g>) })}
      </Frame>
      <div className="badges"><span className="cap">Taxa de queima × O₂</span>{Object.entries(dcol).map(([l, c]) => (<span key={l} className="pill"><i className="swatch" style={{ background: c }} />{l}</span>))}</div>
      <Frame h={214} label="Taxa de queima das gotas do FLEX contra O₂ inicial, por diluente">
        {[0, 0.3, 0.6, 0.9, 1.2].map((t) => (<g key={t}><line className="grid" x1={40} x2={Wd - 12} y1={sy(t)} y2={sy(t)} /><text x={34} y={sy(t) + 3} textAnchor="end">{nf(t, 1)}</text></g>))}
        {[0.12, 0.18, 0.24, 0.3, 0.36].map((t) => (<text key={t} x={sx(t)} y={206} textAnchor="middle">{pct(t)}</text>))}
        {data.points.map((p, i) => (<circle key={i} cx={sx(p.o2)} cy={sy(p.k)} r={2.6} fill={dcol[p.dil]} fillOpacity={0.7} />))}
        <text x={40} y={10}>K (mm²/s)</text>
      </Frame>
    </div>
  )
}
