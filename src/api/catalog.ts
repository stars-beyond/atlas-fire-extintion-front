// API do acervo: metadados, investigações e testes.
import type { InvDetail, Investigation, Meta, Test, TestDetail } from '../types'
import { j } from './client'

export const meta = () => j<Meta>('/meta')
export const investigations = () => j<Investigation[]>('/investigations')
export const investigation = (id: string) => j<InvDetail>('/investigations/' + encodeURIComponent(id))
export const tests = async (): Promise<Test[]> => {
  const d = await j<{ columns: string[]; rows: any[][] }>('/tests')
  return d.rows.map((r) => Object.fromEntries(d.columns.map((c, i) => [c, r[i]])) as unknown as Test)
}
export const test = (id: string) => j<TestDetail>('/tests/' + encodeURIComponent(id))
