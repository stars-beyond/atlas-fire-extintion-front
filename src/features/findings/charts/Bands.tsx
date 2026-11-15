// Achado "cfig_ignicao": fração de testes que acenderam por faixa de temperatura adiabática.
import { pct } from '../../../lib/format'
import { Frame, Wd, lin } from './Frame'

export function Bands({ data }: { data: { band: string; n: number; ignition: number }[] }) {
  const bw = (Wd - 60) / data.length, y = lin(0, 1, 170, 22)
  return (
    <Frame h={200} label="Share of tests that ignited, by adiabatic temperature band">
      {[0, 0.5, 1].map((t) => (<g key={t}><line className="grid" x1={46} x2={Wd} y1={y(t)} y2={y(t)} /><text x={40} y={y(t) + 3} textAnchor="end">{pct(t)}</text></g>))}
      {data.map((d, i) => (<g key={d.band}>
        <rect x={52 + i * bw} y={y(d.ignition)} width={bw - 8} height={y(0) - y(d.ignition)} fill="var(--g1)" rx={2} />
        <text x={52 + i * bw + (bw - 8) / 2} y={y(d.ignition) - 5} textAnchor="middle">{pct(d.ignition)}</text>
        <text x={52 + i * bw + (bw - 8) / 2} y={186} textAnchor="middle">{d.band.split('–')[0]}</text>
        <text x={52 + i * bw + (bw - 8) / 2} y={197} textAnchor="middle" style={{ fill: 'var(--faint)' }}>n={d.n}</text>
      </g>))}
      <text x={46} y={12}>Tests that ignited, by adiabatic temperature (K, band start)</text>
    </Frame>
  )
}
