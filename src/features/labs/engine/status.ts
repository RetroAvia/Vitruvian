/** Stato di un valore rispetto al range di riferimento. */
import { isNum } from "@/lib/format"
import type { LabFlag } from "@/types/domain"

export function flagOf(value: number | null | undefined, low: number | null | undefined, high: number | null | undefined): LabFlag {
  if (!isNum(value)) return "unknown"
  if (!isNum(low) && !isNum(high)) return "unknown"
  if (isNum(low) && value < low) return "low"
  if (isNum(high) && value > high) return "high"
  return "normal"
}

export const FLAG_LABELS: Record<LabFlag, string> = {
  low: "Basso",
  normal: "Nel range",
  high: "Alto",
  unknown: "Senza range",
}

/**
 * Posizione nel range: 0 = limite inferiore, 1 = limite superiore.
 * Con un solo limite usa una scala relativa a quel limite.
 */
export function rangePosition(value: number, low: number | null, high: number | null): number | null {
  if (isNum(low) && isNum(high) && high > low) return (value - low) / (high - low)
  if (isNum(high) && high > 0) return value / high
  if (isNum(low) && low > 0) return 1 - (value - low) / low
  return null
}

/** Vicino al limite (ultimo 10% del range) ma ancora dentro. */
export function nearLimit(value: number, low: number | null, high: number | null): "low" | "high" | null {
  if (flagOf(value, low, high) !== "normal") return null
  if (isNum(low) && isNum(high) && high > low) {
    const pos = (value - low) / (high - low)
    if (pos >= 0.9) return "high"
    if (pos <= 0.1) return "low"
    return null
  }
  if (isNum(high) && value >= high * 0.9) return "high"
  if (isNum(low) && value <= low * 1.1) return "low"
  return null
}
