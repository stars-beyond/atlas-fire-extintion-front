// English for the texts the Mission Fire Engine writes. The engine (live on the Atlas API, or the missions in
// public/story/) names its missions, habitats and events in Portuguese, while this screen is in English.
// Until the engine can answer in English, its texts are translated here, the same way api/catalog.ts does for the
// habitat names: a fixed table, keyed by the engine's sentence with every number replaced by "#". The numbers are
// put back in the same order (with a decimal point), so no value is ever rewritten by hand. A sentence the table
// does not know is shown as the engine wrote it; when the engine changes a text, add the new sentence here.
import { TIER, TIER_API_LABEL } from '../../lib/format'
import type { Mission, SimResult } from './mfe'

const NUM = /\d+(?:[.,]\d+)?/g

// whole texts and single sentences
const TEXT: Record<string, string> = {
  // places, habitats, hardware
  'Lua': 'Moon', 'Marte': 'Mars', 'Terra': 'Earth',
  'Nave em trânsito': 'Craft in transit', 'Base lunar': 'Lunar base', 'Rover pressurizado': 'Pressurized rover', 'Habitat de destino': 'Destination habitat',
  'Rack de aviônica': 'Avionics rack', 'PMMA (acrílico)': 'PMMA (acrylic)',
  'Tecido de algodão com fibra de vidro': 'Cotton and fiberglass fabric', 'Tecido retardante (hipotético)': 'Flame-retardant fabric (hypothetical)',
  // profiles
  'Terra → Lua': 'Earth → Moon', 'Terra → Marte (Hohmann)': 'Earth → Mars (Hohmann)', 'Mergulho a # UA (hipotético)': 'Dive to # AU (hypothetical)',
  'Trânsito de # dias em queda livre e # dias na superfície lunar.': 'A #-day transit in free fall and # days on the lunar surface.',
  'A distância ao Sol fica perto de # UA.': 'The distance to the Sun stays close to # AU.',
  'Transferência de Hohmann idealizada de # a # UA, seguida de estadia na superfície marciana.': 'Idealized Hohmann transfer from # to # AU, followed by a stay on the Martian surface.',
  'Elipse com afélio em # UA e periélio em # UA.': 'Ellipse with aphelion at # AU and perihelion at # AU.',
  'Nave tripulada hipotética, para estressar o controle térmico.': 'A hypothetical crewed craft, to stress the thermal control.',
  // missions
  'Jornada lunar · nave, base e rover': 'Lunar journey · craft, base and rover', 'Jornada lunar · segurança por ambiente': 'Lunar journey · safety by environment',
  'Terra → Marte com falhas encadeadas': 'Earth → Mars with chained failures', 'Terra → Marte com falhas': 'Earth → Mars with failures',
  'Mergulho a # UA, sem falhas': 'Dive to # AU, no failures', 'Mergulho a # UA': 'Dive to # AU',
  'Lua com atmosfera de #% O₂': 'Moon with a #% O₂ atmosphere', 'Lua, #% O₂': 'Moon, #% O₂',
  'Terra → Marte nominal': 'Earth → Mars, nominal',
  'Fuga térmica de bateria num módulo de # m³': 'Battery thermal runaway in a # m³ module', 'Bateria em fuga térmica, módulo de # m³': 'Battery in thermal runaway, # m³ module',
  'Trânsito a #%/# kPa; base e rover a #%/# kPa.': 'Transit at #%/# kPa; base and rover at #%/# kPa.',
  'Uma falha opcional de ventilação no trânsito ilustra a detecção.': 'An optional ventilation failure in transit illustrates detection.',
  'Regulador de O₂ travado (dia #), bomba degradada (dia #) e falha de ventilação (dia #).': 'O₂ regulator stuck (day #), degraded pump (day #) and ventilation failure (day #).',
  'Só a trajetória: a irradiância quadruplica e o controle térmico satura.': 'The trajectory alone: the irradiance quadruples and the thermal control saturates.',
  'Base lunar na atmosfera do enunciado, com falha de ventilação no dia #.': 'Lunar base in the atmosphere of the challenge statement, with a ventilation failure on day #.',
  'Linha de base, sem falhas.': 'Baseline, no failures.',
  'Oito células KULR #-K# em fuga térmica no dia #, num módulo com o volume livre do ATV do artigo da NASA.': 'Eight KULR #-K# cells in thermal runaway on day #, in a module with the free volume of the ATV in the NASA paper.',
  // event titles
  'Partida': 'Departure', 'Falha de ventilação': 'Ventilation failure',
  'Ventilação reduzida: investigar transporte até o detector': 'Reduced ventilation: check the transport to the detector',
  'Fora do domínio do modelo treinado': 'Outside the domain of the trained model',
  'Regulador de O₂ travado aberto': 'O₂ regulator stuck open', 'Válvula de alívio aberta': 'Relief valve open',
  'Tripulação isola o regulador de O₂': 'Crew isolates the O₂ regulator', 'Degradação da bomba do circuito térmico': 'Thermal loop pump degradation',
  'Controle térmico saturado': 'Thermal control saturated', 'Cabine acima de # °C': 'Cabin above # °C', 'Margem térmica abaixo de # K': 'Thermal margin below # K',
  'Protótipo lab#d: chama deixa de se sustentar': 'lab#d prototype: the flame stops sustaining itself',
  'Protótipo lab#d: chama passa a se sustentar': 'lab#d prototype: the flame starts sustaining itself',
  'Limite operacional excedido': 'Operating limit exceeded', 'Modelo treinado: propagação #× a nominal': 'Trained model: flame spread #× nominal',
  // event descriptions, sentence by sentence
  'Estado inicial em equilíbrio térmico a # UA.': 'Initial state in thermal equilibrium at # AU.',
  'Fim do trânsito em queda livre.': 'End of the transit in free fall.',
  'Gravidade efetiva passa a # g; a convecção natural volta a existir.': 'Effective gravity becomes # g; natural convection exists again.',
  'Ensaios tabulados de sólidos nesta condição: #; páginas que citam condição próxima: #.': 'Tabulated solid-fuel tests at this condition: #; pages citing a nearby condition: #.',
  'Hipótese do cenário: fração da vazão de ar perdida (#–#) = #.': 'Scenario assumption: fraction of the airflow lost (#–#) = #.',
  'Hipótese do cenário: vazão extra, em múltiplos do consumo da tripulação = #.': "Scenario assumption: extra flow, in multiples of the crew's consumption = #.",
  'Hipótese do cenário: sem magnitude = #.': 'Scenario assumption: no magnitude = #.',
  'Hipótese do cenário: fração da capacidade perdida (#–#) = #.': 'Scenario assumption: fraction of the capacity lost (#–#) = #.',
  'Perda hipotética de #% do fluxo; remova para uma missão nominal.': 'Hypothetical loss of #% of the airflow; remove it for a nominal mission.',
  'Válvula de suprimento presa aberta.': 'Supply valve stuck open.', 'A tripulação fecha a válvula manual.': 'The crew closes the manual valve.',
  'Fluxo caiu para # cm/s.': 'Airflow dropped to # cm/s.',
  'Em microgravidade, a fumaça depende do escoamento para chegar ao sensor.': 'In microgravity, smoke depends on the airflow to reach the sensor.',
  'SAME/SAME-R estudam partículas e resposta de detectores.': 'SAME/SAME-R study particles and detector response.',
  'Menor fluxo pode atrasar o transporte; não foi calculado tempo de alarme.': 'A lower airflow can delay the transport; no alarm time was computed.',
  'Condição na cabine: #% O₂, # kPa, # cm/s.': 'Cabin condition: #% O₂, # kPa, # cm/s.',
  'O Atlas foi treinado com #–# % de O₂, #–# kPa e #–# cm/s; aqui ele não devolve número em vez de extrapolar.': 'The Atlas model was trained with #–#% O₂, #–# kPa and #–# cm/s; here it returns no number instead of extrapolating.',
  'Outro ambiente a #% O₂ e # kPa.': 'Another environment, at #% O₂ and # kPa.',
  'Troca idealizada: controles restaurados; parâmetros térmicos e volume ilustrativos comuns.': 'Idealized switch: controls restored; illustrative thermal parameters and volume shared by the environments.',
  'Não modela a transição de pressão.': 'The pressure transition is not modeled.',
  'Pressão chegou a # kPa: o excesso de gás é ventilado; a fração de O₂ pode continuar subindo.': 'Pressure reached # kPa: the excess gas is vented; the O₂ fraction can keep rising.',
  'O circuito já rejeita o máximo possível; a cabine sobe acima do ajuste (# °C).': 'The loop already rejects as much heat as it can; the cabin rises above its set point (# °C).',
  'Cabine a # °C (limiar de conforto ilustrativo).': 'Cabin at # °C (illustrative comfort threshold).',
  'O limite é uma hipótese do usuário: perder margem não significa ignição.': 'The limit is a user assumption: losing margin does not mean ignition.',
  'Protótipo não calibrado.': 'Prototype not calibrated.',
  'O Atlas prevê a frente de chama a # mm/s (±# entre as redes) na amostra de referência de PMMA fino em microgravidade, contra # mm/s na atmosfera nominal da ISS.': 'The Atlas model predicts the flame front at # mm/s (±# between the networks) on the thin PMMA reference sample in microgravity, against # mm/s in the nominal ISS atmosphere.',
  'Índice de inflamabilidade do material de referência, não a propagação no componente nem probabilidade de incêndio.': 'A flammability index of the reference material, not the spread on the component nor a fire probability.',
  'Calor por célula no Battery Failure Databank: mediana # kJ, máximo # kJ (# ensaios com ejeção).': 'Heat per cell in the Battery Failure Databank: median # kJ, maximum # kJ (# tests with ejecta).',
  'Pico de pressão na cabine: # a # kPa (+# a +# kPa), gás a até # °C; a válvula de alívio abre.': 'Cabin pressure peak: # to # kPa (+# to +# kPa), gas at up to # °C; the relief valve opens.',
  'Pico de pressão na cabine: # a # kPa (+# a +# kPa), gás a até # °C.': 'Cabin pressure peak: # to # kPa (+# to +# kPa), gas at up to # °C.',
  'Nos ensaios com aquecedor, a célula disparou com cerca de # °C (rampa rápida, não é um limiar para aquecimento lento); o componente simulado estava a # °C.': 'In the heater tests the cell went into runaway at about # °C (a fast ramp, not a threshold for slow heating); the simulated component was at # °C.',
}

