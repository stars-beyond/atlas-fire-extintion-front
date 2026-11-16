// Achado "flex_desfecho": desfecho dos testes do FLEX e a taxa de queima das gotas contra o O₂.
import { nf, pct } from '../../../lib/format'
import { FLEX_DILUENT, FLEX_END as keys } from '../labels'
import { Frame, Wd, lin } from './Frame'

export function FlexChart({ data }: { data: { groups: any[]; points: { o2: number; k: number; dil: string }[] } }) {
  const x = lin(0, 1, 0, Wd), ROW = 58   // the bar uses the full width; the label has a line of its own
  const sx = lin(0.1, 0.36, 40, Wd - 12), sy = lin(0, 1.2, 190, 14)
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div className="badges">{keys.map(([, l, c]) => (<span key={l} className="pill"><i className="swatch" style={{ background: c }} />{l}</span>))}</div>
      {/* One block per group: its name and n on a line of their own, the bar on the full width below, and the
          three shares written out under it. A share is written inside its segment only when it fits there. */}
      <Frame h={data.groups.length * ROW + 2} label={`FLEX test outcomes by fuel and diluent. ${data.groups.map((g) => `${g.group}, ${g.n} tests: ${keys.map(([k, l]) => `${l} ${pct(g[k] ?? 0, 1)}`).join(', ')}`).join('. ')}.`}>
        {data.groups.map((g, i) => { let acc = 0; const y0 = i * ROW; return (<g key={g.group} style={{ fontVariantNumeric: 'tabular-nums' }}>
          <text x={0} y={y0 + 13} style={{ fill: 'var(--text)', fontSize: 11.5 }}>{g.group}</text>
          <text x={Wd} y={y0 + 13} textAnchor="end">n = {g.n}</text>
          {keys.map(([k, l, c]) => { const v = (g[k] as number) ?? 0; const x0 = x(acc); acc += v; const w = Math.max(0, x(acc) - x0 - 1); const text = pct(v, 1); return v > 0 ? (<g key={k}>
            <rect x={x0} y={y0 + 19} width={w} height={16} fill={c}><title>{`${g.group}: ${l} ${text} of ${g.n} tests`}</title></rect>
            {w >= text.length * 6.4 + 10 && <text x={x0 + 5} y={y0 + 31} style={{ fill: '#0b1017', fontWeight: 600, pointerEvents: 'none' }}>{text}</text>}</g>) : null })}
          <text x={0} y={y0 + 48} style={{ fill: 'var(--faint)' }}>{keys.map(([k, l]) => `${l} ${pct((g[k] as number) ?? 0, 1)}`).join('  ·  ')}</text>
        </g>) })}
      </Frame>
      <div className="badges"><span className="cap">Burning rate × O₂</span>{Object.entries(FLEX_DILUENT).map(([l, d]) => (<span key={l} className="pill"><i className="swatch" style={{ background: d.color }} />{d.label}</span>))}</div>
      <Frame h={214} label="FLEX droplet burning rate vs. initial O₂, by diluent">
        {[0, 0.3, 0.6, 0.9, 1.2].map((t) => (<g key={t}><line className="grid" x1={40} x2={Wd - 12} y1={sy(t)} y2={sy(t)} /><text x={34} y={sy(t) + 3} textAnchor="end">{nf(t, 1)}</text></g>))}
        {[0.12, 0.18, 0.24, 0.3, 0.36].map((t) => (<text key={t} x={sx(t)} y={206} textAnchor="middle">{pct(t)}</text>))}
        {data.points.map((p, i) => (<circle key={i} cx={sx(p.o2)} cy={sy(p.k)} r={2.6} fill={FLEX_DILUENT[p.dil]?.color} fillOpacity={0.7} />))}
        <text x={40} y={10}>K (mm²/s)</text>
      </Frame>
    </div>
  )
}
