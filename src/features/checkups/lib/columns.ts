/**
 * Definizione delle colonne della tabella visite: una sola configurazione
 * per header, celle, ordinamento, delta ed export CSV.
 */
import type { Polarity } from "@/components/shared/delta-pill"
import { CORE_SITES } from "@/config/constants"
import type { CheckupColumnGroup } from "@/stores/ui-store"
import type { Checkup, MeasurementSite } from "@/types/domain"

import { parseSiteKey } from "../schemas/checkup-form"

export interface CheckupColumn {
  id: string
  label: string
  unit?: string
  digits: number
  group: CheckupColumnGroup | "base"
  /** Le grandezze BIA si confrontano solo a parità di strumento */
  bia?: boolean
  polarity: Polarity
  get: (c: Checkup) => number | null
}

export const COLUMN_GROUP_LABELS: Record<CheckupColumnGroup, string> = {
  bia: "BIA",
  circ: "Circonferenze",
  index: "Indici",
}

function siteValue(c: Checkup, key: string): number | null {
  const sites = c.all_sites
  if (!sites || typeof sites !== "object" || Array.isArray(sites)) return null
  const v = sites[key]
  return typeof v === "number" ? v : null
}

export function buildColumns(checkups: Checkup[], sites: MeasurementSite[]): CheckupColumn[] {
  const base: CheckupColumn[] = [
    { id: "weight_kg", label: "Peso", unit: "kg", digits: 1, group: "base", polarity: "neutral", get: (c) => c.weight_kg },
  ]

  const bia: CheckupColumn[] = [
    { id: "fat_mass_pct", label: "MG", unit: "%", digits: 1, group: "bia", bia: true, polarity: "lower-better", get: (c) => c.fat_mass_pct },
    { id: "fat_mass_kg", label: "MG", unit: "kg", digits: 1, group: "bia", bia: true, polarity: "lower-better", get: (c) => c.fat_mass_kg },
    { id: "ffm_kg", label: "FFM", unit: "kg", digits: 1, group: "bia", bia: true, polarity: "higher-better", get: (c) => c.ffm_kg },
    { id: "lean_mass_kg", label: "Magra ref.", unit: "kg", digits: 1, group: "bia", bia: true, polarity: "higher-better", get: (c) => c.lean_mass_kg },
    { id: "bmr_kcal", label: "BMR", unit: "kcal", digits: 0, group: "bia", bia: true, polarity: "higher-better", get: (c) => c.bmr_kcal },
    { id: "total_body_water_pct", label: "Acqua", unit: "%", digits: 1, group: "bia", bia: true, polarity: "neutral", get: (c) => c.total_body_water_pct },
    { id: "visceral_fat", label: "Visc.", digits: 1, group: "bia", bia: true, polarity: "lower-better", get: (c) => c.visceral_fat },
  ]

  // Circonferenze: siti principali + qualsiasi altro sito presente nei dati
  const labels = new Map(sites.map((s) => [s.code, s.label]))
  const order = new Map(sites.map((s) => [s.code, s.sort_order]))
  const keys = new Set<string>(CORE_SITES)
  for (const c of checkups) {
    const s = c.all_sites
    if (s && typeof s === "object" && !Array.isArray(s)) Object.keys(s).forEach((k) => keys.add(k))
  }
  const circ: CheckupColumn[] = [...keys]
    .sort((a, b) => (order.get(parseSiteKey(a).site) ?? 999) - (order.get(parseSiteKey(b).site) ?? 999) || a.localeCompare(b))
    .map((key) => {
      const { site, side } = parseSiteKey(key)
      const label = `${labels.get(site) ?? site}${side === "none" ? "" : side === "left" ? " sx" : " dx"}`
      return {
        id: `circ:${key}`,
        label,
        unit: "cm",
        digits: 1,
        group: "circ" as const,
        polarity: (key === "waist" || key === "abdomen" ? "lower-better" : "neutral") as Polarity,
        get: (c: Checkup) => siteValue(c, key),
      }
    })

  const index: CheckupColumn[] = [
    { id: "bmi", label: "BMI", digits: 1, group: "index", polarity: "neutral", get: (c) => c.bmi },
    { id: "ffmi", label: "FFMI", digits: 2, group: "index", bia: true, polarity: "higher-better", get: (c) => c.ffmi },
    { id: "waist_to_height", label: "Vita/H", digits: 3, group: "index", polarity: "lower-better", get: (c) => c.waist_to_height },
    { id: "waist_to_abdomen", label: "Vita/Add.", digits: 3, group: "index", polarity: "neutral", get: (c) => c.waist_to_abdomen },
  ]

  return [...base, ...bia, ...circ, ...index]
}

/** Esporta righe/colonne visibili in CSV compatibile con Excel italiano (; e virgola decimale). */
export function toCsv(rows: Checkup[], columns: CheckupColumn[]): string {
  const esc = (s: string) => (/[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s)
  const header = ["Data", "Strumento", ...columns.map((c) => (c.unit ? `${c.label} (${c.unit})` : c.label))]
  const lines = rows.map((r) => [
    r.checkup_date,
    r.protocol_name ?? "",
    ...columns.map((col) => {
      const v = col.get(r)
      return v === null ? "" : v.toFixed(col.digits).replace(".", ",")
    }),
  ])
  return [header, ...lines].map((l) => l.map(esc).join(";")).join("\r\n")
}
