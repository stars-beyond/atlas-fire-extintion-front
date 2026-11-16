// Achado "spice_fuligem": pontos de fuligem do SPICE, vazão de combustível contra velocidade do ar.
import { Frame, Wd, lin } from './Frame'

export function Spice({ data }: { data: { fuel: string; air_cm_s: number; fuel_mg_s: number }[] }) {
  const fuels = [...new Set(data.map((d) => d.fuel))]
  const cols = ['var(--g0)', 'var(--g1)', 'var(--gota)', 'var(--solido)', 'var(--gas)', 'var(--incognita)']
  const x = lin(0, 90, 40, Wd - 12), y = lin(0, 4.6, 190, 14)
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div className="badges">{fuels.map((f, i) => (<span key={f} className="pill"><i className="swatch" style={{ background: cols[i % cols.length] }} />{f}</span>))}</div>
      <Frame h={214} label="SPICE soot points: fuel flow rate vs. air velocity">
        {[0, 1, 2, 3, 4].map((t) => (<g key={t}><line className="grid" x1={40} x2={Wd - 12} y1={y(t)} y2={y(t)} /><text x={34} y={y(t) + 3} textAnchor="end">{t}</text></g>))}
        {[0, 20, 40, 60, 80].map((t) => (<text key={t} x={x(t)} y={206} textAnchor="middle">{t}</text>))}
        {data.map((d, i) => (<circle key={i} cx={x(d.air_cm_s)} cy={y(d.fuel_mg_s)} r={2.6} fill={cols[fuels.indexOf(d.fuel) % cols.length]} fillOpacity={0.75} />))}
        <text x={40} y={10}>Fuel (mg/s) × air (cm/s)</text>
      </Frame>
    </div>
  )
}
