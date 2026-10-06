/**
 * Bilancio energetico e adeguatezza dei macronutrienti.
 *  - Bilancio = kcal del piano − TDEE stimato
 *  - Proteine: 1,6–2,2 g/kg per chi si allena con i pesi (ISSN, 2017)
 *  - Grassi: 20–35% delle calorie · Fibre: ≥ 25 g/giorno
 */
import { isNum } from "@/lib/format"

export type BalanceStatus = "deficit_aggressive" | "deficit" | "maintenance" | "surplus" | "surplus_high" | "unknown"

export const BALANCE_LABELS: Record<BalanceStatus, string> = {
  deficit_aggressive: "Deficit marcato",
  deficit: "Deficit",
  maintenance: "Mantenimento",
  surplus: "Surplus",
  surplus_high: "Surplus elevato",
  unknown: "Non calcolabile",
}

export interface EnergyBalance {
  planKcal: number | null
  tdee: number | null
  bmr: number | null
  delta: number | null
  pct: number | null
  status: BalanceStatus
  belowBmr: boolean
}

export function energyBalance(planKcal: number | null, tdee: number | null, bmr: number | null): EnergyBalance {
  if (!isNum(planKcal) || !isNum(tdee) || tdee <= 0) {
    return { planKcal, tdee, bmr, delta: null, pct: null, status: "unknown", belowBmr: false }
  }
  const delta = planKcal - tdee
  const pct = (delta / tdee) * 100
  const status: BalanceStatus =
    pct < -25 ? "deficit_aggressive" : pct < -8 ? "deficit" : pct <= 8 ? "maintenance" : pct <= 20 ? "surplus" : "surplus_high"
  return { planKcal, tdee, bmr, delta, pct, status, belowBmr: isNum(bmr) && planKcal < bmr }
}

export function perKg(grams: number | null | undefined, kg: number | null | undefined) {
  return isNum(grams) && isNum(kg) && kg > 0 ? grams / kg : null
}
