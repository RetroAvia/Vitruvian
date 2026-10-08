/**
 * Motore allenamento: volume per muscolo (scheda e sessioni reali), equilibrio
 * tra schemi motori, progressione dei carichi (massimale stimato), costanza.
 * Lavora sui RIEPILOGHI delle sessioni (calcolati dal database): anche con anni
 * di storico i calcoli restano istantanei. Funzioni pure.
 */
import { daysBetween, isNum, shiftISO } from "@/lib/format"

import type { CompactSet, TrainingDay, TrainingExercise, TrainingTree, Workout, WorkoutSummary } from "../types"
import { findExercise, isMuscle, MUSCLE_KEYS, slug, type Muscle, type Pattern } from "./catalog"

/* ------------------------------ Esercizi ------------------------------ */

export interface ResolvedExercise {
  code: string
  name: string
  primary: Muscle | null
  secondary: Muscle[]
  pattern: Pattern
  strength: boolean
}

const PATTERNS: Pattern[] = ["squat", "hinge", "lunge", "horizontal_push", "vertical_push", "horizontal_pull", "vertical_pull", "isolation", "core", "carry", "cardio"]

const resolveCache = new Map<string, ResolvedExercise>()

/** Catalogo prima, poi i muscoli dichiarati nella scheda (esercizi personali). */
export function resolveExercise(code: string, name: string, row?: Partial<Pick<TrainingExercise, "muscle_primary" | "muscles_secondary" | "pattern">>): ResolvedExercise {
  const key = row ? "" : `${code}|${name}`
  if (key) {
    const hit = resolveCache.get(key)
    if (hit) return hit
  }
  const def = findExercise(code, name)
  let out: ResolvedExercise
  if (def) {
    out = { code: def.code, name: def.name, primary: def.primary, secondary: def.secondary, pattern: def.pattern, strength: Boolean(def.strength) }
  } else {
    const pattern = PATTERNS.includes(row?.pattern as Pattern) ? (row?.pattern as Pattern) : "isolation"
    out = {
      code: slug(code || name),
      name,
      primary: isMuscle(row?.muscle_primary) ? row.muscle_primary : null,
      secondary: (row?.muscles_secondary ?? []).filter(isMuscle),
      pattern,
      strength: false,
    }
  }
  if (key) resolveCache.set(key, out)
  return out
}

/* -------------------------------- Volume -------------------------------- */

export type MuscleMap = Record<Muscle, number>
export const emptyMuscles = (): MuscleMap => Object.fromEntries(MUSCLE_KEYS.map((m) => [m, 0])) as MuscleMap
const emptyPatterns = () => Object.fromEntries(PATTERNS.map((p) => [p, 0])) as Record<Pattern, number>

function addSets(map: MuscleMap, ex: ResolvedExercise, sets: number) {
  if (ex.primary) map[ex.primary] += sets
  for (const m of ex.secondary) if (m !== ex.primary) map[m] += sets * 0.5
}

export interface PlanVolume {
  perMuscle: MuscleMap
  /** quante sessioni a settimana colpiscono il muscolo (≥ 2 serie dirette) */
  frequency: MuscleMap
  patterns: Record<Pattern, number>
  cardioMin: number
  sessionsPerWeek: number
  totalSets: number
  exerciseCodes: Set<string>
}

/** Fattore per riportare la scheda alla settimana (es. A/B a rotazione su 3 giorni). */
export function weekScale(tree: TrainingTree): number {
  const n = tree.days.length
  if (n === 0) return 0
  if (tree.plan.days_per_week) return tree.plan.days_per_week / n
  return 1
}

export function planVolume(tree: TrainingTree): PlanVolume {
  const scale = weekScale(tree)
  const perMuscle = emptyMuscles()
  const frequency = emptyMuscles()
  const patterns = emptyPatterns()
  let cardioMin = 0
  let totalSets = 0
  const exerciseCodes = new Set<string>()

  for (const day of tree.days) {
    const dayMap = emptyMuscles()
    for (const e of day.exercises) {
      const ex = resolveExercise(e.exercise_code, e.name, e)
      exerciseCodes.add(ex.code)
      if (ex.pattern === "cardio") {
        cardioMin += (e.duration_min ?? 0) * scale
        continue
      }
      const sets = e.sets ?? 3
      addSets(perMuscle, ex, sets * scale)
      if (ex.primary) dayMap[ex.primary] += sets
      patterns[ex.pattern] += sets * scale
      totalSets += sets * scale
    }
    for (const m of MUSCLE_KEYS) if (dayMap[m] >= 2) frequency[m] += scale
  }
  return { perMuscle, frequency, patterns, cardioMin, sessionsPerWeek: tree.plan.days_per_week ?? tree.days.length, totalSets, exerciseCodes }
}

