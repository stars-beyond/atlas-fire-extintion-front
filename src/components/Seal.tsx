import { TIER } from '../lib/format'
import type { Tier } from '../types'

// O selo de evidência: o único elemento que muda de forma além de cor (cheio, meio, um quarto, hachurado).
export function Seal({ tier, big, sub }: { tier: Tier; big?: boolean; sub?: string }) {
  return (
    <span className={`seal t-${tier}${big ? ' big' : ''}`} role="img" aria-label={`Evidence level: ${TIER[tier].label}`}>
      <span className="seal-glyph" />
      <span>
        <span className="seal-label" style={{ display: 'block' }}>{TIER[tier].label}</span>
        <span className="seal-sub">{sub ?? TIER[tier].short}</span>
      </span>
    </span>
  )
}
