// O próximo fogo: a fila de experimentos que mais encurtam a distância entre o que a NASA já queimou
// e os ambientes de exploração, com a ficha de cada um. A ordem e os textos vêm da API (api/nextfire.go):
// é uma regra fixa sobre a curva publicada do BASS-II, não uma opinião da IA.
import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../../api'
import { fmtDate, nf } from '../../lib/format'
import { useAtlas } from '../../state'
import type { FireQueue, Proposal } from '../../types'
import { Sheet } from './Sheet'

const closesText = (p: Proposal) => {
  if (!p.closes.length) return 'closes no environment caveat'
  const habs = new Set(p.closes.map((c) => c.habitat)).size
  return `closes ${p.closes.length} ${p.closes.length === 1 ? 'caveat' : 'caveats'} in ${habs} ${habs === 1 ? 'environment' : 'environments'}`
}
const stepsText = (p: Proposal) => (p.new_factors.length === 0 ? 'no new factors' : p.new_factors.length === 1 ? '1 new factor' : `${p.new_factors.length} new factors`)

function markdown(q: FireQueue) {
  const L = ['# The next fire: experiment queue', '', `Extinction Atlas, ${fmtDate(new Date())}. Basis: ${q.source}, acrylic rod.`, '', q.method, '', '## Where we stand',
    ...q.targets.map((t) => `- ${t.habitat.name}: ${t.gaps.length ? `${t.gaps.length} ${t.gaps.length === 1 ? 'caveat' : 'caveats'} in the reading; O₂ limit between ${nf(t.assessment.limit_o2[0], 1)}% and ${nf(t.assessment.limit_o2[1], 1)}%` : 'within the tested band'}`)]
  for (const p of q.queue) {
    L.push('', `## ${p.rank}. ${p.title}`, `- Material: ${p.material}`, `- Oxygen: ${p.o2}`, `- Pressure: ${p.pressure}`, `- Gravity: ${p.gravity}`, `- Airflow: ${p.flow}`,
      `- What to measure: ${p.measure}`, `- What the curve predicts: ${p.prediction}`, `- What the result decides: ${p.decides}`,
      `- What it closes: ${p.closes.length ? p.closes.map((c) => `${c.name} (${c.label})`).join('; ') : 'no environment caveats'}`,
      `- For the lunar base: ${p.lunar.text}`, `- Where it can be done: ${p.platform}`)
    if (p.remains.length) L.push(`- What remains open: ${p.remains.join('; ')}`)
    if (p.check_first) L.push(`- Check first: ${p.check_first}`)
    L.push(`- Sources: ${p.sources.join('; ')}`)
  }
  L.push('', '---', 'These sheets point to gaps in the data. They do not replace experiment design by a combustion team.')
  return L.join('\n')
}

export function ProximoFogo() {
  const { setView, setStageView } = useAtlas()
  const [q, setQ] = useState<FireQueue | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sel, setSel] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const sheet = useRef<HTMLDivElement>(null)
  useEffect(() => { api.queue().then((r) => { setQ(r); setSel(r.queue?.[0]?.id ?? null) }).catch((e) => setError(String(e.message || e))) }, [])
  const md = useMemo(() => (q?.available ? markdown(q) : ''), [q])
  const pick = (id: string) => {
    setSel(id)
    // em tela estreita a ficha fica embaixo da fila: leva a pessoa até ela
    if (matchMedia('(max-width: 1100px)').matches) requestAnimationFrame(() => sheet.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }
  if (error) return <main className="page"><div className="page-in"><p className="hint bad">Could not build the queue: {error}</p></div></main>
  if (!q) return <main className="page"><div className="page-in"><p className="hint">Building the queue…</p></div></main>
  if (!q.available) return <main className="page"><div className="page-in"><p className="hint">The outcomes have not been loaded into the database yet.</p></div></main>
  const cur = q.queue.find((p) => p.id === sel) ?? q.queue[0]
  const copy = () => navigator.clipboard?.writeText(md).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) }).catch(() => {})
  return (
    <main className="page fire">
      <div className="page-in">
        <header className="fire-head">
          <span className="eyebrow">The next fire</span>
          <h1>What NASA needs to burn next</h1>
          <p className="dim">Solid-fuel tests stop at 22% oxygen, 14.7 psi and zero gravity. This is the queue of experiments that most shorten the distance to the Moon and Mars, for the acrylic rod, the only material with a published curve.</p>
        </header>
        <div className="fire-now">
          {q.targets.map((t) => (
            <div key={t.habitat.id} className={t.gaps.length ? '' : 'ok'}>
              <b>{t.habitat.name}</b>
              <span>{t.gaps.length ? `${t.gaps.length} ${t.gaps.length === 1 ? 'caveat' : 'caveats'} in the reading` : 'within the tested band'}</span>
              <span>O₂ limit: {t.assessment.limit_o2[1] - t.assessment.limit_o2[0] < 0.1 ? `${nf(t.assessment.limit_o2[0], 1)}%` : `${nf(t.assessment.limit_o2[0], 1)}% to ${nf(t.assessment.limit_o2[1], 1)}%`}</span>
            </div>
          ))}
        </div>
        <div className="split fire-split">
          <ol className="fire-queue" aria-label="Experiment queue, from most to least helpful">
            {q.queue.map((p) => (
              <li key={p.id}>
                <button className="row" aria-current={p.id === cur.id} onClick={() => pick(p.id)}>
                  <span className="fire-rank">{p.rank}</span>
                  <span className="row-main"><b>{p.title}</b><span>{closesText(p)} · {stepsText(p)}{p.gain_o2 > 0 ? ` · narrows the band by ${nf(p.gain_o2, 1)} O₂ points` : ''}</span></span>
                </button>
              </li>
            ))}
          </ol>
          <div ref={sheet} className="fire-sheet"><Sheet p={cur} band={q.band_o2} /></div>
        </div>
        <div className="actions no-print">
          <button className="cta" onClick={copy}>{copied ? 'Copied' : 'Copy the whole queue'}</button>
          <button className="ghost" onClick={() => window.print()}>Print this sheet</button>
          <button className="ghost" onClick={() => { setStageView('limites'); setView('drive') }}>Show the curve on the map</button>
        </div>
        <p className="hint">How the queue is ordered: {q.method}</p>
        <p className="hint">These sheets point to gaps in the data. They do not replace experiment design by a combustion team.</p>
      </div>
    </main>
  )
}
