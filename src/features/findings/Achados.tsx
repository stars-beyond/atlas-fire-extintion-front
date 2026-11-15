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
