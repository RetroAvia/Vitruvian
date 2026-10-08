/**
 * Previsioni e qualità del dato.
 *
 * - Trend robusto: regressione lineare pesata (le visite recenti contano di più,
 *   emivita 90 giorni) sugli ultimi 9 mesi, solo con lo strumento BIA attuale
 *   per le metriche BIA. Restituisce velocità mensile, R² e intervallo d'errore.
 * - Proiezione: data stimata di raggiungimento di ogni obiettivo se il trend
 *   continua, con valutazione del ritmo (troppo veloce / sano / lento).
 * - Qualità del dato: punteggio 0–100 su regolarità, completezza e coerenza.
 */
import { daysBetween, isNum, parseISODate, shiftISO } from "@/lib/format"
import type { Checkup, Profile } from "@/types/domain"

import type { BiometricReport } from "./report"

export type ForecastKey = "weight" | "fat_pct" | "fat_kg" | "ffm" | "waist"

interface Def {
  key: ForecastKey
  label: string
  unit: string
  digits: number
  bia: boolean
  get: (c: Checkup) => number | null
  target?: (p: Profile) => number | null
}

export const FORECAST_DEFS: Def[] = [
  { key: "weight", label: "Peso", unit: "kg", digits: 1, bia: false, get: (c) => c.weight_kg, target: (p) => p.target_weight_kg },
  { key: "fat_pct", label: "Massa grassa", unit: "%", digits: 1, bia: true, get: (c) => c.fat_mass_pct, target: (p) => p.target_fat_pct },
  { key: "fat_kg", label: "Grasso", unit: "kg", digits: 1, bia: true, get: (c) => c.fat_mass_kg },
  { key: "ffm", label: "Massa magra", unit: "kg", digits: 1, bia: true, get: (c) => c.ffm_kg, target: (p) => p.target_ffm_kg },
  { key: "waist", label: "Vita", unit: "cm", digits: 1, bia: false, get: (c) => c.waist_cm, target: (p) => p.target_waist_cm },
]

export interface Trend {
  key: ForecastKey
  label: string
  unit: string
  digits: number
  points: number
  spanDays: number
  /** variazione stimata al mese (30,4 giorni) */
  perMonth: number
  /** bontà di adattamento 0–1 */
  r2: number
  /** valore stimato oggi dal modello */
  fitted: number
  current: number
  confidence: "high" | "medium" | "low"
}

export interface GoalForecast extends Trend {
  target: number
  remaining: number
  /** data stimata di raggiungimento (null = la tendenza va nella direzione opposta o è piatta) */
  eta: string | null
  monthsToGoal: number | null
  direction: "toward" | "away" | "flat" | "reached"
  pace: "too_fast" | "healthy" | "slow" | "n/a"
  paceNote: string
  /** obiettivo con data: stima di arrivo prima/dopo */
  onTrackForDate: boolean | null
}

const HALF_LIFE_DAYS = 90
const WINDOW_DAYS = 270

function weightedRegression(xs: number[], ys: number[], ws: number[]) {
  const sw = ws.reduce((a, b) => a + b, 0)
  const mx = xs.reduce((a, x, i) => a + x * (ws[i] as number), 0) / sw
  const my = ys.reduce((a, y, i) => a + y * (ws[i] as number), 0) / sw
  let sxy = 0
  let sxx = 0
  let syy = 0
  for (let i = 0; i < xs.length; i++) {
    const w = ws[i] as number
    const dx = (xs[i] as number) - mx
    const dy = (ys[i] as number) - my
    sxy += w * dx * dy
    sxx += w * dx * dx
    syy += w * dy * dy
  }
  const slope = sxx === 0 ? 0 : sxy / sxx
  const r2 = sxx === 0 || syy === 0 ? 0 : (sxy * sxy) / (sxx * syy)
  return { slope, intercept: my - slope * mx, r2 }
}

export function computeTrend(chronological: Checkup[], def: Def, today: string): Trend | null {
  let rows = chronological.filter((c) => isNum(def.get(c)))
  if (def.bia) {
    const last = rows[rows.length - 1]
    if (!last) return null
    rows = rows.filter((c) => c.protocol_id === last.protocol_id)
  }
  const last = rows[rows.length - 1]
  if (!last) return null
  const from = shiftISO(last.checkup_date, -WINDOW_DAYS)
  rows = rows.filter((c) => c.checkup_date >= from)
  if (rows.length < 3) return null

  const t0 = rows[0]?.checkup_date as string
  const spanDays = daysBetween(t0, last.checkup_date)
  if (spanDays < 28) return null

  const xs = rows.map((c) => daysBetween(t0, c.checkup_date))
  const ys = rows.map((c) => def.get(c) as number)
  const ws = rows.map((c) => Math.pow(0.5, daysBetween(c.checkup_date, last.checkup_date) / HALF_LIFE_DAYS))
  const { slope, intercept, r2 } = weightedRegression(xs, ys, ws)

  const todayX = daysBetween(t0, today)
  const confidence = rows.length >= 5 && r2 >= 0.6 ? "high" : rows.length >= 4 && r2 >= 0.35 ? "medium" : "low"
  return {
    key: def.key,
    label: def.label,
    unit: def.unit,
    digits: def.digits,
    points: rows.length,
    spanDays,
    perMonth: slope * 30.4,
    r2,
    // la proiezione parte dal valore misurato più recente, non da oggi (niente estrapolazioni di mesi)
    fitted: intercept + slope * Math.min(todayX, xs[xs.length - 1] as number),
    current: ys[ys.length - 1] as number,
    confidence,
  }
}

