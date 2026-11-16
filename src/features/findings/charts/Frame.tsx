// Moldura comum dos gráficos dos achados: o SVG de largura fixa e a escala linear.
export const Wd = 520
export function Frame({ h, children, label }: { h: number; children: React.ReactNode; label: string }) {
  return <svg className="chart" viewBox={`0 0 ${Wd} ${h}`} width="100%" role="img" aria-label={label}>{children}</svg>
}
export { lin } from '../../../lib/scale'