// the evidence levels, by the name the engine gives them
const TIER_EN: Record<string, string> = Object.fromEntries((Object.keys(TIER) as (keyof typeof TIER)[]).map((t) => [TIER_API_LABEL[t], TIER[t].label]))

// sentences that carry a name (a place, a habitat, a component): the name is translated on its own
const N = '(\\d+(?:[.,]\\d+)?)'
const dot = (n: string) => n.replace(',', '.')
const RULES: [RegExp, (m: RegExpExecArray) => string][] = [
  [/^Chegada: (.+)$/, (m) => `Arrival: ${text(m[1])}`],
  [/^Entrada: (.+)$/, (m) => `Entering: ${text(m[1])}`],
  [/^Evidência: (.+) → (.+)$/, (m) => `Evidence: ${TIER_EN[m[1]] ?? m[1]} → ${TIER_EN[m[2]] ?? m[2]}`],
  [/^Fuga térmica de bateria: (\d+) × (.+)$/, (m) => `Battery thermal runaway: ${m[1]} × ${m[2]}`],
  [/^Hipótese do cenário: (\d+) célula\(s\) (.+) em fuga térmica \(defeito interno declarado, o motor não prevê o disparo\)\.$/,
    (m) => `Scenario assumption: ${m[1]} ${m[2]} cell(s) in thermal runaway (a declared internal defect; the engine does not predict the trigger).`],
  [new RegExp(`^([^;:,.]+) a ${N} °C; limite operacional declarado ${N} °C\\.$`), (m) => `${text(m[1])} at ${dot(m[2])} °C; declared operating limit ${dot(m[3])} °C.`],
  [new RegExp(`^([^;:,.]+) a ${N} °C\\.$`), (m) => `${text(m[1])} at ${dot(m[2])} °C.`],
  [new RegExp(`^Fronteira do protótipo para (.+): O₂ mínimo ${N}% com escoamento efetivo de ${N} cm/s; cabine a ${N}%\\.$`),
    (m) => `Prototype boundary for ${text(m[1])}: minimum O₂ ${dot(m[2])}% with an effective airflow of ${dot(m[3])} cm/s; cabin at ${dot(m[4])}%.`],
]

