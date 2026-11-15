// O cenário que a pessoa monta no configurador: atmosfera, gravidade e o que pode pegar fogo.

export type Family = 'solido' | 'gota' | 'gas' | 'todas'

export interface Scenario { o2: number; pressure_atm: number; gravity: number; family: Family; material: string; habitat?: string }
