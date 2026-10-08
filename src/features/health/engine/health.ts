/**
 * Dati giornalieri da Apple Salute (via Comandi Rapidi): medie, tendenze e
 * confronti settimanali. Funzioni pure, testabili.
 */
import { isNum } from "@/lib/format"

export interface HealthDay {
  day: string
  steps: number | null
  active_kcal: number | null
  resting_hr: number | null
  hrv_ms: number | null
  sleep_min: number | null
  weight_kg: number | null
}

export type HealthMetric = "steps" | "sleep_min" | "resting_hr" | "active_kcal" | "hrv_ms" | "weight_kg"

export const HEALTH_METRICS: Record<HealthMetric, { label: string; emoji: string; unit: string; digits: number; higherIsBetter: boolean | null }> = {
  steps: { label: "Passi", emoji: "👟", unit: "", digits: 0, higherIsBetter: true },
  sleep_min: { label: "Sonno", emoji: "😴", unit: "h", digits: 1, higherIsBetter: true },
  resting_hr: { label: "Battiti a riposo", emoji: "❤️", unit: "bpm", digits: 0, higherIsBetter: false },
  active_kcal: { label: "Calorie attive", emoji: "🔥", unit: "kcal", digits: 0, higherIsBetter: true },
  hrv_ms: { label: "Variabilità cardiaca", emoji: "💓", unit: "ms", digits: 0, higherIsBetter: true },
  weight_kg: { label: "Peso (Salute)", emoji: "⚖️", unit: "kg", digits: 1, higherIsBetter: null },
}

function shift(iso: string, n: number) {
  const [y, m, d] = iso.split("-").map(Number)
  const dt = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, (d ?? 1) + n))
  return dt.toISOString().slice(0, 10)
}

/** Valore mostrato: il sonno in ore. */
export function metricValue(d: HealthDay, m: HealthMetric): number | null {
  const v = d[m]
  if (!isNum(v)) return null
  return m === "sleep_min" ? v / 60 : v
}

function avg(values: number[]) {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null
}

export interface MetricSummary {
  metric: HealthMetric
  /** ultimo valore disponibile (oggi o i giorni precedenti) */
  latest: number | null
  latestDay: string | null
  /** media ultimi 7 giorni (con dati) */
  avg7: number | null
  /** media dei 7 giorni prima */
  prev7: number | null
  /** media ultimi 28 giorni */
  avg28: number | null
  days7: number
  /** valori degli ultimi 14 giorni (null = nessun dato), dal più vecchio */
  series14: Array<number | null>
}

export function summarizeHealth(rows: HealthDay[], today: string): Record<HealthMetric, MetricSummary> | null {
  if (!rows.length) return null
  const byDay = new Map(rows.map((r) => [r.day, r]))
  const out = {} as Record<HealthMetric, MetricSummary>
  for (const m of Object.keys(HEALTH_METRICS) as HealthMetric[]) {
    const window = (from: number, to: number) => {
      const vals: number[] = []
      for (let i = from; i < to; i++) {
        const d = byDay.get(shift(today, -i))
        const v = d ? metricValue(d, m) : null
        if (isNum(v)) vals.push(v)
      }
      return vals
    }
    // passi e calorie di oggi sono parziali fino a sera: medie sui giorni conclusi
    const off = m === "steps" || m === "active_kcal" ? 1 : 0
    const last7 = window(off, off + 7)
    let latest: number | null = null
    let latestDay: string | null = null
    for (let i = 0; i < 30 && latest === null; i++) {
      const d = byDay.get(shift(today, -i))
      const v = d ? metricValue(d, m) : null
      if (isNum(v)) {
        latest = v
        latestDay = d?.day ?? null
      }
    }
    const series14: Array<number | null> = []
    for (let i = 13; i >= 0; i--) {
      const d = byDay.get(shift(today, -i))
      series14.push(d ? metricValue(d, m) : null)
    }
    out[m] = { metric: m, latest, latestDay, avg7: avg(last7), prev7: avg(window(off + 7, off + 14)), avg28: avg(window(off, off + 28)), days7: last7.length, series14 }
  }
  return out
}

/** Ci sono dati recenti (ultimi 14 giorni) per almeno una metrica? */
export function hasRecentHealth(s: Record<HealthMetric, MetricSummary> | null): s is Record<HealthMetric, MetricSummary> {
  return Boolean(s && Object.values(s).some((x) => x.series14.some((v) => v !== null)))
}

/** "7,4 h", "8.432", "58 bpm" */
export function formatMetric(m: HealthMetric, v: number | null): string {
  if (!isNum(v)) return "—"
  const def = HEALTH_METRICS[m]
  if (m === "sleep_min") {
    const h = Math.floor(v)
    const min = Math.round((v - h) * 60)
    return min === 60 ? `${h + 1} h` : `${h} h ${String(min).padStart(2, "0")}`
  }
  const s = v.toLocaleString("it-IT", { maximumFractionDigits: def.digits, minimumFractionDigits: def.digits })
  return def.unit ? `${s} ${def.unit}` : s
}