export interface LoggedVolume {
  weeks: number
  sessions: number
  sessionsPerWeek: number
  perMuscle: MuscleMap
  patterns: Record<Pattern, number>
  cardioMinPerWeek: number
  tonnagePerWeek: number
  avgRpe: number | null
  avgDuration: number | null
  /** settimane dalla più vecchia alla più recente */
  weekly: Array<{ start: string; sessions: number; sets: number; tonnage: number }>
}

export function loggedVolume(workouts: WorkoutSummary[], today: string, weeks = 4): LoggedVolume {
  const from = shiftISO(today, -weeks * 7 + 1)
  const recent = workouts.filter((w) => w.workout_date >= from && w.workout_date <= today)
  const perMuscle = emptyMuscles()
  const patterns = emptyPatterns()
  let cardio = 0
  let tonnage = 0
  for (const w of recent) {
    for (const e of w.summary) {
      const ex = resolveExercise(e.c, e.n)
      if (ex.pattern === "cardio") {
        cardio += e.min ?? 0
        continue
      }
      const sets = e.sets ?? 0
      addSets(perMuscle, ex, sets)
      patterns[ex.pattern] += sets
      tonnage += e.vol ?? 0
    }
  }
  // chi ha iniziato da poco: si divide per le settimane effettive, non per tutta la finestra
  const first = workouts.reduce<string | null>((min, w) => (!min || w.workout_date < min ? w.workout_date : min), null)
  const eff = first && first > from ? Math.min(weeks, Math.max(1, Math.ceil((daysBetween(first, today) + 1) / 7))) : weeks
  for (const m of MUSCLE_KEYS) perMuscle[m] = perMuscle[m] / eff
  for (const p of PATTERNS) patterns[p] = patterns[p] / eff

  const weekly: LoggedVolume["weekly"] = []
  for (let i = 11; i >= 0; i--) {
    const start = shiftISO(today, -(i + 1) * 7 + 1)
    const end = shiftISO(today, -i * 7)
    const ws = workouts.filter((w) => w.workout_date >= start && w.workout_date <= end)
    weekly.push({ start, sessions: ws.length, sets: ws.reduce((n, w) => n + w.total_sets, 0), tonnage: ws.reduce((n, w) => n + Number(w.total_volume), 0) })
  }

  const rpes = recent.map((w) => w.session_rpe).filter(isNum)
  const durs = recent.map((w) => w.duration_min).filter(isNum)
  return {
    weeks: eff,
    sessions: recent.length,
    sessionsPerWeek: recent.length / eff,
    perMuscle,
    patterns,
    cardioMinPerWeek: cardio / eff,
    tonnagePerWeek: tonnage / eff,
    avgRpe: rpes.length ? rpes.reduce((a, b) => a + b, 0) / rpes.length : null,
    avgDuration: durs.length ? durs.reduce((a, b) => a + b, 0) / durs.length : null,
    weekly,
  }
}

/* ------------------------------ Progressione ------------------------------ */

/** Massimale stimato (Epley), affidabile fino a ~12 ripetizioni. */
export function e1rm(weight: number | null | undefined, reps: number | null | undefined): number | null {
  if (!isNum(weight) || !isNum(reps) || weight <= 0 || reps <= 0) return null
  if (reps === 1) return weight
  return weight * (1 + Math.min(reps, 12) / 30)
}

export interface ProgressPoint {
  date: string
  workoutId: string
  /** massimale stimato (kg) o ripetizioni massime (corpo libero) */
  value: number
  best: { reps: number | null; weight: number | null }
  volume: number
  sets: number
}

export interface ExerciseProgress {
  code: string
  name: string
  kind: "load" | "reps"
  points: ProgressPoint[]
  best: ProgressPoint
  last: ProgressPoint
  /** variazione %/mese sulle ultime 8 settimane */
  pctPerMonth: number | null
  status: "progress" | "stall" | "regress" | "new"
  daysSincePr: number
  sessions: number
  /** record di volume (kg × rip. in una sessione) */
  bestVolume: ProgressPoint
}

