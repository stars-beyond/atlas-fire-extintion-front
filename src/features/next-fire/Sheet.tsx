// Ficha de um experimento da fila do próximo fogo: condições, o que medir, o que decide e o que fecha.
import { nf } from '../../lib/format'
import type { Proposal } from '../../types'

const KIND: Record<Proposal['kind'], string> = { gravidade: 'Gravity', oxigenio: 'Oxygen', pressao: 'Pressure', habitat: 'Whole environment', curva: 'Check the curve' }
export function Sheet({ p, band }: { p: Proposal; band: number }) {
  return (
    <article className="card sheet">
      <div className="sec-title"><h2>{p.rank}. {p.title}</h2><span className="pill">{KIND[p.kind]}</span></div>
      <dl className="specs sheet-specs">
        <div><dt>Gravity</dt><dd>{p.gravity}</dd></div>
        <div><dt>Pressure</dt><dd>{p.pressure}</dd></div>
      </dl>
      <dl className="kv sheet-kv">
        <dt>Material</dt><dd>{p.material}</dd>
        <dt>Oxygen</dt><dd>{p.o2}</dd>
        <dt>Airflow</dt><dd>{p.flow}</dd>
        <dt>What to measure</dt><dd>{p.measure}</dd>
      </dl>
      <h3>What the NASA curve predicts</h3>
      <p className="dim">{p.prediction}</p>
      <h3>What the result decides</h3>
      <p className="dim">{p.decides}</p>
      <h3>For the lunar base</h3>
      <p className="sheet-lunar">{p.lunar.text}</p>
      {p.lunar.width_after_o2 < p.lunar.width_before_o2 && (
        <div className="sheet-bars" role="img" aria-label={`Oxygen limit band: ${nf(p.lunar.width_before_o2, 1)} points today, plus or minus ${nf(band, 1)} after the test.`}>
          <span>today</span><i style={{ width: `${Math.min(100, (p.lunar.width_before_o2 + 2 * band) * 22)}%` }} /><b>{nf(p.lunar.width_before_o2, 1)} O₂ points, plus scatter</b>
          <span>after</span><i className="after" style={{ width: `${Math.min(100, 2 * band * 22)}%` }} /><b>scatter only (± {nf(band, 1)})</b>
        </div>
      )}
      <h3>What it closes</h3>
      {p.closes.length ? <ul className="plain">{p.closes.map((c) => <li key={c.habitat + c.what}><b>{c.name}</b>: {c.label}</li>)}</ul> : <p className="dim">No environment caveats.</p>}
      {p.remains.length > 0 && (<><h3>What remains open afterwards</h3><ul className="plain">{p.remains.map((r) => <li key={r}>{r}</li>)}</ul></>)}
      <h3>Where it can be done</h3>
      <p className="dim">{p.platform}</p>
      {p.check_first && (<><h3>Check first</h3><p className="note">{p.check_first}</p></>)}
      <p className="mono">Sources: {p.sources.join(' · ')}</p>
    </article>
  )
}
