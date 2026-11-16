// Scales for the hand-drawn SVG charts: a value of the domain [d0, d1] placed on the pixel range [r0, r1].
export const lin = (d0: number, d1: number, r0: number, r1: number) => (v: number) => r0 + ((v - d0) / (d1 - d0)) * (r1 - r0)
export const logScale = (d0: number, d1: number, r0: number, r1: number) => (v: number) => r0 + ((Math.log(v) - Math.log(d0)) / (Math.log(d1) - Math.log(d0))) * (r1 - r0)