function slopePerDay(points: Array<{ x: number; y: number }>): number | null {
  if (points.length < 3) return null
  const n = points.length
  const mx = points.reduce((a, p) => a + p.x, 0) / n
  const my = points.reduce((a, p) => a + p.y, 0) / n
  let num = 0
  let den = 0
  for (const p of points) {
    num += (p.x - mx) * (p.y - my)
    den += (p.x - mx) ** 2
  }
  return den === 0 ? null : num / den
}

export function exerciseProgress(workouts: WorkoutSummary[], today: string): ExerciseProgress[] {
  const by = new Map<string, { name: string; load: ProgressPoint[]; reps: ProgressPoint[] }>()
  const chronological = [...workouts].sort((a, b) => a.workout_date.localeCompare(b.workout_date))
  for (const w of chronological) {
    for (const e of w.summary) {
      const ex = resolveExercise(e.c, e.n)
      if (ex.pattern === "cardio" || !e.sets) continue
      const entry = by.get(ex.code) ?? { name: ex.name, load: [], reps: [] }
      const base = { date: w.workout_date, workoutId: w.id, volume: e.vol ?? 0, sets: e.sets }
      if (isNum(e.e1rm) && e.e1rm > 0) {
        entry.load.push({ ...base, value: e.e1rm, best: { weight: e.top?.[0] ?? null, reps: e.top?.[1] ?? null } })
      } else if (isNum(e.maxr)) {
        entry.reps.push({ ...base, value: e.maxr, best: { weight: null, reps: e.maxr } })
      }
      by.set(ex.code, entry)
    }
  }

  const out: ExerciseProgress[] = []
  for (const [code, e] of by) {
    const kind: ExerciseProgress["kind"] = e.load.length > 0 ? "load" : "reps"
    const pts = kind === "load" ? e.load : e.reps
    if (pts.length === 0) continue
    const last = pts[pts.length - 1] as ProgressPoint
    let best = pts[0] as ProgressPoint
    let bestVolume = pts[0] as ProgressPoint
    for (const p of pts) {
      if (p.value > best.value + 1e-6) best = p
      if (p.volume > bestVolume.volume) bestVolume = p
    }
    const window = pts.filter((p) => p.date >= shiftISO(last.date, -56))
    const t0 = window[0]?.date ?? last.date
    const slope = slopePerDay(window.map((p) => ({ x: daysBetween(t0, p.date), y: p.value })))
    const mean = window.reduce((a, p) => a + p.value, 0) / Math.max(window.length, 1)
    const pctPerMonth = isNum(slope) && mean > 0 ? (slope * 30.4 * 100) / mean : null
    const daysSincePr = daysBetween(best.date, today)
    let status: ExerciseProgress["status"] = "new"
    if (pts.length >= 3 && isNum(pctPerMonth)) {
      status = pctPerMonth >= 1 ? "progress" : pctPerMonth <= -2.5 ? "regress" : daysSincePr > 35 ? "stall" : "progress"
    }
    out.push({ code, name: e.name, kind, points: pts, best, last, pctPerMonth, status, daysSincePr, sessions: pts.length, bestVolume })
  }
  return out.sort((a, b) => b.sessions - a.sessions || a.name.localeCompare(b.name))
}

/** Record personali stabiliti negli ultimi N giorni. */
export function recentPrs(progress: ExerciseProgress[], today: string, days = 30) {
  return progress.filter((p) => p.sessions >= 2 && p.best.date >= shiftISO(today, -days) && p.points[0] !== p.best)
}

/* ------------------------------ Giorno di oggi ------------------------------ */

export function isoWeekday(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number)
  return ((new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1).getDay() + 6) % 7) + 1
}

/**
 * Giorno della scheda previsto oggi: per giorno della settimana se indicato,
 * altrimenti il successivo nella rotazione rispetto all'ultima sessione svolta.
 */
