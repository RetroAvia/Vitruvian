/**
 * Collegamento allenamento ↔ misurazioni: proporzioni, asimmetrie, crescita
 * delle circonferenze e analisi dei punti forti e carenti, con gli esercizi
 * su cui concentrarsi. Le proporzioni "classiche" sono indicative: servono a
 * capire quali distretti sono indietro rispetto agli altri, non a giudicare.
 */
import { daysBetween, formatNumber, formatSigned, isNum } from "@/lib/format"
import type { Checkup } from "@/types/domain"

import { EXERCISES, FOCUS_EXERCISES, MUSCLES, SMALL_MUSCLES, VOLUME_ZONES, type Muscle } from "./catalog"
import type { ExerciseProgress, LoggedVolume, PlanVolume } from "./analysis"

/* ------------------------------ Circonferenze ------------------------------ */

export type SiteValues = Record<string, number>

/** Valori della visita: "arm" = media sinistro/destro se misurati entrambi. */
export function sitesOf(c: Checkup): SiteValues {
  const raw = (c.all_sites && typeof c.all_sites === "object" && !Array.isArray(c.all_sites) ? c.all_sites : {}) as Record<string, unknown>
  const out: SiteValues = {}
  for (const [k, v] of Object.entries(raw)) if (typeof v === "number") out[k] = v
  for (const base of ["arm", "forearm", "thigh", "calf"]) {
    const l = out[`${base}_left`]
    const r = out[`${base}_right`]
    if (!isNum(out[base]) && (isNum(l) || isNum(r))) out[base] = isNum(l) && isNum(r) ? (l + r) / 2 : ((l ?? r) as number)
  }
  return out
}

export const SITE_LABELS: Record<string, string> = {
  chest: "Torace",
  shoulders: "Spalle",
  arm: "Braccio",
  forearm: "Avambraccio",
  waist: "Vita",
  hips: "Fianchi",
  thigh: "Coscia",
  calf: "Polpaccio",
  neck: "Collo",
}

/** Ultimo valore disponibile di ogni sito (anche se misurati in visite diverse, entro 6 mesi). */
export function latestSites(chronological: Checkup[]): { values: SiteValues; dates: Record<string, string>; raw: SiteValues } {
  const values: SiteValues = {}
  const dates: Record<string, string> = {}
  let raw: SiteValues = {}
  const last = chronological[chronological.length - 1]
  for (let i = chronological.length - 1; i >= 0; i--) {
    const c = chronological[i] as Checkup
    if (last && daysBetween(c.checkup_date, last.checkup_date) > 183) break
    const s = sitesOf(c)
    if (Object.keys(raw).length === 0 && Object.keys(s).length > 0) raw = s
    for (const [k, v] of Object.entries(s)) {
      if (!(k in values)) {
        values[k] = v
        dates[k] = c.checkup_date
      }
    }
  }
  return { values, dates, raw }
}

/* -------------------------------- Proporzioni -------------------------------- */

export interface Proportion {
  key: string
  label: string
  value: number
  ideal: [number, number]
  /** distretto che va potenziato se il rapporto è basso / alto */
  lowMeans: Muscle[]
  highMeans: Muscle[]
  status: "low" | "ok" | "high"
  hint: string
}

type Ratio = { key: string; label: string; a: string; b: string; ideal: [number, number]; lowMeans: Muscle[]; highMeans: Muscle[]; hint: string }

