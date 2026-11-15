// Moldura comum dos gráficos dos achados: o SVG de largura fixa e a escala linear.
export const Wd = 520
export function Frame({ h, children, label }: { h: number; children: React.ReactNode; label: string }) {
  return <svg className="chart" viewBox={`0 0 ${Wd} ${h}`} width="100%" role="img" aria-label={label}>{children}</svg>
}
export const lin = (d0: number, d1: number, r0: number, r1: number) => (v: number) => r0 + ((v - d0) / (d1 - d0)) * (r1 - r0)
