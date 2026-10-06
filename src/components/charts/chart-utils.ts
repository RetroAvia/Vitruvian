/** Utility condivise dai grafici: scala temporale, tick, filtri per periodo. */
import { parseISODate } from "@/lib/format"
import type { TimeRange } from "@/stores/ui-store"

export const SERIES = ["var(--series-1)", "var(--series-2)", "var(--series-3)", "var(--series-4)", "var(--series-5)"] as const

export const AXIS_PROPS = {
  stroke: "var(--chart-axis)",
  tick: { fill: "var(--chart-axis)", fontSize: 11 },
  tickLine: false,
  axisLine: false,
} as const

export const GRID_PROPS = {
  stroke: "var(--chart-grid)",
  strokeDasharray: "0",
  vertical: false,
} as const

export function toTime(iso: string) {
  return parseISODate(iso).getTime()
}

const monthFmt = new Intl.DateTimeFormat("it-IT", { month: "short", year: "2-digit" })
export function formatMonthTick(t: number) {
  return monthFmt.format(new Date(t)).replace(" ", " ’")
}

/** Tick mensili "puliti" (inizio mese) con al massimo `max` etichette. */
export function monthTicks(min: number, max: number, maxTicks = 6): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max) || min >= max) return Number.isFinite(min) ? [min] : []
  const start = new Date(min)
  const end = new Date(max)
  const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth())
  const step = Math.max(1, Math.ceil(months / maxTicks))
  const ticks: number[] = []
  const d = new Date(start.getFullYear(), start.getMonth() + 1, 1)
  while (d.getTime() <= max) {
    ticks.push(d.getTime())
    d.setMonth(d.getMonth() + step)
  }
  return ticks
}

export function rangeStartISO(range: TimeRange, lastISO: string): string | null {
  if (range === "all") return null
  const d = parseISODate(lastISO)
  d.setMonth(d.getMonth() - (range === "3m" ? 3 : range === "6m" ? 6 : 12))
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Filtra per periodo, relativo all'ultima visita (non a oggi: i controlli sono radi). */
export function filterByRange<T extends { checkup_date: string }>(rows: T[], range: TimeRange): T[] {
  const last = rows[rows.length - 1]
  if (!last) return rows
  const start = rangeStartISO(range, last.checkup_date)
  return start ? rows.filter((r) => r.checkup_date >= start) : rows
}

/** Dominio Y con margine, arrotondato a passi leggibili. */
export function paddedDomain(values: Array<number | null | undefined>, pad = 0.08, step = 1): [number, number] {
  const v = values.filter((x): x is number => typeof x === "number" && Number.isFinite(x))
  if (v.length === 0) return [0, 1]
  const min = Math.min(...v)
  const max = Math.max(...v)
  const span = Math.max(max - min, step * 2)
  return [Math.floor((min - span * pad) / step) * step, Math.ceil((max + span * pad) / step) * step]
}