const RATIOS: Ratio[] = [
  { key: "shoulders_waist", label: "Spalle / vita", a: "shoulders", b: "waist", ideal: [1.45, 1.7], lowMeans: ["side_delts", "lats"], highMeans: [], hint: "La “V”: più spalle e dorsali o meno vita." },
  { key: "chest_waist", label: "Torace / vita", a: "chest", b: "waist", ideal: [1.3, 1.5], lowMeans: ["chest", "lats"], highMeans: [], hint: "Petto e dorsali rispetto al punto vita." },
  { key: "arm_neck", label: "Braccio / collo", a: "arm", b: "neck", ideal: [0.95, 1.08], lowMeans: ["biceps", "triceps"], highMeans: [], hint: "Nelle proporzioni classiche braccio e collo hanno circonferenze simili." },
  { key: "calf_arm", label: "Polpaccio / braccio", a: "calf", b: "arm", ideal: [0.93, 1.07], lowMeans: ["calves"], highMeans: ["biceps", "triceps"], hint: "Polpaccio e braccio tendono ad avere misure simili." },
  { key: "arm_forearm", label: "Braccio / avambraccio", a: "arm", b: "forearm", ideal: [1.18, 1.32], lowMeans: ["biceps", "triceps"], highMeans: ["forearms"], hint: "Un rapporto alto indica avambracci indietro rispetto alle braccia." },
  { key: "thigh_calf", label: "Coscia / polpaccio", a: "thigh", b: "calf", ideal: [1.45, 1.7], lowMeans: ["quads", "hamstrings"], highMeans: ["calves"], hint: "Un rapporto alto indica polpacci indietro rispetto alle cosce." },
]

/**
 * Riferimenti femminili: la "clessidra" (spalle ≈ fianchi, vita stretta) al posto
 * della "V"; il torace include il seno e non è confrontabile, braccia più sottili
 * rispetto a collo e polpacci.
 */
const RATIOS_FEMALE: Ratio[] = [
  { key: "hips_waist", label: "Fianchi / vita", a: "hips", b: "waist", ideal: [1.3, 1.5], lowMeans: ["glutes"], highMeans: [], hint: "La “clessidra”: glutei più sviluppati o vita più sottile." },
  { key: "shoulders_waist", label: "Spalle / vita", a: "shoulders", b: "waist", ideal: [1.35, 1.6], lowMeans: ["side_delts", "lats"], highMeans: [], hint: "Spalle e dorsali bilanciano i fianchi e snelliscono la vita." },
  { key: "shoulders_hips", label: "Spalle / fianchi", a: "shoulders", b: "hips", ideal: [0.98, 1.12], lowMeans: ["side_delts", "lats"], highMeans: ["glutes"], hint: "Spalle e fianchi simili danno una figura proporzionata." },
  { key: "calf_arm", label: "Polpaccio / braccio", a: "calf", b: "arm", ideal: [1.05, 1.3], lowMeans: ["calves"], highMeans: ["biceps", "triceps"], hint: "Nelle donne il polpaccio è di solito un po' più grande del braccio." },
  { key: "arm_forearm", label: "Braccio / avambraccio", a: "arm", b: "forearm", ideal: [1.15, 1.32], lowMeans: ["biceps", "triceps"], highMeans: ["forearms"], hint: "Un rapporto alto indica avambracci indietro rispetto alle braccia." },
  { key: "thigh_calf", label: "Coscia / polpaccio", a: "thigh", b: "calf", ideal: [1.5, 1.8], lowMeans: ["quads", "hamstrings", "glutes"], highMeans: ["calves"], hint: "Un rapporto alto indica polpacci indietro rispetto alle cosce." },
]

export function proportions(sites: SiteValues, sex: "male" | "female" | null = "male"): Proportion[] {
  const out: Proportion[] = []
  for (const r of sex === "female" ? RATIOS_FEMALE : RATIOS) {
    const a = sites[r.a]
    const b = sites[r.b]
    if (!isNum(a) || !isNum(b) || b <= 0) continue
    const value = a / b
    const status = value < r.ideal[0] ? "low" : value > r.ideal[1] ? "high" : "ok"
    out.push({ key: r.key, label: r.label, value, ideal: r.ideal, lowMeans: r.lowMeans, highMeans: r.highMeans, status, hint: r.hint })
  }
  return out
}

/* -------------------------------- Asimmetrie -------------------------------- */

export interface Asymmetry {
  site: string
  label: string
  left: number
  right: number
  diff: number
  weaker: "sinistro" | "destro"
  relevant: boolean
}

export function asymmetries(raw: SiteValues): Asymmetry[] {
  const out: Asymmetry[] = []
  for (const base of ["arm", "forearm", "thigh", "calf"]) {
    const l = raw[`${base}_left`]
    const r = raw[`${base}_right`]
    if (!isNum(l) || !isNum(r)) continue
    const diff = Math.abs(l - r)
    const threshold = base === "thigh" ? 1.5 : 1
    out.push({ site: base, label: SITE_LABELS[base] ?? base, left: l, right: r, diff, weaker: l < r ? "sinistro" : "destro", relevant: diff >= threshold })
  }
  return out
}

