// Desenho dos gráficos do construtor, portado do COSMOEX FLAME (components/cf/ChartView.tsx).
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from 'recharts'
import { LOCALE } from '../../lib/format'
import type { BuiltChart } from '../../types'

const COLORS = ['var(--g0)', 'var(--g1)', 'var(--gota)', 'var(--solido)', 'var(--gas)', 'var(--incognita)', 'var(--medido)', 'var(--dim)']
const axis = { stroke: 'var(--faint)', fontSize: 11, fontFamily: 'var(--mono)' }
const tip = { contentStyle: { background: 'var(--ink-2)', border: '1px solid var(--line-2)', borderRadius: 8, fontSize: 12.5, color: 'var(--text)' }, itemStyle: { color: 'var(--text)' } }
const num = (v: number) => v.toLocaleString(LOCALE, { maximumFractionDigits: 3 })

export function ChartView({ chart, xLabel, yLabel, height = 340, onPick }: { chart: BuiltChart; xLabel: string; yLabel: string; height?: number; onPick?: (id: string) => void }) {
  if (chart.used === 0) return <p className="empty">No numeric values for this selection.</p>
  return (
    <div style={{ height, width: '100%' }}>
      <ResponsiveContainer>
        {chart.kind === 'scatter' ? (
          <ScatterChart margin={{ top: 8, right: 14, bottom: 26, left: 6 }}>
            <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" />
            <XAxis type="number" dataKey="x" name={xLabel} {...axis} domain={['auto', 'auto']} tickFormatter={num} label={{ value: xLabel, position: 'bottom', fill: 'var(--dim)', fontSize: 12 }} />
            <YAxis type="number" dataKey="y" name={yLabel} {...axis} domain={['auto', 'auto']} tickFormatter={num} label={{ value: yLabel, angle: -90, position: 'insideLeft', fill: 'var(--dim)', fontSize: 12, style: { textAnchor: 'middle' } }} />
            <ZAxis range={[46, 46]} />
            <Tooltip {...tip} formatter={(v: number) => num(v)} labelFormatter={() => ''} cursor={{ strokeDasharray: '3 3', stroke: 'var(--dim)' }} />
            {chart.series.length > 1 && <Legend wrapperStyle={{ fontSize: 12, paddingTop: 22 }} />}
            {chart.series.map((s, i) => (
              <Scatter key={s.name} name={s.name} data={s.points} fill={COLORS[i % COLORS.length]} fillOpacity={0.8} onClick={(p: any) => onPick?.(p.id)} cursor={onPick ? 'pointer' : undefined} />
            ))}
          </ScatterChart>
        ) : (
          <BarChart data={chart.bars} margin={{ top: 8, right: 14, bottom: 46, left: 6 }}>
            <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" {...axis} angle={-25} textAnchor="end" interval={0} height={64} />
            <YAxis {...axis} tickFormatter={num} />
            <Tooltip {...tip} cursor={{ fill: 'var(--ink-3)' }} formatter={(v: number) => num(v)} />
            <Bar dataKey={chart.kind === 'bar' ? 'mean' : 'count'} name={chart.kind === 'bar' ? `Mean · ${yLabel}` : 'Count'} fill={chart.kind === 'bar' ? 'var(--g0)' : 'var(--gota)'} radius={[4, 4, 0, 0]} />
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  )
}