/** Ritmo sano di variazione al mese, per metrica (riferimenti ACSM / ISSN). */
function assessPace(key: ForecastKey, perMonth: number, weight: number | null): Pick<GoalForecast, "pace" | "paceNote"> {
  const abs = Math.abs(perMonth)
  if (key === "weight" && isNum(weight) && weight > 0) {
    const pctWeek = (abs / weight / 4.35) * 100
    if (perMonth < 0) {
      if (pctWeek > 1) return { pace: "too_fast", paceNote: `Perdita di circa ${pctWeek.toFixed(1).replace(".", ",")}% del peso a settimana: oltre l'1% aumenta il rischio di perdere massa magra.` }
      if (pctWeek >= 0.25) return { pace: "healthy", paceNote: "Ritmo di dimagrimento nel range consigliato (0,25–1% del peso a settimana)." }
      return { pace: "slow", paceNote: "Ritmo lento: va bene per una ricomposizione, meno per un dimagrimento." }
    }
    const pctMonth = (abs / weight) * 100
    if (pctMonth > 2) return { pace: "too_fast", paceNote: "Aumento oltre il 2% del peso al mese: probabile accumulo di grasso oltre al muscolo." }
    if (pctMonth >= 0.25) return { pace: "healthy", paceNote: "Aumento graduale compatibile con una fase di massa pulita (0,25–1% al mese)." }
    return { pace: "slow", paceNote: "Aumento molto lento." }
  }
  if (key === "ffm") {
    if (perMonth > 1.2) return { pace: "too_fast", paceNote: "Più di 1 kg di massa magra al mese è raro dopo il primo anno: parte della variazione può essere acqua o errore della BIA." }
    if (perMonth >= 0.2) return { pace: "healthy", paceNote: "Crescita di massa magra realistica per chi si allena con costanza." }
    return { pace: "slow", paceNote: "Crescita lenta: proteine, volume di allenamento e surplus calorico sono le leve principali." }
  }
  if (key === "fat_pct") {
    if (perMonth < -1.5) return { pace: "too_fast", paceNote: "Calo molto rapido della % di grasso: verifica che la massa magra regga." }
    if (abs >= 0.3) return { pace: "healthy", paceNote: "Variazione della % di grasso in un range sostenibile." }
    return { pace: "slow", paceNote: "Variazione lenta della % di grasso." }
  }
  if (key === "waist") {
    if (abs >= 0.5) return { pace: "healthy", paceNote: "La vita sta cambiando in modo misurabile." }
    return { pace: "slow", paceNote: "Vita quasi stabile." }
  }
  return { pace: "n/a", paceNote: "" }
}

export function forecastGoals(report: BiometricReport, profile: Profile | null, today: string): GoalForecast[] {
  if (!profile) return []
  const out: GoalForecast[] = []
  const weight = report.latest?.weight_kg ?? null
  for (const def of FORECAST_DEFS) {
    const target = def.target?.(profile)
    if (!isNum(target)) continue
    const trend = computeTrend(report.chronological, def, today)
    if (!trend) continue
    const remaining = target - trend.current
    const tol = def.key === "fat_pct" ? 0.3 : def.key === "waist" ? 0.5 : 0.3
    // obiettivo superato nella direzione voluta (es. peso target 75, ora 73 partendo da 80) = raggiunto
    const startRow = report.chronological.find((c) => isNum(def.get(c)) && (!profile.goals_start_date || c.checkup_date >= profile.goals_start_date))
    const start = startRow ? (def.get(startRow) as number) : null
    const overshot = isNum(start) && Math.abs(target - start) > tol && Math.sign(target - start) !== Math.sign(remaining) && Math.sign(target - start) * (trend.current - target) > 0
    let direction: GoalForecast["direction"]
    if (Math.abs(remaining) <= tol || overshot) direction = "reached"
    else if (Math.abs(trend.perMonth) < (def.key === "fat_pct" ? 0.1 : 0.15)) direction = "flat"
    else direction = Math.sign(trend.perMonth) === Math.sign(remaining) ? "toward" : "away"

    let eta: string | null = null
    let monthsToGoal: number | null = null
    if (direction === "toward") {
      monthsToGoal = remaining / trend.perMonth
      if (monthsToGoal <= 60) {
        const lastDate = report.chronological.filter((c) => isNum(def.get(c))).at(-1)?.checkup_date ?? today
        eta = shiftISO(lastDate, Math.round(monthsToGoal * 30.4))
      }
    }
    const onTrackForDate =
      profile.target_date && direction !== "reached"
        ? eta !== null && parseISODate(eta) <= parseISODate(profile.target_date)
        : null

    out.push({
      ...trend,
      target,
      remaining,
      eta,
      monthsToGoal,
      direction,
      onTrackForDate,
      ...assessPace(def.key, trend.perMonth, weight),
    })
  }
  return out
}

