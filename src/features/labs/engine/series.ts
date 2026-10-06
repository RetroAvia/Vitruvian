/**
 * Serie storiche per esame: ultimo valore, variazione, tendenza annua.
 */
import { daysBetween, isNum } from "@/lib/format"
import type { LabCategory, LabFlag, LabResult } from "@/types/domain"

import { flagOf } from "./status"

export interface LabPoint {
  id: string
  reportId: string
  date: string
  value: number | null
  valueText: string | null
  refLow: number | null
  refHigh: number | null
  refFromLab: boolean
  flag: LabFlag
  lab: string | null
  unit: string | null
}

export type TrendDirection = "up" | "down" | "flat" | "unknown"

export interface AnalyteSeries {
  analyteId: number
  code: string
  name: string
  category: LabCategory
  unit: string | null
  digits: number
  sortOrder: number
  points: LabPoint[]
  latest: LabPoint
  previous: LabPoint | null
  delta: number | null
  /** Variazione stimata per anno (regressione lineare), null con meno di 3 punti */
  slopePerYear: number | null
  trend: TrendDirection
  outOfRangeCount: number
}

function linearSlopePerYear(points: Array<{ date: string; value: number }>): number | null {
  if (points.length < 3) return null
  const t0 = points[0]?.date
  if (!t0) return null
  const xs = points.map((p) => daysBetween(t0, p.date) / 365.25)
  const ys = points.map((p) => p.value)
  const n = xs.length
  const mx = xs.reduce((a, b) => a + b, 0) / n
  const my = ys.reduce((a, b) => a + b, 0) / n
  let num = 0
  let den = 0
  for (let i = 0; i < n; i++) {
    num += ((xs[i] as number) - mx) * ((ys[i] as number) - my)
    den += ((xs[i] as number) - mx) ** 2
  }
  return den === 0 ? null : num / den
}

export function buildSeries(results: LabResult[]): AnalyteSeries[] {
  const groups = new Map<number, LabResult[]>()
  for (const r of results) {
    const list = groups.get(r.analyte_id) ?? []
    list.push(r)
    groups.set(r.analyte_id, list)
  }

  const out: AnalyteSeries[] = []
  for (const list of groups.values()) {
    list.sort((a, b) => a.report_date.localeCompare(b.report_date))
    const points: LabPoint[] = list.map((r) => ({
      id: r.id,
      reportId: r.report_id,
      date: r.report_date,
      value: r.value,
      valueText: r.value_text,
      refLow: r.ref_low,
      refHigh: r.ref_high,
      refFromLab: Boolean(r.ref_from_lab),
      flag: flagOf(r.value, r.ref_low, r.ref_high),
      lab: r.lab_name,
      unit: r.unit,
    }))
    const first = list[0] as LabResult
    const latest = points[points.length - 1] as LabPoint
    const previous = [...points].slice(0, -1).reverse().find((p) => isNum(p.value)) ?? null
    const numeric = points.filter((p): p is LabPoint & { value: number } => isNum(p.value))
    const slope = linearSlopePerYear(numeric)
    const mean = numeric.length ? numeric.reduce((a, p) => a + p.value, 0) / numeric.length : 0
    // Tendenza significativa se varia più del 5% della media all'anno
    const trend: TrendDirection =
      slope === null ? "unknown" : Math.abs(slope) < Math.abs(mean) * 0.05 ? "flat" : slope > 0 ? "up" : "down"

    out.push({
      analyteId: first.analyte_id,
      code: first.code,
      name: first.name,
      category: first.category,
      unit: latest.unit ?? first.unit,
      digits: first.digits,
      sortOrder: first.sort_order,
      points,
      latest,
      previous,
      delta: isNum(latest.value) && previous && isNum(previous.value) ? latest.value - previous.value : null,
      slopePerYear: slope,
      trend,
      outOfRangeCount: points.filter((p) => p.flag === "low" || p.flag === "high").length,
    })
  }
  return out.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
}
