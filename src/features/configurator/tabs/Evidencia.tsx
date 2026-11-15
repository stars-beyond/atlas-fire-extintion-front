// Aba "Evidência" do test drive: o selo, a taxa dos testes reais e os testes mais parecidos com o cenário.
import { Seal } from '../../../components/Seal'
import { OUTCOME, gLabel, nf, pct, plain, psi } from '../../../lib/format'
import { useAtlas } from '../../../state'
import { EmpiricalRate } from '../EmpiricalRate'

export function Evidencia({ onGaps }: { onGaps: () => void }) {
  const { verdict, selectTest, setStageView } = useAtlas()
  if (!verdict) return <p className="hint">Checking NASA tests…</p>
  return (
    <div className="block">
      <Seal tier={verdict.tier} big />
      <p className="lead">{plain(verdict.headline)}</p>
      <p>{verdict.explanation}</p>
      <EmpiricalRate verdict={verdict} />
      <div className="counts" aria-label="How many NASA tests exist in this atmosphere, by gravity">
        <div><b>{verdict.same_g}</b><span>tests at this gravity</span></div>
        <div><b style={{ color: 'var(--g0)' }}>{verdict.zero_g}</b><span>in orbit (0 g)</span></div>
        <div><b style={{ color: 'var(--g1)' }}>{verdict.one_g}</b><span>on the ground (1 g)</span></div>
      </div>
      {!verdict.empirical && (
        <button className="callout" onClick={onGaps}>
          <b>No one has burned this at this condition.</b>
          <span>So the Atlas does not say whether it burns: it shows the closest tests and what is still untested →</span>
        </button>
      )}
      <h2>The tests most similar to yours</h2>
      <div className="list">
        {verdict.nearest.slice(0, 4).map((n) => (
          <button key={n.test.id} className="row" onClick={() => { selectTest(n.test.id); setStageView('mapa') }}>
            <span className="row-main"><b>{n.investigation} · {n.test.label}</b><span>{pct(n.test.o2)} O₂ · {psi(n.test.pressure_atm)} · {gLabel(n.test.gravity)} · {OUTCOME[n.test.outcome] ?? n.test.outcome}</span></span>
            <span className={`tag${n.inside ? ' ok' : ''}`}>{n.inside ? 'same condition' : `${n.d_o2_pp > 0 ? '+' : '−'}${nf(Math.abs(n.d_o2_pp), 0)} O₂ points`}</span>
          </button>
        ))}
        {!verdict.nearest.length && <p className="hint">No test of this type has tabulated oxygen and pressure.</p>}
      </div>
      <p className="hint">Tap a test to see it on the map, with the file and row the data came from.</p>
    </div>
  )
}