/* ---------------------------------- Crescita ---------------------------------- */

export interface SiteGrowth {
  site: string
  label: string
  from: number
  to: number
  delta: number
  days: number
}

/** Variazione delle circonferenze negli ultimi ~6 mesi (dalla visita più vicina a 180 giorni fa). */
export function siteGrowth(chronological: Checkup[]): SiteGrowth[] {
  const last = chronological[chronological.length - 1]
  if (!last) return []
  const lastSites = sitesOf(last)
  const out: SiteGrowth[] = []
  for (const site of Object.keys(SITE_LABELS)) {
    const to = lastSites[site]
    if (!isNum(to)) continue
    const older = chronological.filter((c) => c.id !== last.id && isNum(sitesOf(c)[site]) && daysBetween(c.checkup_date, last.checkup_date) >= 75)
    if (older.length === 0) continue
    const ref = older.reduce((best, c) =>
      Math.abs(daysBetween(c.checkup_date, last.checkup_date) - 180) < Math.abs(daysBetween(best.checkup_date, last.checkup_date) - 180) ? c : best,
    )
    const from = sitesOf(ref)[site] as number
    out.push({ site, label: SITE_LABELS[site] ?? site, from, to, delta: to - from, days: daysBetween(ref.checkup_date, last.checkup_date) })
  }
  return out
}

/* --------------------------- Punti forti e carenze --------------------------- */

export interface FocusItem {
  muscle: Muscle
  label: string
  score: number
  reasons: string[]
  /** esercizi suggeriti: già in scheda (aumenta serie) o da aggiungere */
  exercises: Array<{ code: string; name: string; inPlan: boolean }>
  weeklySets: number | null
  targetSets: number
}

export interface StrengthItem {
  key: string
  title: string
  detail: string
}

export interface PhysiqueAnalysis {
  sites: SiteValues
  sitesDate: string | null
  proportions: Proportion[]
  asymmetries: Asymmetry[]
  growth: SiteGrowth[]
  weaknesses: FocusItem[]
  strengths: StrengthItem[]
  balance: Array<{ key: string; title: string; detail: string; tone: "ok" | "warn" }>
}

const SITE_MUSCLES: Record<string, Muscle[]> = {
  arm: ["biceps", "triceps"],
  forearm: ["forearms"],
  chest: ["chest", "lats"],
  shoulders: ["side_delts", "front_delts", "rear_delts"],
  thigh: ["quads", "hamstrings", "adductors"],
  calf: ["calves"],
  hips: ["glutes"],
  neck: ["upper_back"],
}

const ACCESSORY: Muscle[] = ["side_delts", "rear_delts", "biceps", "triceps", "calves"]

/** Obiettivo realistico: +4 serie rispetto a oggi, dentro la fascia produttiva del muscolo. */
function targetFor(m: Muscle, sets: number | null): number {
  const [lo, hi] = ACCESSORY.includes(m) ? [8, 14] : [VOLUME_ZONES.optimalMin, 16]
  return Math.round(Math.min(hi, Math.max(lo, (sets ?? 0) + 4)))
}

