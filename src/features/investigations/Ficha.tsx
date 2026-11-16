// Ficha de uma investigação: atributos, objetivo, documentos indexados e publicações.
import { useEffect, useState } from 'react'
import { api } from '../../api'
import { nf } from '../../lib/format'
import type { InvDetail } from '../../types'
import { attrs } from './attrs'

export function Ficha({ id }: { id: string }) {
  const [d, setD] = useState<InvDetail | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let live = true   // a slow answer for the previous investigation must not replace the one open now
    setD(null); setFailed(false)
    api.investigation(id).then((r) => { if (live) setD(r) }).catch(() => { if (live) setFailed(true) })
    return () => { live = false }
  }, [id])
  if (failed) return <div className="card"><p className="dim">Could not open this spec sheet. Select the investigation again to retry.</p></div>
  if (!d) return <div className="card"><p className="dim">Opening spec sheet…</p></div>
  const v = d.investigation
  return (
    <div className="card">
      <div className="sec-title"><h2>{v.name}</h2><span className="pill">{v.id}</span></div>
      <p className="dim">{v.title}</p>
      <p className="note">{v.priority_why}</p>
      <dl className="kv">{attrs(v).map(([k, val]) => (<span key={k} style={{ display: 'contents' }}><dt>{k}</dt><dd>{val}</dd></span>))}</dl>
      {d.objective && (<><h3>Objective</h3><p className="dim" style={{ maxWidth: '72ch' }}>{d.objective}</p></>)}
      {v.stats.constant?.length > 0 && (<><h3>What stayed the same in every test</h3><p className="dim">{v.stats.constant.join(' · ')}</p></>)}
      {d.documents.length > 0 && (<><h3>Indexed documents ({d.documents.length})</h3>
        <ul style={{ margin: 0, paddingLeft: 18 }} className="dim">{d.documents.slice(0, 8).map((x) => (<li key={x.file}>{x.title.split(' · ').pop()} <span className="faint">· {x.category} · {x.chunks} {x.chunks === 1 ? 'excerpt' : 'excerpts'}</span></li>))}</ul></>)}
      {d.publications.length > 0 && (<><h3>Publications ({d.publications.length})</h3>
        <ul style={{ margin: 0, paddingLeft: 18 }} className="dim">{d.publications.slice(0, 6).map((p, i) => (
          <li key={i}>{p.doi ? <a href={`https://doi.org/${p.doi}`} target="_blank" rel="noreferrer">{p.title}</a> : p.title}</li>))}</ul></>)}
      <p className="note">Source: NASA PSI catalog and experiment table{d.doi ? ` · DOI ${d.doi}` : ''} · {nf(v.total_gb, 1)} GB of raw data.</p>
    </div>
  )
}
