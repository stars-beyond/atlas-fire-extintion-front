// Cliente da API do Atlas: o objeto `api` reúne os módulos de cada domínio com os mesmos nomes de sempre.
import { ask, askStream, infer } from './ask'
import { external, investigation, investigations, meta, test, tests } from './catalog'
import { chart, csvUrl, datasets, records } from './datasets'
import { graph, insights, nextTests, rank, verdict } from './evidence'
import { assess, flammability, queue, simValidation } from './flammability'
import { predict, spread, thermal } from './predict'

export { API_BASE, apiUrl } from './client'

export const api = {
  meta, investigations, investigation, tests, test, external, verdict, rank, nextTests, ask, askStream, predict, spread, thermal, insights, infer, graph,
  flammability, queue, simValidation, assess, datasets, records, chart, csvUrl,
}
