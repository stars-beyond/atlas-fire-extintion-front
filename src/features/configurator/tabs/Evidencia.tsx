// Aba "Evidência" do test drive: o selo, a taxa dos testes reais e os testes mais parecidos com o cenário.
import { Seal } from '../../../components/Seal'
import { OUTCOME, gLabel, nf, pct, plain, psi } from '../../../lib/format'
import { useAtlas } from '../../../state'
import { EmpiricalRate } from '../EmpiricalRate'

export function Evidencia({ onGaps }: { onGaps: () => void }) {
  const { verdict, selectTest, setStageView } = useAtlas()
  if (!verdict) return <p className="hint">Consultando os testes da NASA…</p>
  return (
    <div className="block">
      <Seal tier={verdict.tier} big />
      <p className="lead">{plain(verdict.headline)}</p>
      <p>{verdict.explanation}</p>
      <EmpiricalRate verdict={verdict} />
      <div className="counts" aria-label="Quantos testes da NASA existem nesta atmosfera, por gravidade">
        <div><b>{verdict.same_g}</b><span>testes nesta gravidade</span></div>
        <div><b style={{ color: 'var(--g0)' }}>{verdict.zero_g}</b><span>em órbita (0 g)</span></div>
        <div><b style={{ color: 'var(--g1)' }}>{verdict.one_g}</b><span>no solo (1 g)</span></div>
      </div>
      {!verdict.empirical && (
        <button className="callout" onClick={onGaps}>
          <b>Ninguém queimou isto nesta condição.</b>
          <span>Por isso o Atlas não diz se queima: mostra os testes mais próximos e o que falta testar →</span>
        </button>
      )}
      <h2>Os testes mais parecidos com o seu</h2>
      <div className="list">
        {verdict.nearest.slice(0, 4).map((n) => (
          <button key={n.test.id} className="row" onClick={() => { selectTest(n.test.id); setStageView('mapa') }}>
            <span className="row-main"><b>{n.investigation} · {n.test.label}</b><span>{pct(n.test.o2)} de O₂ · {psi(n.test.pressure_atm)} · {gLabel(n.test.gravity)} · {OUTCOME[n.test.outcome]}</span></span>
            <span className={`tag${n.inside ? ' ok' : ''}`}>{n.inside ? 'mesma condição' : `${n.d_o2_pp > 0 ? '+' : '−'}${nf(Math.abs(n.d_o2_pp), 0)} pontos de O₂`}</span>
          </button>
        ))}
        {!verdict.nearest.length && <p className="hint">Nenhum teste deste tipo tem oxigênio e pressão tabelados.</p>}
      </div>
      <p className="hint">Toque num teste para vê-lo no mapa, com o arquivo e a linha de onde o dado saiu.</p>
    </div>
  )
}
