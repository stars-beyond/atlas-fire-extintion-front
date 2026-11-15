// Passo 4: a ficha técnica. O resumo que a pessoa leva do test drive.
import { useMemo, useState } from 'react'
import { OUTCOME, TIER, gLabel, nf, pct, psi } from '../api'
import { EmpiricalRate } from '../components/EmpiricalRate'
import { Gaps, gapLabel } from '../components/Gaps'
import { Studies } from '../components/Studies'
import { Seal } from '../components/Seal'
import { materialOf, useAtlas } from '../store'
import { plain } from './TestDrive'

export function FichaStep() {
  const { scenario, verdict, ranking, log, meta, restart, gaps: next } = useAtlas()
  const [copied, setCopied] = useState(false)
  const hab = meta?.habitats.find((h) => h.id === scenario.habitat)
  const mat = materialOf(scenario)
  const answers = log.filter((e) => e.answer).slice(0, 3)
  const md = useMemo(() => {
    if (!verdict) return ''
    const L = [`# Ficha técnica · ${mat.name} em ${hab ? hab.name : 'ambiente personalizado'}`, '',
      `Atlas de Extinção, ${new Date().toLocaleDateString('pt-BR')}. Dados do NASA PSI.`, '',
      '## Cenário', `- Oxigênio: ${pct(scenario.o2, 1)}`, `- Pressão: ${psi(scenario.pressure_atm)} (${nf(scenario.pressure_atm, 2)} atm)`, `- Gravidade: ${gLabel(scenario.gravity)}`, `- Material: ${mat.name}`, '',
      `## Evidência: ${TIER[verdict.tier].label}`, verdict.headline, verdict.explanation,
      ...(verdict.empirical ? ['', `Nos testes reais desta condição: ${verdict.empirical.headline} ${verdict.empirical.caveat}`] : []),
      '', '## Testes mais parecidos',
      ...verdict.nearest.slice(0, 5).map((n) => `- ${n.investigation} ${n.test.label}: ${pct(n.test.o2)} de O₂ a ${psi(n.test.pressure_atm)} em ${gLabel(n.test.gravity)}; ${OUTCOME[n.test.outcome]}. Fonte: ${n.test.source_file}, linha ${n.test.source_row}.`),
    ]
    if (next.length) L.push('', '## O que falta testar', ...next.map((n, i) => `${i + 1}. ${gapLabel(n)} (${n.platform}). ${n.closes.join('; ')}.`))
    L.push('', '## Quem estudou isso', ...ranking.slice(0, 4).map((r, i) => `${i + 1}. ${r.name} (${r.id}): ${r.reason}`))
    for (const e of answers) L.push('', `## ${e.question}`, e.answer!.answer, ...e.answer!.citations.map((c) => `[${c.n}] ${c.title} · ${c.where}`))
    L.push('', '---', 'O nível de evidência diz se existe teste para o cenário. Não certifica materiais.')
    return L.join('\n')
  }, [scenario, verdict, ranking, next, answers, hab, mat])
  if (!verdict) return <div className="step"><p className="hint">Montando a ficha…</p></div>
  const copy = () => navigator.clipboard?.writeText(md).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) }).catch(() => {})
  return (
    <div className="step ficha">
      <header className="step-head">
        <span className="eyebrow">Passo 4 de 4 · ficha técnica</span>
        <h1>{mat.name} em {hab ? hab.name.toLowerCase() : 'ambiente personalizado'}</h1>
      </header>
      <dl className="specs">
        <div><dt>Oxigênio</dt><dd>{pct(scenario.o2, 1)}</dd></div>
        <div><dt>Pressão</dt><dd>{psi(scenario.pressure_atm)}</dd></div>
        <div><dt>Gravidade</dt><dd>{gLabel(scenario.gravity)}</dd></div>
      </dl>
      <div className="block">
        <Seal tier={verdict.tier} big />
        <p className="lead">{plain(verdict.headline)}</p>
        <p>{verdict.explanation}</p>
        <EmpiricalRate verdict={verdict} compact />
      </div>
      <section className="block section">
        <span className="eyebrow">O que falta</span>
        <h2>O que falta testar</h2>
        <Gaps />
      </section>
      <section className="block section">
        <span className="eyebrow">O que já existe</span>
        <h2>Quem estudou isso</h2>
        <Studies />
      </section>
      <div className="actions no-print">
        <button className="cta" onClick={copy}>{copied ? 'Copiado' : 'Copiar a ficha'}</button>
        <button className="ghost" onClick={() => window.print()}>Imprimir ou salvar em PDF</button>
        <button className="ghost" onClick={restart}>Fazer outro test drive</button>
      </div>
      <p className="hint">O nível de evidência diz se existe teste para o cenário. Ele não certifica materiais.</p>
    </div>
  )
}
