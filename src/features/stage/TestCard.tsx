// Cartão do teste selecionado (no mapa, no grafo ou numa citação): o que queimou, em que ar, e de onde vem o dado.
import { useEffect, useState } from 'react'
import { api } from '../../api'
import { FAMILY, OUTCOME, gLabel, nf, pct, psi } from '../../lib/format'
import { useAtlas } from '../../state'
import type { TestDetail } from '../../types'

export function TestCard() {
  const { selectedTest, selectTest } = useAtlas()
  const [d, setD] = useState<TestDetail | null>(null)
  useEffect(() => { setD(null); if (selectedTest) api.test(selectedTest).then(setD).catch(() => {}) }, [selectedTest])
  if (!selectedTest || !d) return null
  const t = d.test
  const mx = d.metrics || {}
  const fromReport = !!mx.outcome_source && !!mx.end
  const result = fromReport && t.outcome_raw
    ? t.outcome_raw.charAt(0).toUpperCase() + t.outcome_raw.slice(1) + (mx.limit_flow_cm_s != null ? `, com vento de ${mx.limit_flow_cm_s < 2 && mx.end === 'quench' ? 'menos de 2' : nf(mx.limit_flow_cm_s, mx.limit_flow_cm_s < 10 ? 1 : 0)} cm/s` : '')
    : `${OUTCOME[t.outcome]}${t.outcome_raw ? ` (${t.outcome_raw})` : ''}`
  return (
    <aside className="test-card" aria-label="Teste selecionado">
      <header><b>{d.investigation} · {t.label}</b><button className="x" onClick={() => selectTest(null)} aria-label="Fechar">×</button></header>
      <dl>
        <dt>O que queimou</dt><dd>{t.fuel || FAMILY[t.family]}</dd>
        <dt>Atmosfera</dt><dd>{t.o2 != null ? pct(t.o2, 1) : '–'} de O₂ · {t.pressure_atm != null ? psi(t.pressure_atm) : 'pressão não tabelada'} · {gLabel(t.gravity)}</dd>
        <dt>Resultado</dt><dd>{result}</dd>
        {fromReport && mx.comments && (<><dt>O que o relatório da NASA diz</dt><dd className="quote" lang="en">“{mx.comments}”</dd></>)}
        <dt>De onde vem</dt><dd className="mono">{fromReport ? `${mx.outcome_source} · ` : ''}{d.source}</dd>
      </dl>
    </aside>
  )
}
