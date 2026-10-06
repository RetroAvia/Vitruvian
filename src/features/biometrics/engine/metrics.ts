/**
 * Catalogo delle metriche: una sola definizione per KPI, delta, grafici e insight.
 */
import type { Polarity } from "@/components/shared/delta-pill"
import type { Checkup } from "@/types/domain"

export type MetricKey =
  | "weight"
  | "fat_pct"
  | "fat_kg"
  | "ffm"
  | "lean_ref"
  | "bmr"
  | "tbw_pct"
  | "visceral"
  | "waist"
  | "abdomen"
  | "chest"
  | "arm"
  | "thigh"
  | "bmi"
  | "ffmi"
  | "whtr"

export interface MetricDef {
  key: MetricKey
  label: string
  unit: string
  digits: number
  /** Misurata dalla bioimpedenza → confrontabile solo a parità di strumento */
  bia: boolean
  polarity: Polarity
  get: (c: Checkup) => number | null
}

export const METRICS: Record<MetricKey, MetricDef> = {
  weight: { key: "weight", label: "Peso", unit: "kg", digits: 1, bia: false, polarity: "neutral", get: (c) => c.weight_kg },
  fat_pct: { key: "fat_pct", label: "Massa grassa", unit: "%", digits: 1, bia: true, polarity: "lower-better", get: (c) => c.fat_mass_pct },
  fat_kg: { key: "fat_kg", label: "Massa grassa", unit: "kg", digits: 1, bia: true, polarity: "lower-better", get: (c) => c.fat_mass_kg },
  ffm: { key: "ffm", label: "Massa magra (FFM)", unit: "kg", digits: 1, bia: true, polarity: "higher-better", get: (c) => c.ffm_kg },
  lean_ref: { key: "lean_ref", label: "Massa magra (referto)", unit: "kg", digits: 1, bia: true, polarity: "higher-better", get: (c) => c.lean_mass_kg },
  bmr: { key: "bmr", label: "Metabolismo basale", unit: "kcal", digits: 0, bia: true, polarity: "higher-better", get: (c) => c.bmr_kcal },
  tbw_pct: { key: "tbw_pct", label: "Acqua corporea", unit: "%", digits: 1, bia: true, polarity: "neutral", get: (c) => c.total_body_water_pct },
  visceral: { key: "visceral", label: "Grasso viscerale", unit: "", digits: 1, bia: true, polarity: "lower-better", get: (c) => c.visceral_fat },
  waist: { key: "waist", label: "Vita", unit: "cm", digits: 1, bia: false, polarity: "lower-better", get: (c) => c.waist_cm },
  abdomen: { key: "abdomen", label: "Addome", unit: "cm", digits: 1, bia: false, polarity: "lower-better", get: (c) => c.abdomen_cm },
  chest: { key: "chest", label: "Torace", unit: "cm", digits: 1, bia: false, polarity: "neutral", get: (c) => c.chest_cm },
  arm: { key: "arm", label: "Braccio", unit: "cm", digits: 1, bia: false, polarity: "neutral", get: (c) => c.arm_cm },
  thigh: { key: "thigh", label: "Coscia", unit: "cm", digits: 1, bia: false, polarity: "neutral", get: (c) => c.thigh_cm },
  bmi: { key: "bmi", label: "BMI", unit: "", digits: 1, bia: false, polarity: "neutral", get: (c) => c.bmi },
  ffmi: { key: "ffmi", label: "FFMI", unit: "", digits: 2, bia: true, polarity: "higher-better", get: (c) => c.ffmi },
  whtr: { key: "whtr", label: "Vita / Altezza", unit: "", digits: 3, bia: false, polarity: "lower-better", get: (c) => c.waist_to_height },
}