// one sentence (or a title, or a name): the table first, then the rules; null when neither knows it
function known(s: string): string | null {
  const nums = s.match(NUM) ?? []
  const key = s.replace(NUM, '#')
  // a name can end a sentence ("Terra → Lua."): the table has it without the full stop
  const hit = TEXT[key] ?? (key.endsWith('.') && TEXT[key.slice(0, -1)] !== undefined ? TEXT[key.slice(0, -1)] + '.' : undefined)
  if (hit !== undefined) { let i = 0; return hit.replace(/#/g, () => dot(nums[i++] ?? '')) }
  for (const [re, f] of RULES) { const m = re.exec(s); if (m) return f(m) }
  return null
}

/** The engine's text in English. Whatever is not in the table stays as the engine wrote it. */
export function text(s: string): string
export function text(s: string | null | undefined): string | null | undefined
export function text(s: string | null | undefined) {
  if (!s) return s
  // sentence by sentence; a full stop only ends a sentence when a space follows it ("2.0×" is not split)
  return s.replace(/([.!?])\s+/g, '$1\u0000').split('\u0000').map((part) => known(part) ?? part).join(' ')
}

export const localizeMission = (m: Mission): Mission => ({ ...m, name: text(m.name), description: text(m.description) })

// Only what is shown on screen is rewritten. `phase` and the ids are codes the scene reads, so they stay as they
// are; `habitat` is both shown and compared with itself (scene.ts), and every sample goes through the same table.
export function localizeResult(r: SimResult): SimResult {
  const component = r.config.spacecraft.component
  return {
    ...r, label: text(r.label),
    profile: { ...r.profile, name: text(r.profile.name), description: text(r.profile.description), destination: text(r.profile.destination) ?? null },
    series: { ...r.series, habitat: r.series.habitat.map((h) => text(h)) },
    events: r.events.map((e) => ({ ...e, title: text(e.title), description: text(e.description) })),
    config: { ...r.config, label: text(r.config.label), spacecraft: { ...r.config.spacecraft, component: { ...component, name: text(component.name) } } },
  }
}