export function allTrends(report: BiometricReport, today: string): Trend[] {
  return FORECAST_DEFS.map((d) => computeTrend(report.chronological, d, today)).filter((t): t is Trend => t !== null)
}

/* ------------------------------ Qualità del dato ----------------------------- */

export interface DataQuality {
  score: number
  label: "Ottima" | "Buona" | "Discreta" | "Scarsa"
  factors: Array<{ label: string; ok: boolean; detail: string }>
}

export function dataQuality(report: BiometricReport, today: string): DataQuality {
  const c = report.chronological
  const factors: DataQuality["factors"] = []
  let score = 0

  // 1. Regolarità: intervallo mediano tra visite (ideale 3–6 settimane)
  const gaps: number[] = []
  for (let i = 1; i < c.length; i++) gaps.push(daysBetween((c[i - 1] as Checkup).checkup_date, (c[i] as Checkup).checkup_date))
  const recentGaps = gaps.slice(-6).sort((a, b) => a - b)
  const median = recentGaps.length ? (recentGaps[Math.floor(recentGaps.length / 2)] as number) : null
  const regular = isNum(median) && median <= 45
  score += !isNum(median) ? 0 : median <= 45 ? 25 : median <= 75 ? 15 : 5
  factors.push({
    label: "Regolarità delle visite",
    ok: regular,
    detail: isNum(median) ? `Una visita ogni ${median} giorni circa (ideale 3–6 settimane).` : "Servono almeno due visite.",
  })

  // 2. Freschezza
  const days = report.daysSinceLatest
  score += !isNum(days) ? 0 : days <= 45 ? 20 : days <= 90 ? 12 : days <= 180 ? 5 : 0
  factors.push({
    label: "Dati recenti",
    ok: isNum(days) && days <= 60,
    detail: isNum(days) ? `Ultima visita ${days} giorni fa.` : "Nessuna visita.",
  })

  // 3. Completezza dell'ultima visita
  const l = report.latest
  const fields = l ? [l.weight_kg, l.fat_mass_pct, l.bmr_kcal, l.waist_cm, l.total_body_water_pct, l.abdomen_cm] : []
  const filled = fields.filter(isNum).length
  score += fields.length ? Math.round((filled / fields.length) * 25) : 0
  factors.push({
    label: "Completezza",
    ok: filled >= 5,
    detail: `${filled} su ${fields.length || 6} misure chiave nell'ultima visita (peso, % grasso, BMR, acqua, vita, addome).`,
  })

  // 4. Stesso strumento negli ultimi controlli
  const seg = report.segments[report.segments.length - 1]
  const segBia = seg?.checkups.filter((x) => isNum(x.fat_mass_pct)).length ?? 0
  score += segBia >= 4 ? 15 : segBia >= 2 ? 8 : 0
  factors.push({
    label: "Stesso strumento BIA",
    ok: segBia >= 3,
    detail: `${segBia} misure BIA confrontabili con lo strumento attuale.`,
  })

  // 5. Coerenza: salti di peso non plausibili (> 1,5 kg/settimana)
  let jumps = 0
  for (let i = 1; i < c.length; i++) {
    const a = c[i - 1] as Checkup
    const b = c[i] as Checkup
    if (!isNum(a.weight_kg) || !isNum(b.weight_kg)) continue
    const d = Math.max(daysBetween(a.checkup_date, b.checkup_date), 1)
    if (Math.abs(b.weight_kg - a.weight_kg) / (d / 7) > 1.5) jumps++
  }
  score += jumps === 0 ? 15 : jumps === 1 ? 8 : 0
  factors.push({
    label: "Coerenza",
    ok: jumps === 0,
    detail: jumps === 0 ? "Nessuna variazione di peso anomala." : `${jumps} variazioni di peso oltre 1,5 kg a settimana: controlla eventuali errori di inserimento.`,
  })

  score = Math.max(0, Math.min(100, score))
  return { score, label: score >= 80 ? "Ottima" : score >= 60 ? "Buona" : score >= 40 ? "Discreta" : "Scarsa", factors }
}
