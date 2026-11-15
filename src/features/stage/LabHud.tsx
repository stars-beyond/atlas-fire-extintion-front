// Leitura da chama simulada no canto do palco: acendendo, queimando ou sem chama, e quanto calor libera.
import { nf, pct } from '../../lib/format'
import { useLab } from '../../state'

export function LabHud() {
  const lab = useLab()
  if (!lab || !lab.lit) return null
  const label = lab.igniting ? 'Acendendo' : lab.burning ? 'Queimando' : lab.measured ? 'Sem chama' : 'Medindo'
  return (
    <div className={`lab-hud${lab.burning ? ' on' : ''}`} role="status">
      <b>{label}</b>
      {lab.burning && <span>≈ {nf(lab.hrr, 0)} W de calor</span>}
      {lab.agent > 0.005 && <span>{pct(lab.agent)} de {lab.agentKey === 'He' ? 'hélio' : 'CO₂'} no ar</span>}
    </div>
  )
}
