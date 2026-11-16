// Passo 4: a ficha técnica. O resumo que a pessoa leva do test drive.
import { useMemo, useState } from 'react'
import { Gaps, gapLabel } from '../../components/Gaps'
import { Seal } from '../../components/Seal'
import { OUTCOME, TIER, fmtDate, gLabel, nf, pct, plain, psi } from '../../lib/format'
import { materialOf, useAtlas } from '../../state'
import { EmpiricalRate } from './EmpiricalRate'
import { ExternalEvidenceCard, externalMarkdown } from './ExternalEvidence'
import { SpreadCard, spreadMarkdown, useSpread } from './SpreadSpeed'
import { Studies } from './Studies'

export function FichaStep() {
  const { scenario, verdict, verdictState, ranking, rankingState, evidenceError, retryEvidence, log, meta, restart, gaps: next } = useAtlas()
  // a ficha só sai (copiada ou impressa) quando o veredito e o ranking são os deste cenário
  const current = verdictState === 'ok' && rankingState === 'ok'
  const [copied, setCopied] = useState(false)
  const spread = useSpread()
  const hab = meta?.habitats.find((h) => h.id === scenario.habitat)
  const mat = materialOf(scenario)
  // memoized: a new array on every render would rebuild the whole Markdown sheet each time
  const answers = useMemo(() => log.filter((e) => e.answer).slice(0, 3), [log])
  const md = useMemo(() => {
    if (!verdict || !current) return ''
    const L = [`# Spec sheet · ${mat.name} in ${hab ? hab.name : 'a custom environment'}`, '',
      `Extinction Atlas, ${fmtDate(new Date())}. Data from NASA PSI.`, '',
      '## Scenario', `- Oxygen: ${pct(scenario.o2, 1)}`, `- Pressure: ${psi(scenario.pressure_atm)} (${nf(scenario.pressure_atm, 2)} atm)`, `- Gravity: ${gLabel(scenario.gravity)}`, `- Material: ${mat.name}`, '',
      `## Evidence: ${TIER[verdict.tier].label}`, verdict.headline, verdict.explanation,
      ...(verdict.empirical ? ['', `In real tests at this condition: ${verdict.empirical.headline} ${verdict.empirical.caveat}`] : []),
      '', '## Most similar tests',
      ...verdict.nearest.slice(0, 5).map((n) => `- ${n.investigation} ${n.test.label}: ${pct(n.test.o2)} O₂ at ${psi(n.test.pressure_atm)} and ${gLabel(n.test.gravity)}; ${OUTCOME[n.test.outcome] ?? n.test.outcome}. Source: ${n.test.source_file}, row ${n.test.source_row}.`),
    ]
    L.push(...externalMarkdown(verdict), ...spreadMarkdown(spread))
    if (next.length) L.push('', '## What is still untested', ...next.map((n, i) => `${i + 1}. ${gapLabel(n)} (${n.platform}). ${n.closes.join('; ')}.`))
    L.push('', '## Who has studied this', ...ranking.slice(0, 4).map((r, i) => `${i + 1}. ${r.name} (${r.id}): ${r.reason}`))
    for (const e of answers) L.push('', `## ${e.question}`, e.answer!.answer, ...e.answer!.citations.map((c) => `[${c.n}] ${c.title} · ${c.where}`))
    L.push('', '---', 'The evidence level says whether a test exists for this scenario. It does not certify materials.')
    return L.join('\n')
  }, [scenario, verdict, current, ranking, next, answers, hab, mat, spread])
  if (verdictState === 'failed') {
    return (
      <div className="step">
        <p className="hint bad">Could not build the spec sheet for this scenario: {evidenceError?.replace(/\.$/, '')}.</p>
        <div className="actions"><button className="cta" onClick={retryEvidence}>Try again</button></div>
      </div>
    )
  }
  // sem veredito, ou ainda com o do cenário anterior: a ficha espera o deste
  if (!verdict || verdictState !== 'ok') return <div className="step"><p className="hint">Building the spec sheet…</p></div>
  const copy = () => navigator.clipboard?.writeText(md).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) }).catch(() => {})
  return (
    <div className="step ficha">
      <header className="step-head">
        <span className="eyebrow">Step 4 of 4 · spec sheet</span>
        <h1>{mat.name} in {hab ? hab.name : 'a custom environment'}</h1>
      </header>
      <dl className="specs">
        <div><dt>Oxygen</dt><dd>{pct(scenario.o2, 1)}</dd></div>
        <div><dt>Pressure</dt><dd>{psi(scenario.pressure_atm)}</dd></div>
        <div><dt>Gravity</dt><dd>{gLabel(scenario.gravity)}</dd></div>
      </dl>
      <div className="block">
        <Seal tier={verdict.tier} big />
        <p className="lead">{plain(verdict.headline)}</p>
        <p>{verdict.explanation}</p>
        <EmpiricalRate verdict={verdict} compact />
      </div>
      {verdict.external && <div className="block section"><ExternalEvidenceCard e={verdict.external} compact /></div>}
      {spread && (spread.available || spread.level === 'fora') && <div className="block section"><SpreadCard sp={spread} compact /></div>}
      <section className="block section">
        <span className="eyebrow">Gaps</span>
        <h2>What is still untested</h2>
        <Gaps />
      </section>
      <section className="block section">
        <span className="eyebrow">What already exists</span>
        <h2>Who has studied this</h2>
        <Studies />
      </section>
      <div className="actions no-print">
        <button className="cta" onClick={copy} disabled={!current}>{copied ? 'Copied' : 'Copy the spec sheet'}</button>
        <button className="ghost" onClick={() => window.print()} disabled={!current}>Print or save as PDF</button>
        <button className="ghost" onClick={restart}>Run another test drive</button>
      </div>
      <p className="hint">The evidence level says whether a test exists for this scenario. It does not certify materials.</p>
    </div>
  )
}
