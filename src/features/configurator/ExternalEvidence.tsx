// Evidência de fora da NASA: os ensaios da torre de queda do ZARM na atmosfera do cenário.
// Ficam à parte do selo, que continua a dizer só o que a NASA testou; a contagem e os textos vêm da API.
import { OUTCOME, nf, pct, psi } from '../../lib/format'
import { safeHref } from '../../lib/url'
import { useAtlas } from '../../state'
import type { ExternalEvidence, Verdict } from '../../types'

// As linhas da ficha técnica em Markdown.
export function externalMarkdown(v: Verdict | null): string[] {
  const e = v?.external
  if (!e) return []
  return ['', `## Outside NASA: ${e.name}`, e.headline, e.detail, e.caveat, ...e.records.map((r) => `- ${r.authors}, ${r.title}. ${r.url}`)]
}

export function ExternalEvidenceCard({ e, compact }: { e: ExternalEvidence; compact?: boolean }) {
  const { selectTest, setStageView } = useAtlas()
  return (
    <section className="ext" aria-label="Evidence from outside NASA">
      <span className="eyebrow"><i className="ext-dot" />Outside NASA · {e.name}</span>
      <p className="lead">{e.headline}</p>
      <p>{e.detail}</p>
      {!compact && (
        <div className="list">
          {e.nearest.map((n) => (
            <button key={n.id} className="row" onClick={() => { selectTest(n.id); setStageView('mapa') }}>
              <span className="row-main"><b>{e.name} · {n.label}</b><span>{pct(n.o2, 1)} O₂ · {psi(n.pressure_atm)} · 0 g · {OUTCOME[n.outcome] ?? n.outcome}{n.spread_mm_s != null ? ` · ${nf(n.spread_mm_s, 1)} mm/s` : ''}</span></span>
              <span className="tag ext-tag">not NASA</span>
            </button>
          ))}
        </div>
      )}
      <p className="hint">{e.caveat}{!compact && <> Data: {e.records.map((r, i) => <span key={r.id}>{i > 0 && '; '}<a href={safeHref(r.url)} target="_blank" rel="noreferrer">{r.authors}, {r.id.replace('zenodo:', 'Zenodo ')}</a></span>)} ({e.license}).</>}</p>
    </section>
  )
}