export function plannedDay(tree: TrainingTree | undefined, workouts: WorkoutSummary[], today: string): { day: TrainingDay | null; rest: boolean; doneToday: WorkoutSummary | null; next: TrainingDay | null } {
  const doneToday = workouts.find((w) => w.workout_date === today) ?? null
  if (!tree || tree.days.length === 0) return { day: null, rest: false, doneToday, next: null }
  const dow = isoWeekday(today)
  const withDow = tree.days.filter((x) => x.day_of_week)
  if (withDow.length === tree.days.length) {
    const day = tree.days.find((x) => x.day_of_week === dow) ?? null
    let next: TrainingDay | null = null
    for (let i = 1; i <= 7 && !next; i++) next = tree.days.find((x) => x.day_of_week === ((dow - 1 + i) % 7) + 1) ?? null
    return { day, rest: day === null, doneToday, next }
  }
  const ids = new Set(tree.days.map((x) => x.id))
  if (doneToday?.plan_day_id && ids.has(doneToday.plan_day_id)) {
    const idx = tree.days.findIndex((x) => x.id === doneToday.plan_day_id)
    return { day: tree.days[idx] ?? null, rest: false, doneToday, next: tree.days[(idx + 1) % tree.days.length] ?? null }
  }
  const last = workouts.find((w) => w.plan_day_id && ids.has(w.plan_day_id) && w.workout_date < today)
  const idx = last ? tree.days.findIndex((x) => x.id === last.plan_day_id) : -1
  const day = tree.days[(idx + 1) % tree.days.length] ?? null
  return { day, rest: false, doneToday, next: tree.days[(idx + 2) % tree.days.length] ?? null }
}

/* --------------------------- Ultime serie svolte --------------------------- */

export interface LastPerformance {
  date: string
  /** serie allenanti (senza riscaldamento) */
  sets: CompactSet[]
  /** serie di riscaldamento (solo dalle sessioni complete) */
  warmups?: CompactSet[]
}

/**
 * Ultima esecuzione di un esercizio: serie complete se recenti, altrimenti
 * la serie migliore dal riepilogo (sessioni vecchie non scaricate per intero).
 */
export function lastPerformance(code: string, recent: Workout[], summaries: WorkoutSummary[], beforeDate?: string): LastPerformance | null {
  for (const w of recent) {
    if (beforeDate && w.workout_date > beforeDate) continue
    const e = w.exercises.find((x) => resolveExercise(x.c, x.n).code === code)
    const sets = e?.s?.filter((s) => s[3] !== 1) ?? []
    if (sets.length) return { date: w.workout_date, sets, warmups: e?.s?.filter((s) => s[3] === 1) ?? [] }
  }
  for (const w of summaries) {
    if (beforeDate && w.workout_date > beforeDate) continue
    const e = w.summary.find((x) => resolveExercise(x.c, x.n).code === code)
    if (e?.top) return { date: w.workout_date, sets: Array.from({ length: e.sets ?? 1 }, () => [e.top?.[1] ?? 0, e.top?.[0] ?? null, null, 0] as CompactSet) }
    if (e?.maxr) return { date: w.workout_date, sets: Array.from({ length: e.sets ?? 1 }, () => [e.maxr ?? 0, null, null, 0] as CompactSet) }
  }
  return null
}

/* -------------------------------- Costanza -------------------------------- */

export function streakWeeks(workouts: WorkoutSummary[], today: string, target: number): number {
  let streak = 0
  for (let i = 0; i < 104; i++) {
    const start = shiftISO(today, -(i + 1) * 7 + 1)
    const end = shiftISO(today, -i * 7)
    const n = workouts.filter((w) => w.workout_date >= start && w.workout_date <= end).length
    if (i === 0 && n < target) continue
    if (n >= Math.max(1, Math.floor(target * 0.75))) streak++
    else break
  }
  return streak
}

/** Calendario: giorni con allenamento negli ultimi N giorni (per la heatmap). */
export function activityCalendar(workouts: WorkoutSummary[], today: string, days = 182) {
  const map = new Map<string, { sets: number; titles: string[] }>()
  const from = shiftISO(today, -days + 1)
  for (const w of workouts) {
    if (w.workout_date < from || w.workout_date > today) continue
    const cur = map.get(w.workout_date) ?? { sets: 0, titles: [] }
    cur.sets += w.total_sets
    cur.titles.push(w.title)
    map.set(w.workout_date, cur)
  }
  return map
}

/** Durata stimata di un giorno di scheda (serie × (recupero + 40 s) + cardio). */
export function estimateMinutes(day: { exercises: Array<{ sets: number | null; rest_seconds: number | null; duration_min: number | null }> }) {
  return Math.round(day.exercises.reduce((n, e) => n + (e.sets ?? 0) * (((e.rest_seconds ?? 90) + 40) / 60) + (e.duration_min ?? 0), 0))
}

