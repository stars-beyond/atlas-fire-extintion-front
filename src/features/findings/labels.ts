// Codes the API uses in the FLEX finding (/api/insights, "flex_desfecho"), with the label and colour shown.
// One table for the Findings page chart and for the dashboard chart, so the two never disagree.

// how the burn ended: [code, label, colour], in the order the stacked bars are drawn
export const FLEX_END: [string, string, string][] = [['extinguiu', 'Went out', 'var(--g0)'], ['disrupcao', 'Droplet burst', 'var(--gas)'], ['queimou', 'Burned to completion', 'var(--g1)']]
// diluent codes as the API sends them in the points
export const FLEX_DILUENT: Record<string, { label: string; color: string }> = { 'só N₂': { label: 'N₂ only', color: 'var(--dim)' }, 'com CO₂': { label: 'with CO₂', color: 'var(--g0)' }, 'com He': { label: 'with He', color: 'var(--g1)' } }
