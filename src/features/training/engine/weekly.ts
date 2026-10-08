/**
 * Riepilogo della settimana (lunedì–domenica) confrontato con la precedente:
 * sessioni, serie, volume, minuti, muscoli più allenati e record personali.
 */
import { resolveExercise } from "./analysis"
import { MUSCLES, type Muscle } from "./catalog"
import type { WorkoutSummary } from "../types"

export interface WeekStats {
  from: string
  to: string
  sessions: number
  sets: number
  volume: number
  minutes: number
}

export interface WeeklySummary {
  current: WeekStats
  previous: WeekStats
  /** giorni della settimana corrente con allenamento (1 = lunedì) */
  trainedDays: number[]
  topMuscles: Array<{ muscle: Muscle; label: string; sets: number }>
  prs: Array<{ name: string; e1rm: number; previous: number }>
  /** giorni trascorsi della settimana (1–7) */
  elapsed: number
}

function shift(iso: string, n: number) {
  const [y, m, d] = iso.split("-").map(Number)
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, (d ?? 1) + n)).toISOString().slice(0, 10)
}

function weekday(iso: string) {
  const [y, m, d] = iso.split("-").map(Number)
  return ((new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1)).getUTCDay() + 6) % 7) + 1
}

function stats(ws: WorkoutSummary[], from: string, to: string): WeekStats {
  const inWeek = ws.filter((w) => w.workout_date >= from && w.workout_date <= to)
  return {
    from,
    to,
    sessions: inWeek.length,
    sets: inWeek.reduce((n, w) => n + (w.total_sets ?? 0), 0),
    volume: inWeek.reduce((n, w) => n + Number(w.total_volume ?? 0), 0),
    minutes: inWeek.reduce((n, w) => n + (w.duration_min ?? 0), 0),
  }
}

export function weeklySummary(workouts: WorkoutSummary[], today: string): WeeklySummary {
  const elapsed = weekday(today)
  const monday = shift(today, -(elapsed - 1))
  const sunday = shift(monday, 6)
  const prevMonday = shift(monday, -7)
  const current = stats(workouts, monday, sunday)
  const previous = stats(workouts, prevMonday, shift(monday, -1))

  const thisWeek = workouts.filter((w) => w.workout_date >= monday && w.workout_date <= sunday)
  const trainedDays = [...new Set(thisWeek.map((w) => weekday(w.workout_date)))].sort()

  const perMuscle = new Map<Muscle, number>()
  for (const w of thisWeek)
    for (const e of w.summary ?? []) {
      const r = resolveExercise(e.c, e.n)
      if (r.primary && e.sets) perMuscle.set(r.primary, (perMuscle.get(r.primary) ?? 0) + e.sets)
    }
  const topMuscles = [...perMuscle.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([muscle, sets]) => ({ muscle, label: MUSCLES[muscle], sets }))

  // record: miglior massimale stimato della settimana oltre il meglio di prima
  const before = new Map<string, number>()
  const week = new Map<string, { name: string; e1rm: number }>()
  for (const w of workouts)
    for (const e of w.summary ?? []) {
      if (!e.e1rm) continue
      const code = resolveExercise(e.c, e.n).code
      if (w.workout_date < monday) before.set(code, Math.max(before.get(code) ?? 0, e.e1rm))
      else if (w.workout_date <= sunday && e.e1rm > (week.get(code)?.e1rm ?? 0)) week.set(code, { name: e.n, e1rm: e.e1rm })
    }
  const prs = [...week.entries()]
    .filter(([code, x]) => (before.get(code) ?? 0) > 0 && x.e1rm > (before.get(code) ?? 0) * 1.005)
    .map(([code, x]) => ({ name: x.name, e1rm: x.e1rm, previous: before.get(code) ?? 0 }))
    .sort((a, b) => b.e1rm / b.previous - a.e1rm / a.previous)

  return { current, previous, trainedDays, topMuscles, prs, elapsed }
}
