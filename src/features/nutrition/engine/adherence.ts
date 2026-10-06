/**
 * Aderenza al piano: pasti segnati come "fatto" (o "sostituito", conta a metà)
 * rispetto ai pasti previsti nei giorni considerati.
 */
import type { DayWithMeals, MealLog } from "../types"
import { dayForDate } from "./totals"

export interface DayAdherence {
  date: string
  expected: number
  done: number
  swapped: number
  skipped: number
  /** 0–1, null se nessun pasto registrato quel giorno */
  ratio: number | null
}

function shift(iso: string, days: number) {
  const [y, m, d] = iso.split("-").map(Number)
  const dt = new Date(y ?? 1970, (m ?? 1) - 1, (d ?? 1) + days)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`
}

export function adherenceSeries(days: DayWithMeals[], logs: MealLog[], today: string, span: number, since?: string | null): DayAdherence[] {
  const mealToDay = new Map<string, DayWithMeals>()
  days.forEach((d) => d.meals.forEach((m) => mealToDay.set(m.id, d)))
  const out: DayAdherence[] = []

  for (let i = span - 1; i >= 0; i--) {
    const date = shift(today, -i)
    if (since && date < since) continue
    const dayLogs = logs.filter((l) => l.log_date === date && mealToDay.has(l.meal_id))
    // Per piani con più "giorni tipo" (es. allenamento/riposo) usa il giorno dei pasti registrati
    const loggedDay = dayLogs[0] ? mealToDay.get(dayLogs[0].meal_id) : undefined
    const day = loggedDay ?? dayForDate(days, date)
    const expected = day?.meals.length ?? 0
    const done = dayLogs.filter((l) => l.status === "done").length
    const swapped = dayLogs.filter((l) => l.status === "swapped").length
    const skipped = dayLogs.filter((l) => l.status === "skipped").length
    out.push({
      date,
      expected,
      done,
      swapped,
      skipped,
      ratio: dayLogs.length === 0 || expected === 0 ? null : Math.min(1, (done + swapped * 0.5) / expected),
    })
  }
  return out
}

/** Media sui soli giorni tracciati (i giorni senza registrazioni non penalizzano). */
export function adherenceScore(series: DayAdherence[]) {
  const tracked = series.filter((d) => d.ratio !== null)
  if (tracked.length === 0) return { score: null as number | null, trackedDays: 0 }
  return {
    score: tracked.reduce((a, d) => a + (d.ratio as number), 0) / tracked.length,
    trackedDays: tracked.length,
  }
}
