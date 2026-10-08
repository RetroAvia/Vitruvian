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

/** Visite precedenti alla data indicata (dalla più recente), escludendo quella in modifica. */
export function findPreviousCheckup(checkups: Checkup[], date: string, excludeId?: string): Checkup[] {
  return checkups.filter((c) => c.id !== excludeId && c.checkup_date < date).sort((a, b) => (a.checkup_date < b.checkup_date ? 1 : -1))
}

const sitesOf = (c: Checkup) => (c.all_sites && typeof c.all_sites === "object" && !Array.isArray(c.all_sites) ? (c.all_sites as Record<string, unknown>) : {})

/**
 * Confronta ogni valore con l'ultima visita in cui quel dato è stato misurato
 * (una visita con solo peso non blocca i controlli BIA; la BIA solo con lo stesso strumento).
 */
export function checkPlausibility(values: CheckupFormInput, previous: Checkup[] | Checkup | undefined): PlausibilityWarning[] {
  const prevs = Array.isArray(previous) ? previous : previous ? [previous] : []
  if (prevs.length === 0) return []
  const warnings: PlausibilityWarning[] = []
  const protocol = values.protocol_id || null

  for (const [field, cfg] of Object.entries(LIMITS)) {
    const curr = parseDecimal(values[field as keyof typeof LIMITS])
    if (!isNum(curr)) continue
    // le grandezze BIA si confrontano solo con l'ultima misura dello stesso strumento
    const ref = prevs.find((p) => isNum(p[field as keyof typeof LIMITS]) && (field === "weight_kg" || (p.protocol_id ?? null) === protocol))
    if (!ref) continue
    const before = ref[field as keyof typeof LIMITS] as number
    const diff = curr - before
    if (Math.abs(diff) > cfg.abs) {
      warnings.push({
        field,
        message: `${formatSigned(diff, 1)} ${cfg.unit} rispetto all'ultima misura (${formatNumber(before, 1)}): verifica il valore`.replace("  ", " "),
      })
    }
  }

  for (const [key, raw] of Object.entries(values.circumferences ?? {})) {
    const curr = parseDecimal(raw)
    if (!isNum(curr)) continue
    const before = prevs.map((p) => sitesOf(p)[key]).find((v) => typeof v === "number") as number | undefined
    if (before === undefined) continue
    const diff = curr - before
    if (Math.abs(diff) > CIRC_LIMIT_CM) {
      warnings.push({
        field: `circumferences.${key}`,
        message: `${formatSigned(diff, 1)} cm rispetto all'ultima misura (${formatNumber(before, 1)})`,
      })
    }
  }

  return warnings
}
