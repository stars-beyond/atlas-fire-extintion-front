// Expedições: o ranking das investigações para o cenário, a ficha de cada uma e a comparação lado a lado.
import { useEffect, useMemo, useState } from 'react'
import { FAMILY, ROLE, api, gLabel, nf, pct, psi, type InvDetail, type Investigation } from '../api'
import { useAtlas } from '../store'

const PART: [keyof import('../api').Ranked['parts'], string, string][] = [
  ['proximidade', 'Proximidade das condições testadas', 'var(--g0)'], ['relevancia', 'Relevância do texto para o cenário', 'var(--gas)'],
  ['dados', 'Dados tabelados (O₂, pressão, desfecho)', 'var(--gota)'], ['enunciado', 'Papel descrito no enunciado', 'var(--solido)'],
]
const range = (r: [number, number] | null | undefined, f: (v: number) => string) => (r ? (r[0] === r[1] ? f(r[0]) : `${f(r[0])} a ${f(r[1])}`) : 'não tabelado')

function attrs(v: Investigation): [string, string][] {
  const s = v.stats
  return [
    ['Papel na segurança', ROLE[v.role]], ['Combustível', FAMILY[v.family]], ['Equipamento', v.hardware_family],
    ['Oxigênio', range(s.o2 ?? s.declared?.o2 ?? null, (x) => pct(x))],
    ['Pressão', s.pressure_assumed && !s.pressure_atm ? 'cabine (assumida)' : range(s.pressure_atm ?? s.declared?.pressure_atm ?? null, psi)],
    ['Gravidade', s.gravity?.length ? s.gravity.map(gLabel).join(' e ') : '0 g'],
    ['Fluxo de ar', range(s.flow_cm_s, (x) => nf(x, 0) + ' cm/s')],
    ['Desfecho tabelado', s.has_outcome ? 'sim' : 'não'],
    ['Combustíveis ou materiais', s.fuels?.slice(0, 4).join(', ') || '–'],
    ['O que variou entre os testes', s.varies?.slice(0, 5).join(', ') || '–'],
    ['Medições', s.measurements?.slice(0, 6).join(', ') || '–'],
    ['Linhas tabeladas', nf(s.n_tests)], ['Período', v.start_year ? `${v.start_year}–${v.end_year ?? ''}` : '–'],
  ]
}

function Ficha({ id }: { id: string }) {
  const [d, setD] = useState<InvDetail | null>(null)
  useEffect(() => { setD(null); api.investigation(id).then(setD).catch(() => {}) }, [id])
  if (!d) return <div className="card"><p className="dim">Abrindo a ficha…</p></div>
  const v = d.investigation
  return (
    <div className="card">
      <div className="sec-title"><h2>{v.name}</h2><span className="pill">{v.id}</span></div>
      <p className="dim">{v.title}</p>
      <p className="note">{v.priority_why}</p>
      <dl className="kv">{attrs(v).map(([k, val]) => (<span key={k} style={{ display: 'contents' }}><dt>{k}</dt><dd>{val}</dd></span>))}</dl>
      {d.objective && (<><h3>Objetivo</h3><p className="dim" style={{ maxWidth: '72ch' }}>{d.objective}</p></>)}
      {v.stats.constant?.length > 0 && (<><h3>O que ficou igual em todos os testes</h3><p className="dim">{v.stats.constant.join(' · ')}</p></>)}
      {d.documents.length > 0 && (<><h3>Documentos indexados ({d.documents.length})</h3>
        <ul style={{ margin: 0, paddingLeft: 18 }} className="dim">{d.documents.slice(0, 8).map((x) => (<li key={x.file}>{x.title.split(' · ').pop()} <span className="faint">· {x.category} · {x.chunks} trechos</span></li>))}</ul></>)}
      {d.publications.length > 0 && (<><h3>Publicações ({d.publications.length})</h3>
        <ul style={{ margin: 0, paddingLeft: 18 }} className="dim">{d.publications.slice(0, 6).map((p, i) => (
          <li key={i}>{p.doi ? <a href={`https://doi.org/${p.doi}`} target="_blank" rel="noreferrer">{p.title}</a> : p.title}</li>))}</ul></>)}
      <p className="note">Fonte: catálogo e tabela experimental do NASA PSI{d.doi ? ` · DOI ${d.doi}` : ''} · {nf(v.total_gb, 1)} GB de dados brutos.</p>
    </div>
  )
}

