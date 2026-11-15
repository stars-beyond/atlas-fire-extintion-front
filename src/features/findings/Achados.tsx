// Achados: o que os dados tabelados já mostram, cada um com a frase calculada e o gráfico.
import { useEffect, useState } from 'react'
import { api } from '../../api'
import type { Insight } from '../../types'
import { Auditoria } from './Auditoria'
import { ChartBuilder } from './ChartBuilder'
import { Bands } from './charts/Bands'
import { Cobertura } from './charts/Cobertura'
import { FlexChart } from './charts/FlexChart'
import { Pairs } from './charts/Pairs'
import { Spice } from './charts/Spice'

export function Achados() {
  const [list, setList] = useState<Insight[] | null>(null)
  const [err, setErr] = useState('')
  const [tab, setTab] = useState<'achados' | 'grafico' | 'auditoria'>('grafico')
  useEffect(() => { api.insights().then((r) => setList(r.insights)).catch((e) => setErr(e.message)) }, [])
  return (
    <main className="page"><div className="page-in">
      <div style={{ display: 'grid', gap: 10 }}>
        <span className="cap">Findings · computed from the PSI experiment tables</span>
        <h1>What the data already say about fire in microgravity</h1>
        <p className="lede">Start by cross-plotting the variables in NASA's tables yourself; the ready-made findings and the data audit are in the other tabs.</p>
        <div className="tabs" role="tablist" style={{ maxWidth: 620 }}>
          <button role="tab" aria-selected={tab === 'grafico'} onClick={() => setTab('grafico')}>Build your chart</button>
          <button role="tab" aria-selected={tab === 'achados'} onClick={() => setTab('achados')}>Findings</button>
          <button role="tab" aria-selected={tab === 'auditoria'} onClick={() => setTab('auditoria')}>Audit</button>
        </div>
      </div>
      {tab === 'auditoria' ? <Auditoria /> : tab === 'grafico' ? <ChartBuilder /> : (
        <>
          <p className="lede">Each statement below is recomputed from the loaded tests. The numbers change if ingestion brings in new PSI tables; new investigations and the latest PSI updates get automatic cards.</p>
          {err && <p className="empty">Could not load the findings. {err}</p>}
          {!list && !err && <p className="empty">Computing…</p>}
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
                <p className="note">Source: {i.source}</p>
              </article>
            ))}
          </div>
        </>
      )}
    </div></main>
  )
}