/** Gruppo di una serie per il confronto con la volta precedente. */
const setGroup = (t: number) => (t === 1 ? 1 : t === 2 ? 2 : t === 3 ? 3 : 0)

/**
 * Serie corrispondente della volta precedente: stessa posizione tra le serie
 * dello stesso tipo (riscaldamento con riscaldamento, drop con drop…).
 * Per le serie allenanti in più rispetto all'ultima volta si usa l'ultima.
 */
export function previousSet(last: LastPerformance | null, types: number[], index: number): CompactSet | null {
  if (!last) return null
  const g = setGroup(types[index] ?? 0)
  let k = 0
  for (let i = 0; i < index; i++) if (setGroup(types[i] ?? 0) === g) k++
  const pool = g === 1 ? (last.warmups ?? []) : last.sets.filter((s) => setGroup(s[3]) === g)
  return pool[k] ?? (g === 0 ? (pool[pool.length - 1] ?? null) : null)
}

/** "4 × 8–10", "4 × max" (ripetizioni libere) o "a sensazione" se non indicato. */
export function setsLabel(e: { sets: number | null; reps_min: number | null; reps_max: number | null }) {
  if (!e.sets && !e.reps_min && !e.reps_max) return "libero"
  const reps = e.reps_min ? `${e.reps_min}${e.reps_max && e.reps_max !== e.reps_min ? `–${e.reps_max}` : ""}` : e.reps_max ? `${e.reps_max}` : "max"
  return `${e.sets ?? "?"} × ${reps}`
}

/* --------------------------------- Emoji --------------------------------- */

const MUSCLE_EMOJI: Record<string, string> = {
  chest: "🏋️",
  lats: "🦅",
  upper_back: "🦅",
  front_delts: "🤸",
  side_delts: "🤸",
  rear_delts: "🤸",
  biceps: "💪",
  triceps: "💪",
  forearms: "✊",
  quads: "🦵",
  hamstrings: "🦵",
  glutes: "🍑",
  adductors: "🦵",
  calves: "🦶",
  abs: "🔥",
  lower_back: "🧱",
}

/** Emoji di un esercizio: 🏃 cardio, altrimenti in base al muscolo principale. */
const NAME_EMOJI: Array<[RegExp, string]> = [
  [/tapis|corsa|cyclette|bike|ellittic|cammin|vogator|cardio|hiit|corda|stair|spinning|nuoto/, "🏃"],
  [/calf|polpacc/, "🦶"],
  [/crunch|plank|addom|core|sit[- ]?up|leg raise|russian|ab wheel/, "🔥"],
  [/hip thrust|glute|abdu|kickback|ponte/, "🍑"],
  [/curl(?! (femoral|gamb|leg))|bicip|tricip|french|push ?down|skull|hammer/, "💪"],
  [/alzat|military|shoulder|lento|arnold|face pull|spall|deltoid/, "🤸"],
  [/panca|chest|croci|petto|push[- ]?up|piegament|dip|pectoral/, "🏋️"],
  [/lat |lat$|lat machine|rematore|pull|trazion|row|pulley|dorsal/, "🦅"],
  [/stacc|deadlift|good morning|hyperext|iperestens/, "🍑"],
  [/squat|leg press|pressa|affond|lunge|leg ext|leg curl|curl femoral|bulgar|step|quadric|femoral/, "🦵"],
]

export function exerciseEmoji(code: string, name: string, row?: Parameters<typeof resolveExercise>[2]): string {
  if (!findExercise(code, name) && !row?.muscle_primary) {
    const n = name.toLowerCase()
    for (const [re, e] of NAME_EMOJI) if (re.test(n)) return e
  }
  const r = resolveExercise(code, name, row)
  if (r.pattern === "cardio") return "🏃"
  if (r.pattern === "carry") return "🧳"
  if (r.primary) return MUSCLE_EMOJI[r.primary] ?? "🏋️"
  if (r.pattern === "core") return "🔥"
  if (r.pattern === "squat" || r.pattern === "lunge") return "🦵"
  if (r.pattern === "hinge") return "🍑"
  if (r.pattern === "horizontal_pull" || r.pattern === "vertical_pull") return "🦅"
  return "🏋️"
}