export function analyzePhysique(input: {
  chronological: Checkup[]
  plan: PlanVolume | null
  logged: LoggedVolume | null
  progress: ExerciseProgress[]
  sex?: "male" | "female" | null
}): PhysiqueAnalysis {
  const { chronological, plan, logged, progress } = input
  const { values: sites, dates, raw } = latestSites(chronological)
  const props = proportions(sites, input.sex ?? "male")
  const asym = asymmetries(raw)
  const growth = siteGrowth(chronological)
  const waistGrowth = growth.find((g) => g.site === "waist")?.delta ?? 0

  // volume di riferimento: le sessioni reali se ce ne sono abbastanza, altrimenti la scheda
  // le sessioni reali contano se sono abbastanza e registrate per intero (≥ 60% delle serie della scheda)
  const loggedTotal = logged ? Object.values(logged.perMuscle).reduce((a, b) => a + b, 0) : 0
  const planTotal = plan ? Object.values(plan.perMuscle).reduce((a, b) => a + b, 0) : 0
  const useLogged = Boolean(logged && logged.sessions >= 4 && (!plan || loggedTotal >= planTotal * 0.6))
  const volume = useLogged && logged ? logged.perMuscle : (plan?.perMuscle ?? null)

  const score = new Map<Muscle, { s: number; reasons: string[] }>()
  const bump = (m: Muscle, s: number, reason: string) => {
    const cur = score.get(m) ?? { s: 0, reasons: [] }
    cur.s += s
    if (!cur.reasons.includes(reason)) cur.reasons.push(reason)
    score.set(m, cur)
  }

  for (const p of props) {
    if (p.status === "low") for (const m of p.lowMeans) bump(m, 2, `${p.label} ${formatNumber(p.value, 2)} (riferimento ${formatNumber(p.ideal[0], 2)}–${formatNumber(p.ideal[1], 2)})`)
    if (p.status === "high") for (const m of p.highMeans) bump(m, 2, `${p.label} ${formatNumber(p.value, 2)}: ${p.hint.toLowerCase()}`)
  }

  if (volume) {
    for (const m of Object.keys(MUSCLES) as Muscle[]) {
      if (SMALL_MUSCLES.includes(m)) continue
      const v = volume[m]
      if (v < VOLUME_ZONES.low) bump(m, v < 4 ? 2 : 1.5, `solo ${formatNumber(v, v % 1 ? 1 : 0)} serie a settimana${useLogged ? " (ultime 4 settimane)" : " in scheda"}`)
    }
  }

  // circonferenze ferme mentre la vita non cresce (crescita "pulita" assente) e volume basso/medio
  for (const g of growth) {
    const muscles = SITE_MUSCLES[g.site]
    if (!muscles || g.days < 90) continue
    if (g.delta <= 0.2 && waistGrowth <= 0.5) {
      for (const m of muscles.slice(0, 2)) bump(m, 0.75, `${g.label.toLowerCase()} ferma (${formatSigned(g.delta, 1)} cm in ${Math.round(g.days / 30)} mesi)`)
    }
  }

  const planCodes = plan?.exerciseCodes ?? new Set<string>()
  const weaknesses: FocusItem[] = [...score.entries()]
    .filter(([, v]) => v.s >= 1.5)
    .sort((a, b) => b[1].s - a[1].s)
    .slice(0, 5)
    .map(([m, v]) => {
      const sets = volume ? volume[m] : null
      return {
        muscle: m,
        label: MUSCLES[m],
        score: v.s,
        reasons: v.reasons,
        weeklySets: sets,
        targetSets: targetFor(m, sets),
        exercises: FOCUS_EXERCISES[m].map((code) => ({
          code,
          name: EXERCISES.find((e) => e.code === code)?.name ?? code,
          inPlan: planCodes.has(code),
        })),
      }
    })

  /* Punti forti */
  const strengths: StrengthItem[] = []
  for (const p of props) {
    if (p.status === "ok" || (p.status === "high" && p.highMeans.length === 0)) {
      strengths.push({ key: `prop-${p.key}`, title: `${p.label}: ${formatNumber(p.value, 2)}`, detail: p.status === "high" ? "Sopra il riferimento: distretto dominante." : "Nel range delle proporzioni classiche." })
    }
  }
  for (const g of growth) {
    // per le donne i fianchi che crescono (con vita stabile) sono glutei: un punto forte
    if (g.site === "waist" || (g.site === "hips" && input.sex !== "female")) continue
    if (g.delta >= 1 && waistGrowth <= g.delta / 2) {
      strengths.push({ key: `grow-${g.site}`, title: `${g.label} ${formatSigned(g.delta, 1)} cm`, detail: `In ${Math.round(g.days / 30)} mesi, con la vita ${waistGrowth > 0 ? `+${formatNumber(waistGrowth, 1)}` : formatNumber(waistGrowth, 1)} cm: crescita in gran parte muscolare.` })
    }
  }
  if (volume) {
    const optimal = (Object.keys(MUSCLES) as Muscle[]).filter((m) => volume[m] >= VOLUME_ZONES.optimalMin && volume[m] <= VOLUME_ZONES.optimalMax && !SMALL_MUSCLES.includes(m))
    if (optimal.length >= 4) strengths.push({ key: "volume", title: `${optimal.length} gruppi muscolari nel volume ottimale`, detail: optimal.map((m) => MUSCLES[m].toLowerCase()).join(", ") + "." })
  }
  for (const p of progress.filter((x) => x.status === "progress" && isNum(x.pctPerMonth) && (x.pctPerMonth ?? 0) >= 2).slice(0, 3)) {
    strengths.push({ key: `prog-${p.code}`, title: `${p.name}: ${formatSigned(p.pctPerMonth, 1)}% al mese`, detail: `${p.kind === "load" ? "Massimale stimato" : "Ripetizioni"} in crescita nelle ultime 8 settimane.` })
  }

  /* Equilibrio della programmazione */
  const balance: PhysiqueAnalysis["balance"] = []
  const pat = useLogged && logged ? logged.patterns : plan?.patterns
  if (pat && volume) {
    const push = pat.horizontal_push + pat.vertical_push
    const pull = pat.horizontal_pull + pat.vertical_pull
    if (push > 0) {
      const r = pull / push
      balance.push(
        r < 0.9
          ? { key: "push-pull", tone: "warn", title: `Tirate/spinte ${formatNumber(r, 2)}`, detail: "Più spinte che tirate: a lungo andare spalle in avanti e squilibri posturali. Porta le tirate almeno alla pari." }
          : { key: "push-pull", tone: "ok", title: `Tirate/spinte ${formatNumber(r, 2)}`, detail: "Equilibrio corretto tra petto/spalle e schiena." },
      )
    }
    if (volume.quads > 0) {
      const r = volume.hamstrings / volume.quads
      balance.push(
        r < 0.6
          ? { key: "ham-quad", tone: "warn", title: `Femorali/quadricipiti ${formatNumber(r, 2)}`, detail: "Femorali poco allenati rispetto ai quadricipiti: aumenta stacchi rumeni e leg curl (prevenzione degli infortuni al ginocchio)." }
          : { key: "ham-quad", tone: "ok", title: `Femorali/quadricipiti ${formatNumber(r, 2)}`, detail: "Rapporto adeguato tra parte anteriore e posteriore della coscia." },
      )
    }
    const upper = volume.chest + volume.lats + volume.upper_back + volume.front_delts + volume.side_delts + volume.rear_delts + volume.biceps + volume.triceps
    const lower = volume.quads + volume.hamstrings + volume.glutes + volume.calves + volume.adductors
    if (upper > 0) {
      const r = lower / upper
      if (r < 0.35) balance.push({ key: "lower-upper", tone: "warn", title: "Gambe trascurate", detail: `Le gambe ricevono il ${formatNumber(r * 100, 0)}% del volume della parte alta: gli arti inferiori sono il distretto più grande e sostengono il metabolismo.` })
    }
    if (pat.hinge === 0) balance.push({ key: "hinge", tone: "warn", title: "Nessun esercizio di hip hinge", detail: "Manca uno stacco (rumeno, da terra, hip thrust): catena posteriore e schiena bassa restano scoperte." })
    if (volume.rear_delts < 4) balance.push({ key: "rear", tone: "warn", title: "Deltoidi posteriori quasi assenti", detail: "Aggiungi 2–3 serie di face pull o alzate posteriori 2 volte a settimana: salute della spalla e postura." })
  }
  if (plan) {
    const once = (Object.keys(MUSCLES) as Muscle[]).filter((m) => plan.perMuscle[m] >= 10 && plan.frequency[m] > 0 && plan.frequency[m] < 1.5 && !SMALL_MUSCLES.includes(m))
    if (once.length > 0) balance.push({ key: "freq", tone: "warn", title: "Muscoli allenati una sola volta a settimana", detail: `${once.map((m) => MUSCLES[m].toLowerCase()).join(", ")}: a parità di serie, dividerle su 2 sessioni rende di più.` })
  }

  const sitesDate = Object.values(dates).sort().at(-1) ?? null
  return { sites, sitesDate, proportions: props, asymmetries: asym, growth, weaknesses, strengths, balance }
}