function Compare({ a, b }: { a: Investigation; b: Investigation }) {
  const A = attrs(a), B = attrs(b)
  return (
    <div className="card">
      <h2>{a.name} e {b.name}, lado a lado</h2>
      <div className="tbl-wrap"><table>
        <thead><tr><th>Atributo</th><th>{a.name}</th><th>{b.name}</th><th /></tr></thead>
        <tbody>{A.map(([k, va], i) => { const vb = B[i][1]; const eq = va === vb; return (
          <tr key={k}><td className="dim">{k}</td><td>{va}</td><td>{vb}</td><td className={eq ? 'same' : 'diff'}>{eq ? 'igual' : 'diferente'}</td></tr>) })}</tbody>
      </table></div>
    </div>
  )
}

export function Expedicoes() {
  const { ranking, invs, scenario, selectedInv, selectInv, meta } = useAtlas()
  const [cmp, setCmp] = useState<string[]>([])
  const byId = useMemo(() => new Map(invs.map((v) => [v.id, v])), [invs])
  const sel = selectedInv ?? ranking[0]?.id
  const toggle = (id: string) => setCmp((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c.slice(-1), id]))
  const pair = cmp.length === 2 ? [byId.get(cmp[0]), byId.get(cmp[1])] : null
  return (
    <main className="page"><div className="page-in">
      <div style={{ display: 'grid', gap: 8 }}>
        <span className="cap">Expedições · ranking para a sonda</span>
        <h1>Quais investigações importam para {pct(scenario.o2)} de O₂ a {psi(scenario.pressure_atm)} em {gLabel(scenario.gravity)}</h1>
        <p className="lede">A ordem muda com o cenário. Cada barra mostra de onde vem a nota: condições testadas perto da sonda, texto da investigação, dados tabelados e o papel que o enunciado do desafio dá a ela.</p>
        <div className="badges">{PART.map(([k, l, c]) => (<span key={k} className="pill"><i className="swatch" style={{ background: c }} />{l} · {nf((meta?.weights[k] ?? 0) * 100)}%</span>))}</div>
      </div>
      <div className="split">
        <div className="tbl-wrap"><table>
          <thead><tr><th>#</th><th>Investigação</th><th>Papel</th><th>Nota</th><th className="num">Testes</th><th>O₂ testado</th><th>Comparar</th></tr></thead>
          <tbody>{ranking.map((r, i) => { const v = byId.get(r.id); if (!v) return null; return (
            <tr key={r.id} className={`click${sel === r.id ? ' sel' : ''}`} onClick={() => selectInv(r.id)}>
              <td className="mono faint">{i + 1}</td>
              <td><b>{r.name}</b><div className="faint" style={{ fontSize: 11.5 }}>{FAMILY[v.family]} · {v.hardware_family}</div></td>
              <td>{ROLE[r.role]}</td>
              <td><div className="scorebar" title={r.reason}>{PART.map(([k, , c]) => (<i key={k} style={{ width: `${r.parts[k] * (meta?.weights[k] ?? 0.25) * 100}%`, background: c }} />))}</div><span className="mono faint">{nf(r.score * 100)}</span></td>
              <td className="num">{nf(v.stats.n_tests)}</td>
              <td className="mono">{range(v.stats.o2 ?? v.stats.declared?.o2 ?? null, (x) => pct(x))}</td>
              <td><input type="checkbox" checked={cmp.includes(r.id)} onChange={() => toggle(r.id)} onClick={(e) => e.stopPropagation()} aria-label={`Comparar ${r.name}`} /></td>
            </tr>) })}</tbody>
        </table></div>
        <div style={{ display: 'grid', gap: 16 }}>
          {pair && pair[0] && pair[1] ? <Compare a={pair[0]} b={pair[1]} /> : <p className="note">Marque duas investigações na coluna Comparar para ver o que têm de igual e de diferente.</p>}
          {sel && <Ficha id={sel} />}
        </div>
      </div>
    </div></main>
  )
}
