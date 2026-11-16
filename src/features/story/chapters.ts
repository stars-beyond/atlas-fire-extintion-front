// Roteiro do modo história (portado do mission-fire-engine): capítulos derivados só da simulação devolvida pelo motor.
// Nenhum número é inventado aqui; o texto apenas encadeia valores da série, dos eventos e do resumo.
// Títulos e descrições de eventos e de perfis vêm do motor como ele os escreve.
import type { MissionEvent, Severity, SimResult, Tier } from './mfe'
import type { CameraMode } from './scene'
import { CLASS_LABEL, TIER_LABEL, celsius, gravity, indexAt, mlRatioText, mlTone, num } from './format'

export interface Fact { label: string; value: string; tone?: 'ok' | 'warn' | 'crit' }

export interface Chapter {
  id: string
  index: number            // amostra da série onde o capítulo acontece
  kicker: string
  title: string
  body: string
  facts: Fact[]
  notes: string[]          // eventos agrupados no mesmo momento
  tag?: string             // natureza da afirmação: calculado, hipótese, evidência…
  severity?: Severity
  event?: MissionEvent
  camera: CameraMode
  question: string         // pergunta padrão ao RAG do Atlas neste momento
  flame?: { o2: number; p: number; flow: number }   // condição para a chama prevista pelo Atlas (só no domínio)
}

const SEV_RANK: Record<Severity, number> = { critico: 2, atencao: 1, info: 0 }

function tierTone(t: Tier): Fact['tone'] {
  return t === 'medido' ? 'ok' : t === 'sem_evidencia' ? 'crit' : t === 'parcial' ? 'warn' : undefined
}

function stateFacts(r: SimResult, i: number): Fact[] {
  const s = r.series, m = s.margin_k[i]
  const facts: Fact[] = []
  if (r.profile.id !== 'terra-lua') facts.push({ label: 'Distance to the Sun', value: `${num(s.r_au[i], 3)} AU` })
  facts.push(
    { label: 'O₂ · pressure', value: `${num(s.oxygen_pct[i], 1)}% · ${num(s.pressure_kpa[i], 1)} kPa` },
    { label: 'Thermal margin', value: `${num(m, 1)} K`, tone: m < 0 ? 'crit' : m < 10 ? 'warn' : undefined },
    { label: 'Evidence', value: TIER_LABEL[s.evidence_tier[i]], tone: tierTone(s.evidence_tier[i]) },
  )
  if (s.ml_spread_ratio) {
    const gap = s.evidence_tier[i] === 'sem_evidencia' || s.evidence_tier[i] === 'parcial'
    facts.push({ label: gap && s.ml_spread_ratio[i] != null ? 'Flame spread · model prediction' : 'Flame spread (model)',
      value: mlRatioText(s.ml_spread_ratio[i], s.ml_domain?.[i]), tone: mlTone(s.ml_spread_ratio[i]) })
  }
  return facts
}

