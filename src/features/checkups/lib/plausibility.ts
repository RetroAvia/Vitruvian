/**
 * Controlli di plausibilità in tempo reale: non bloccano il salvataggio,
 * segnalano variazioni anomale rispetto alla visita precedente
 * (tipicamente errori di battitura: 47,5 invece di 74,5).
 */
import { formatNumber, formatSigned, isNum } from "@/lib/format"
import type { Checkup } from "@/types/domain"

import { parseDecimal, type CheckupFormInput } from "../schemas/checkup-form"

export interface PlausibilityWarning {
  field: string
  message: string
}

const LIMITS = {
  weight_kg: { abs: 4, label: "Peso", unit: "kg" },
  fat_mass_pct: { abs: 4, label: "Massa grassa", unit: "%" },
  lean_mass_kg: { abs: 3, label: "Massa magra", unit: "kg" },
  bmr_kcal: { abs: 150, label: "BMR", unit: "kcal" },
  total_body_water_pct: { abs: 6, label: "Acqua", unit: "%" },
  visceral_fat: { abs: 2, label: "Viscerale", unit: "" },
} as const

const CIRC_LIMIT_CM = 4

/** Visita precedente alla data indicata (escludendo quella in modifica). */
export function findPreviousCheckup(checkups: Checkup[], date: string, excludeId?: string) {
  let prev: Checkup | undefined
  for (const c of checkups) {
    if (c.id === excludeId || c.checkup_date >= date) continue
    if (!prev || c.checkup_date > prev.checkup_date) prev = c
  }
  return prev
}

export function checkPlausibility(values: CheckupFormInput, prev: Checkup | undefined): PlausibilityWarning[] {
  if (!prev) return []
  const warnings: PlausibilityWarning[] = []
  const sameProtocol = (values.protocol_id || null) === (prev.protocol_id ?? null)

  for (const [field, cfg] of Object.entries(LIMITS)) {
    // Le grandezze BIA si confrontano solo con lo stesso strumento
    if (field !== "weight_kg" && !sameProtocol) continue
    const curr = parseDecimal(values[field as keyof typeof LIMITS])
    const before = prev[field as keyof typeof LIMITS]
    if (!isNum(curr) || !isNum(before)) continue
    const diff = curr - before
    if (Math.abs(diff) > cfg.abs) {
      warnings.push({
        field,
        message: `${formatSigned(diff, 1)} ${cfg.unit} rispetto all'ultima visita (${formatNumber(before, 1)}): verifica il valore`.replace("  ", " "),
      })
    }
  }

  const prevSites = prev.all_sites && typeof prev.all_sites === "object" && !Array.isArray(prev.all_sites) ? prev.all_sites : {}
  for (const [key, raw] of Object.entries(values.circumferences ?? {})) {
    const curr = parseDecimal(raw)
    const before = prevSites[key]
    if (!isNum(curr) || typeof before !== "number") continue
    const diff = curr - before
    if (Math.abs(diff) > CIRC_LIMIT_CM) {
      warnings.push({
        field: `circumferences.${key}`,
        message: `${formatSigned(diff, 1)} cm rispetto all'ultima visita (${formatNumber(before, 1)})`,
      })
    }
  }

  return warnings
}
