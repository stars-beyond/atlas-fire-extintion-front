// Ficha de um experimento da fila do próximo fogo: condições, o que medir, o que decide e o que fecha.
import { nf } from '../../lib/format'
import type { Proposal } from '../../types'

const KIND: Record<Proposal['kind'], string> = { gravidade: 'Gravidade', oxigenio: 'Oxigênio', pressao: 'Pressão', habitat: 'Ambiente inteiro', curva: 'Conferir a curva' }
export function Sheet({ p, band }: { p: Proposal; band: number }) {
  return (
    <article className="card sheet">
      <div className="sec-title"><h2>{p.rank}. {p.title}</h2><span className="pill">{KIND[p.kind]}</span></div>
      <dl className="specs sheet-specs">
        <div><dt>Gravidade</dt><dd>{p.gravity}</dd></div>
        <div><dt>Pressão</dt><dd>{p.pressure}</dd></div>
      </dl>
      <dl className="kv sheet-kv">
        <dt>Material</dt><dd>{p.material}</dd>
        <dt>Oxigênio</dt><dd>{p.o2}</dd>
        <dt>Vento</dt><dd>{p.flow}</dd>
        <dt>O que medir</dt><dd>{p.measure}</dd>
      </dl>
      <h3>O que a curva da NASA prevê</h3>
      <p className="dim">{p.prediction}</p>
      <h3>O que o resultado decide</h3>
      <p className="dim">{p.decides}</p>
      <h3>Para a base lunar</h3>
      <p className="sheet-lunar">{p.lunar.text}</p>
      {p.lunar.width_after_o2 < p.lunar.width_before_o2 && (
        <div className="sheet-bars" role="img" aria-label={`Faixa do limite de oxigênio: ${nf(p.lunar.width_before_o2, 1)} pontos hoje, mais ou menos ${nf(band, 1)} depois do teste.`}>
          <span>hoje</span><i style={{ width: `${Math.min(100, (p.lunar.width_before_o2 + 2 * band) * 22)}%` }} /><b>{nf(p.lunar.width_before_o2, 1)} pontos de O₂, mais o espalhamento</b>
          <span>depois</span><i className="after" style={{ width: `${Math.min(100, 2 * band * 22)}%` }} /><b>só o espalhamento (± {nf(band, 1)})</b>
        </div>
      )}
      <h3>O que fecha</h3>
      {p.closes.length ? <ul className="plain">{p.closes.map((c) => <li key={c.habitat + c.what}><b>{c.name}</b>: {c.label}</li>)}</ul> : <p className="dim">Nenhuma ressalva de ambiente.</p>}
      {p.remains.length > 0 && (<><h3>O que continua em aberto depois dele</h3><ul className="plain">{p.remains.map((r) => <li key={r}>{r}</li>)}</ul></>)}
      <h3>Onde dá para fazer</h3>
      <p className="dim">{p.platform}</p>
      {p.check_first && (<><h3>Conferir antes</h3><p className="note">{p.check_first}</p></>)}
      <p className="mono">Fontes: {p.sources.join(' · ')}</p>
    </article>
  )
}