export function buildChapters(r: SimResult): Chapter[] {
  const s = r.series, n = s.t_day.length, sc = r.config.spacecraft
  const lunar = r.profile.id === 'terra-lua'
  const transit = r.profile.transit_days
  const arrival = indexAt(s.t_day, transit)
  const dest = r.profile.destination ?? `${num(s.r_au[n - 1], 2)} AU from the Sun`
  const out: Chapter[] = []

  out.push({
    id: 'partida', index: 0, camera: 'system', kicker: 'Chapter 1 · Day 0', title: 'Departure',
    body: `${r.label}. ${sc.crew} crew on board, cabin at ${num(s.oxygen_pct[0], 1)}% O₂ and ${num(s.pressure_kpa[0], 1)} kPa. `
      + `${r.profile.description} The mission lasts ${num(s.t_day[n - 1], 0)} days; the question is not whether there will be a fire, but what science knows at each stretch of the way.`,
    facts: [
      { label: 'Transit', value: `${num(transit, 1)} days` },
      { label: 'Destination', value: dest },
      { label: 'Watched component', value: `${sc.component.name}, limit ${celsius(sc.component.operational_limit_k, 0)}` },
    ],
    notes: [], tag: CLASS_LABEL.configuracao,
    question: 'For a cabin with this atmosphere, what are the main fire safety concerns at the start of a mission, and which NASA investigations support them?',
  })

  const early = indexAt(s.t_day, Math.min(transit * 0.12, s.t_day[n - 1] * 0.08))
  out.push({
    id: 'queda-livre', index: Math.max(1, early), camera: 'cinematic', kicker: `Day ${num(s.t_day[early], 1)}`, title: 'In free fall',
    body: 'With no effective gravity, hot air does not rise: there is no natural convection to feed the flame or to carry smoke to the detector. '
      + `Ventilation takes that role, here at ${num(s.ventilation_cm_s[early], 0)} cm/s. `
      + (lunar ? 'On the way to the Moon, the distance to the Sun stays close to 1 AU.' : `At ${num(s.r_au[early], 3)} AU from the Sun, the external irradiance is ${num(s.solar_flux_w_m2[early], 0)} W/m².`),
    facts: [{ label: 'Gravity', value: gravity(s.gravity_g[early]) }, ...stateFacts(r, early)],
    notes: [], tag: CLASS_LABEL.calculado,
    question: 'How does the absence of natural convection in microgravity change how a flame behaves and how smoke is detected? Which tests measured this?',
  })

  // eventos: agrupa o que acontece em poucos dias e mantém os momentos mais graves
  const evs = r.events.filter((e) => e.kind !== 'fase' && e.severity !== 'info').sort((a, b) => a.day - b.day)
  const clusters: MissionEvent[][] = []
  for (const e of evs) {
    const last = clusters[clusters.length - 1]
    if (last && e.day - last[0].day <= 4) last.push(e)
    else clusters.push([e])
  }
  const lead = (c: MissionEvent[]) => [...c].sort((a, b) => SEV_RANK[b.severity] - SEV_RANK[a.severity] || a.day - b.day)
    .find((e) => e.kind !== 'chama' && e.kind !== 'evidencia') ?? c[0]
  const chosen = clusters
    .map((c) => ({ c, score: Math.max(...c.map((e) => SEV_RANK[e.severity])) * 10 + c.length }))
    .sort((a, b) => b.score - a.score).slice(0, 5)
    .sort((a, b) => a.c[0].day - b.c[0].day)
  for (const { c } of chosen) {
    const e = lead(c), i = indexAt(s.t_day, e.day)
    if (i >= arrival && !lunar && Math.abs(e.day - transit) < 1) continue   // a chegada tem capítulo próprio
    const worst = c.reduce((a, b) => (SEV_RANK[b.severity] > SEV_RANK[a.severity] ? b : a))
    out.push({
      id: `ev-${e.id}`, index: i, camera: 'cinematic', event: e, severity: worst.severity,
      kicker: `Day ${num(e.day, 1)}`, title: e.title, body: e.description,
      facts: stateFacts(r, i), tag: CLASS_LABEL[e.classification] ?? e.classification,
      notes: c.filter((x) => x !== e).map((x) => `Day ${num(x.day, 1)} · ${x.title}`),
      question: `At this point of the mission: "${e.title}". What does NASA's experimental evidence say about fire risk under these conditions, and where are the limits of what is known?`,
    })
  }

  // o ponto mais quente, se nenhum evento já cair perto dele
  const hot = s.margin_k.reduce((b, v, k) => (v < s.margin_k[b] ? k : b), 0)
  if (!out.some((c) => Math.abs(s.t_day[c.index] - s.t_day[hot]) < 3)) {
    const m = s.margin_k[hot]
    out.push({
      id: 'mais-quente', index: hot, camera: 'cinematic', kicker: `Day ${num(s.t_day[hot], 1)}`, title: 'The hottest point',
      body: `${sc.component.name} reaches ${celsius(s.component_k[hot])}, ${num(m, 1)} K from its declared operating limit. `
        + 'A thermal margin is a comparison with an operating limit, not a validated ignition threshold.',
      facts: stateFacts(r, hot), tag: CLASS_LABEL.calculado, notes: [], severity: m < 0 ? 'critico' : m < 10 ? 'atencao' : undefined,
      question: `An electronic component reaches ${celsius(s.component_k[hot])} in a cabin at ${num(s.oxygen_pct[hot], 1)}% O₂. What is known about material heating and ignition in microgravity?`,
    })
  }

  if (arrival < n - 1) {
    const after = Math.min(arrival + 1, n - 1)
    out.push({
      id: 'chegada', index: arrival, camera: 'cinematic', kicker: `Day ${num(s.t_day[arrival], 1)}`, title: `Arrival: ${r.profile.destination ?? 'destination'}`,
      body: `Gravity becomes ${gravity(s.gravity_g[after])}. Tests in microgravity and at 1 g do not replace measurements in partial gravity: `
        + `here the local evidence is "${TIER_LABEL[s.evidence_tier[after]]}".`,
      facts: stateFacts(r, after), tag: CLASS_LABEL.evidencia, notes: [],
      question: `Arriving at ${r.profile.destination ?? 'the destination'} (partial gravity of ${num(s.gravity_g[after], 3)} g), what data exist on combustion in partial gravity, and what are the limits of extrapolating to it?`,
    })
  }

  out.sort((a, b) => a.index - b.index)

  const share = r.summary.evidence_share
  const pct = (t: Tier) => `${num((share[t] ?? 0) * 100, 0)}%`
  out.push({
    id: 'epilogo', index: n - 1, camera: 'top', kicker: 'Epilogue', title: 'What we know, and what we do not',
    body: `For ${pct('medido')} of the mission there was a tabulated solids test in the same atmosphere and gravity. `
      + `For ${pct('sem_evidencia')} of the time the craft was "${TIER_LABEL.sem_evidencia}": no comparable measurement. `
      + 'That map of gaps is the result: where the next investigation would make the most difference.',
    facts: (['medido', 'delimitado', 'parcial', 'sem_evidencia'] as Tier[]).map((t) => ({ label: TIER_LABEL[t], value: pct(t), tone: tierTone(t) })),
    notes: [`Hours with the component above its limit: ${num(r.summary.hours_over_limit, 0)} h`, `Outside the tabulated tests: ${num(r.summary.hours_outside_tabulated / 24, 1)} days`,
      ...(r.summary.ml_spread_max_ratio != null
        ? [`Trained model (Atlas): flame spread up to ${num(r.summary.ml_spread_max_ratio, 2)}× nominal on day ${num(r.summary.ml_spread_max_day ?? NaN, 1)}; `
          + `${num((r.summary.hours_ml_in_domain ?? 0) / 24, 1)} days inside the training domain. A model prediction for thin PMMA in µg, not a measurement.`]
        : [])],
    tag: CLASS_LABEL.evidencia,
    question: 'What are the biggest gaps in experimental combustion data for missions with partial gravity and oxygen-enriched atmospheres, and which future investigations would fill them?',
  })

  return out.map((c, k) => {
    const flame = c.id !== 'epilogo' && s.ml_spread_ratio?.[c.index] != null
      ? { o2: s.oxygen_pct[c.index], p: s.pressure_kpa[c.index], flow: s.ventilation_cm_s[c.index] } : undefined
    return { ...c, flame, kicker: k === 0 || c.id === 'epilogo' ? c.kicker : `Chapter ${k + 1} · ${c.kicker}` }
  })
}
