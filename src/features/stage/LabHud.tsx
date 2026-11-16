// Leitura da chama simulada no canto do palco: acendendo, queimando ou sem chama, e quanto calor libera.
import { nf, pct } from '../../lib/format'
import { useLab } from '../../state'

export function LabHud() {
  const lab = useLab()
  if (!lab || !lab.lit) return null
  const label = lab.igniting ? 'Igniting' : lab.burning ? 'Burning' : lab.measured ? 'No flame' : 'Measuring'
  return (
    <div className={`lab-hud${lab.burning ? ' on' : ''}`} role="status">
      <b>{label}</b>
      {lab.burning && <span>≈ {nf(lab.hrr, 0)} W of heat</span>}
      {lab.agent > 0.005 && <span>{pct(lab.agent)} {lab.agentKey === 'He' ? 'helium' : 'CO₂'} in the air</span>}
    </div>
  )
}
