// Passo 2 do configurador: escolher o que pode pegar fogo.
import { useMemo } from 'react'
import { nf } from '../../lib/format'
import { MATERIALS, materialOf, useAtlas } from '../../state'

export function MaterialStep() {
  const { scenario, setScenario, tests } = useAtlas()
  const cur = materialOf(scenario)
  const counts = useMemo(() => {
    const m = new Map<string, number>()
    for (const t of tests) {
      if (t.o2 == null || t.p == null) continue
      const key = t.family === 'solido' ? (t.material ?? '') : t.family
      m.set(key, (m.get(key) ?? 0) + 1)
    }
    return m
  }, [tests])
  return (
    <div className="step">
      <header className="step-head">
        <span className="eyebrow">Passo 2 de 4</span>
        <h1>O que pode pegar fogo lá dentro?</h1>
        <p>Tecidos e plásticos são o combustível de um incêndio real numa nave. Escolha um para testar.</p>
      </header>
      <div className="options">
        {MATERIALS.map((m) => {
          const n = counts.get(m.family === 'solido' ? m.material : m.family) ?? 0
          return (
            <button key={m.id} className="option" aria-pressed={cur.id === m.id} onClick={() => setScenario({ family: m.family, material: m.material })}>
              <span className="swatch-lg" style={{ background: m.tint }} />
              <span className="option-name">{m.name}</span>
              <span className="option-sub">{m.sub}</span>
              <span className="option-spec">{nf(n)} {n === 1 ? 'teste da NASA' : 'testes da NASA'}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
