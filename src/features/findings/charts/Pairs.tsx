// Achado "saffire_gravidade": as mesmas amostras em 0 g e em 1 g, lado a lado.
export function Pairs({ data }: { data: { sample: string; material: string; zero_g: string; one_g: string; outcome_0g: string }[] }) {
  return (
    <div className="tbl-wrap"><table>
      <thead><tr><th>Sample</th><th>Material</th><th style={{ color: 'var(--g0)' }}>At 0 g</th><th style={{ color: 'var(--g1)' }}>At 1 g</th></tr></thead>
      <tbody>{data.map((p) => (<tr key={p.sample}><td className="mono">{p.sample}</td><td>{p.material}</td>
        <td>{p.outcome_0g === 'extinguiu' ? 'barely burned' : 'burned'} <span className="faint">({p.zero_g})</span></td><td>{p.one_g.replace('1 g: ', '')}</td></tr>))}</tbody>
    </table></div>
  )
}
