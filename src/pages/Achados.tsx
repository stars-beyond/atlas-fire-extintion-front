// Achados: o que os dados tabelados já mostram, cada um com a frase calculada e o gráfico.
import { useEffect, useState } from 'react'
import { FAMILY, api, nf, pct, type Insight } from '../api'
import { Auditoria } from './Auditoria'
import { ChartBuilder } from './ChartBuilder'

const Wd = 520
function Frame({ h, children, label }: { h: number; children: React.ReactNode; label: string }) {
  return <svg className="chart" viewBox={`0 0 ${Wd} ${h}`} width="100%" role="img" aria-label={label}>{children}</svg>
}
const lin = (d0: number, d1: number, r0: number, r1: number) => (v: number) => r0 + ((v - d0) / (d1 - d0)) * (r1 - r0)

function Cobertura({ data }: { data: { family: string; n: number; o2_min: number; o2_max: number }[] }) {
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

function FlexChart({ data }: { data: { groups: any[]; points: { o2: number; k: number; dil: string }[] } }) {
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

function Bands({ data }: { data: { band: string; n: number; ignition: number }[] }) {
  const bw = (Wd - 60) / data.length, y = lin(0, 1, 170, 22)
  return (
    <Frame h={200} label="Fração de testes com ignição por faixa de temperatura adiabática">
      {[0, 0.5, 1].map((t) => (<g key={t}><line className="grid" x1={46} x2={Wd} y1={y(t)} y2={y(t)} /><text x={40} y={y(t) + 3} textAnchor="end">{pct(t)}</text></g>))}
      {data.map((d, i) => (<g key={d.band}>
        <rect x={52 + i * bw} y={y(d.ignition)} width={bw - 8} height={y(0) - y(d.ignition)} fill="var(--g1)" rx={2} />
        <text x={52 + i * bw + (bw - 8) / 2} y={y(d.ignition) - 5} textAnchor="middle">{pct(d.ignition)}</text>
        <text x={52 + i * bw + (bw - 8) / 2} y={186} textAnchor="middle">{d.band.split('–')[0]}</text>
        <text x={52 + i * bw + (bw - 8) / 2} y={197} textAnchor="middle" style={{ fill: 'var(--faint)' }}>n={d.n}</text>
      </g>))}
      <text x={46} y={12}>Testes que acenderam, por temperatura adiabática (K, início da faixa)</text>
    </Frame>
  )
}

function Pairs({ data }: { data: { sample: string; material: string; zero_g: string; one_g: string; outcome_0g: string }[] }) {
  return (
    <div className="tbl-wrap"><table>
      <thead><tr><th>Amostra</th><th>Material</th><th style={{ color: 'var(--g0)' }}>Em 0 g</th><th style={{ color: 'var(--g1)' }}>Em 1 g</th></tr></thead>
      <tbody>{data.map((p) => (<tr key={p.sample}><td className="mono">{p.sample}</td><td>{p.material}</td>
        <td>{p.outcome_0g === 'extinguiu' ? 'quase não queimou' : 'queimou'} <span className="faint">({p.zero_g})</span></td><td>{p.one_g.replace('1 g: ', '')}</td></tr>))}</tbody>
    </table></div>
  )
}

function Spice({ data }: { data: { fuel: string; air_cm_s: number; fuel_mg_s: number }[] }) {
  const fuels = [...new Set(data.map((d) => d.fuel))]
  const cols = ['var(--g0)', 'var(--g1)', 'var(--gota)', 'var(--solido)', 'var(--gas)', 'var(--incognita)']
  const x = lin(0, 90, 40, Wd - 12), y = lin(0, 4.6, 190, 14)
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div className="badges">{fuels.map((f, i) => (<span key={f} className="pill"><i className="swatch" style={{ background: cols[i % cols.length] }} />{f}</span>))}</div>
      <Frame h={214} label="Pontos de fuligem do SPICE: vazão de combustível contra velocidade do ar">
        {[0, 1, 2, 3, 4].map((t) => (<g key={t}><line className="grid" x1={40} x2={Wd - 12} y1={y(t)} y2={y(t)} /><text x={34} y={y(t) + 3} textAnchor="end">{t}</text></g>))}
        {[0, 20, 40, 60, 80].map((t) => (<text key={t} x={x(t)} y={206} textAnchor="middle">{t}</text>))}
        {data.map((d, i) => (<circle key={i} cx={x(d.air_cm_s)} cy={y(d.fuel_mg_s)} r={2.6} fill={cols[fuels.indexOf(d.fuel) % cols.length]} fillOpacity={0.75} />))}
        <text x={40} y={10}>Combustível (mg/s) × ar (cm/s)</text>
      </Frame>
    </div>
  )
}

export function Achados() {
  const [list, setList] = useState<Insight[] | null>(null)
  const [err, setErr] = useState('')
  const [tab, setTab] = useState<'achados' | 'grafico' | 'auditoria'>('grafico')
  useEffect(() => { api.insights().then((r) => setList(r.insights)).catch((e) => setErr(e.message)) }, [])
  return (
    <main className="page"><div className="page-in">
      <div style={{ display: 'grid', gap: 10 }}>
        <span className="cap">Achados · calculados sobre as tabelas experimentais do PSI</span>
        <h1>O que os dados já dizem sobre fogo em microgravidade</h1>
        <p className="lede">Comece cruzando você mesmo as variáveis das tabelas da NASA; os cinco achados prontos e a auditoria dos dados estão nas outras abas.</p>
        <div className="tabs" role="tablist" style={{ maxWidth: 620 }}>
          <button role="tab" aria-selected={tab === 'grafico'} onClick={() => setTab('grafico')}>Monte seu gráfico</button>
          <button role="tab" aria-selected={tab === 'achados'} onClick={() => setTab('achados')}>Cinco achados</button>
          <button role="tab" aria-selected={tab === 'auditoria'} onClick={() => setTab('auditoria')}>Auditoria</button>
        </div>
      </div>
      {tab === 'auditoria' ? <Auditoria /> : tab === 'grafico' ? <ChartBuilder /> : (
        <>
          <p className="lede">Cada frase abaixo é recalculada a partir dos testes carregados. Os números mudam se a ingestão trouxer tabelas novas do PSI.</p>
          {err && <p className="empty">Não foi possível carregar os achados. {err}</p>}
          {!list && !err && <p className="empty">Calculando…</p>}
          <div className="insights">
            {list?.map((i) => (
              <article key={i.id} className="card">
                <h2>{i.title}</h2>
                <p className="finding">{i.finding}</p>
                {i.id === 'cobertura' && <Cobertura data={i.data} />}
                {i.id === 'flex_desfecho' && <FlexChart data={i.data} />}
                {i.id === 'cfig_ignicao' && <Bands data={i.data} />}
                {i.id === 'saffire_gravidade' && <Pairs data={i.data} />}
                {i.id === 'spice_fuligem' && <Spice data={i.data} />}
                <p className="note">Fonte: {i.source}</p>
              </article>
            ))}
          </div>
        </>
      )}
    </div></main>
  )
}
