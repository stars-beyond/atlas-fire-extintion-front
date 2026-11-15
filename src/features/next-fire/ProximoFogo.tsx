// O próximo fogo: a fila de experimentos que mais encurtam a distância entre o que a NASA já queimou
// e os ambientes de exploração, com a ficha de cada um. A ordem e os textos vêm da API (api/nextfire.go):
// é uma regra fixa sobre a curva publicada do BASS-II, não uma opinião da IA.
import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../../api'
import { nf } from '../../lib/format'
import { useAtlas } from '../../state'
import type { FireQueue, Proposal } from '../../types'
import { Sheet } from './Sheet'

const closesText = (p: Proposal) => {
  if (!p.closes.length) return 'não fecha ressalva de ambiente'
  const habs = new Set(p.closes.map((c) => c.habitat)).size
  return `fecha ${p.closes.length} ${p.closes.length === 1 ? 'ressalva' : 'ressalvas'} em ${habs} ${habs === 1 ? 'ambiente' : 'ambientes'}`
}
const stepsText = (p: Proposal) => (p.new_factors.length === 0 ? 'nenhum fator novo' : p.new_factors.length === 1 ? '1 fator novo' : `${p.new_factors.length} fatores novos`)

function markdown(q: FireQueue) {
  const L = ['# O próximo fogo: fila de experimentos', '', `Atlas de Extinção, ${new Date().toLocaleDateString('pt-BR')}. Base: ${q.source}, bastão de acrílico.`, '', q.method, '', '## Onde estamos',
    ...q.targets.map((t) => `- ${t.habitat.name}: ${t.gaps.length ? `${t.gaps.length} ressalvas na leitura; limite de O₂ entre ${nf(t.assessment.limit_o2[0], 1)}% e ${nf(t.assessment.limit_o2[1], 1)}%` : 'dentro da faixa testada'}`)]
  for (const p of q.queue) {
    L.push('', `## ${p.rank}. ${p.title}`, `- Material: ${p.material}`, `- Oxigênio: ${p.o2}`, `- Pressão: ${p.pressure}`, `- Gravidade: ${p.gravity}`, `- Vento: ${p.flow}`,
      `- O que medir: ${p.measure}`, `- O que a curva prevê: ${p.prediction}`, `- O que o resultado decide: ${p.decides}`,
      `- O que fecha: ${p.closes.length ? p.closes.map((c) => `${c.name} (${c.label})`).join('; ') : 'nenhuma ressalva de ambiente'}`,
      `- Para a base lunar: ${p.lunar.text}`, `- Onde dá para fazer: ${p.platform}`)
    if (p.remains.length) L.push(`- O que continua em aberto: ${p.remains.join('; ')}`)
    if (p.check_first) L.push(`- Conferir antes: ${p.check_first}`)
    L.push(`- Fontes: ${p.sources.join('; ')}`)
  }
  L.push('', '---', 'As fichas apontam lacunas dos dados. Não substituem o desenho de experimento de uma equipe de combustão.')
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
  if (error) return <main className="page"><div className="page-in"><p className="hint bad">Não foi possível montar a fila: {error}</p></div></main>
  if (!q) return <main className="page"><div className="page-in"><p className="hint">Montando a fila…</p></div></main>
  if (!q.available) return <main className="page"><div className="page-in"><p className="hint">Os desfechos ainda não foram carregados no banco.</p></div></main>
  const cur = q.queue.find((p) => p.id === sel) ?? q.queue[0]
  const copy = () => navigator.clipboard?.writeText(md).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) }).catch(() => {})
  return (
    <main className="page fire">
      <div className="page-in">
        <header className="fire-head">
          <span className="eyebrow">O próximo fogo</span>
          <h1>O que a NASA precisa queimar em seguida</h1>
          <p className="dim">Os testes com sólidos param em 22% de oxigênio, a 14,7 psi e sem gravidade. Esta é a fila dos experimentos que mais encurtam a distância até a Lua e Marte, para o bastão de acrílico, que é o único com curva publicada.</p>
        </header>
        <div className="fire-now">
          {q.targets.map((t) => (
            <div key={t.habitat.id} className={t.gaps.length ? '' : 'ok'}>
              <b>{t.habitat.name}</b>
              <span>{t.gaps.length ? `${t.gaps.length} ressalvas na leitura` : 'dentro da faixa testada'}</span>
              <span>limite de O₂: {t.assessment.limit_o2[1] - t.assessment.limit_o2[0] < 0.1 ? `${nf(t.assessment.limit_o2[0], 1)}%` : `${nf(t.assessment.limit_o2[0], 1)}% a ${nf(t.assessment.limit_o2[1], 1)}%`}</span>
            </div>
          ))}
        </div>
        <div className="split fire-split">
          <ol className="fire-queue" aria-label="Fila de experimentos, do que mais ajuda para o que menos ajuda">
            {q.queue.map((p) => (
              <li key={p.id}>
                <button className="row" aria-current={p.id === cur.id} onClick={() => pick(p.id)}>
                  <span className="fire-rank">{p.rank}</span>
                  <span className="row-main"><b>{p.title}</b><span>{closesText(p)} · {stepsText(p)}{p.gain_o2 > 0 ? ` · tira ${nf(p.gain_o2, 1)} pontos de O₂ de faixa` : ''}</span></span>
                </button>
              </li>
            ))}
          </ol>
          <div ref={sheet} className="fire-sheet"><Sheet p={cur} band={q.band_o2} /></div>
        </div>
        <div className="actions no-print">
          <button className="cta" onClick={copy}>{copied ? 'Copiada' : 'Copiar a fila inteira'}</button>
          <button className="ghost" onClick={() => window.print()}>Imprimir esta ficha</button>
          <button className="ghost" onClick={() => { setStageView('limites'); setView('drive') }}>Ver a curva no mapa</button>
        </div>
        <p className="hint">Como a fila é ordenada: {q.method}</p>
        <p className="hint">As fichas apontam lacunas dos dados. Não substituem o desenho de experimento de uma equipe de combustão.</p>
      </div>
    </main>
  )
}
