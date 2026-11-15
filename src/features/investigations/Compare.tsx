// Duas investigações lado a lado: o que têm de igual e de diferente.
import type { Investigation } from '../../types'
import { attrs } from './attrs'

export function Compare({ a, b }: { a: Investigation; b: Investigation }) {
  const A = attrs(a), B = attrs(b)
  return (
    <div className="card">
      <h2>{a.name} and {b.name}, side by side</h2>
      <div className="tbl-wrap"><table>
        <thead><tr><th>Attribute</th><th>{a.name}</th><th>{b.name}</th><th /></tr></thead>
        <tbody>{A.map(([k, va], i) => { const vb = B[i][1]; const eq = va === vb; return (
          <tr key={k}><td className="dim">{k}</td><td>{va}</td><td>{vb}</td><td className={eq ? 'same' : 'diff'}>{eq ? 'same' : 'different'}</td></tr>) })}</tbody>
      </table></div>
    </div>
  )
}
