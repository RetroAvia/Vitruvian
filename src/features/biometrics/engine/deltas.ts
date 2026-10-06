/**
 * Variazioni (delta) di una metrica rispetto a tre riferimenti:
 *  - "previous": visita precedente con un valore
 *  - "segment":  prima visita dello strumento attuale
 *  - "baseline": prima visita assoluta
 * Per le metriche BIA il confronto è valido solo nello stesso segmento.
 */
import { daysBetween, isNum } from "@/lib/format"
import type { Checkup } from "@/types/domain"

import type { MetricDef } from "./metrics"
import { segmentOf, type Segment } from "./segments"

export type DeltaBase = "previous" | "segment" | "baseline"

export const DELTA_BASE_LABELS: Record<DeltaBase, string> = {
  previous: "vs precedente",
  segment: "vs inizio strumento",
  baseline: "vs prima visita",
}

export interface DeltaResult {
  value: number | null
  pct: number | null
  from: Checkup | null
  days: number | null
  /** Variazione normalizzata a 30 giorni */
  per30: number | null
  /** false se il riferimento esiste ma non è confrontabile (strumento diverso) */
  comparable: boolean
}

const EMPTY: DeltaResult = { value: null, pct: null, from: null, days: null, per30: null, comparable: true }

export function computeDelta(
  chronological: Checkup[],
  segments: Segment[],
  target: Checkup,
  metric: MetricDef,
  base: DeltaBase,
): DeltaResult {
  const curr = metric.get(target)
  if (!isNum(curr)) return EMPTY

  const idx = chronological.findIndex((c) => c.id === target.id)
  if (idx <= 0) return EMPTY
  const earlier = chronological.slice(0, idx).filter((c) => isNum(metric.get(c)))
  if (earlier.length === 0) return EMPTY

  const seg = segmentOf(segments, target.id)
  const sameSegment = (c: Checkup) => seg?.checkups.some((x) => x.id === c.id) ?? false

  let from: Checkup | undefined
  if (base === "previous") from = earlier[earlier.length - 1]
  else if (base === "segment") from = earlier.find(sameSegment)
  else from = earlier[0]

  if (!from) return { ...EMPTY, comparable: base !== "segment" }
  if (metric.bia && !sameSegment(from)) return { ...EMPTY, from, comparable: false }

  const prev = metric.get(from) as number
  const value = curr - prev
  const days = daysBetween(from.checkup_date, target.checkup_date)
  return {
    value,
    pct: prev !== 0 ? (value / prev) * 100 : null,
    from,
    days,
    per30: days > 0 ? (value / days) * 30 : null,
    comparable: true,
  }
}
