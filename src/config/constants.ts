import type { ActivityLevel, DataSource, LabCategory, MealSlot, Sex } from "@/types/domain"

export const APP_NAME = "Vitruvian"
export const APP_TAGLINE = "Body Composition Intelligence"

export const SEX_LABELS: Record<Sex, string> = {
  male: "Maschio",
  female: "Femmina",
}

/** Fattori PAL (Physical Activity Level) per stimare il TDEE = BMR × fattore. */
export const ACTIVITY_LEVELS: Record<ActivityLevel, { label: string; factor: number; hint: string }> = {
  sedentary: { label: "Sedentario", factor: 1.2, hint: "Lavoro/studio seduto, nessun allenamento" },
  light: { label: "Leggero", factor: 1.375, hint: "1–3 allenamenti a settimana" },
  moderate: { label: "Moderato", factor: 1.55, hint: "3–5 allenamenti a settimana" },
  active: { label: "Attivo", factor: 1.725, hint: "6–7 allenamenti a settimana" },
  very_active: { label: "Molto attivo", factor: 1.9, hint: "Doppi allenamenti o lavoro fisico" },
}

export const DATA_SOURCE_LABELS: Record<DataSource, string> = {
  manual: "Manuale",
  ai_import: "AI Bridge",
  sheet_import: "Google Foglio",
}

export const MEAL_SLOT_LABELS: Record<MealSlot, string> = {
  breakfast: "Colazione",
  morning_snack: "Spuntino mattina",
  lunch: "Pranzo",
  afternoon_snack: "Merenda",
  dinner: "Cena",
  evening_snack: "Spuntino serale",
  pre_workout: "Pre-allenamento",
  post_workout: "Post-allenamento",
  other: "Altro",
}

/** Codici dei siti di misura principali (measurement_sites.code). */
export const CORE_SITES = ["waist", "abdomen", "chest", "arm", "thigh"] as const
export type CoreSite = (typeof CORE_SITES)[number]

export const LAB_CATEGORY_LABELS: Record<LabCategory, string> = {
  metabolic: "Metabolismo",
  lipids: "Lipidi",
  liver: "Fegato",
  kidney: "Reni",
  blood_count: "Emocromo",
  iron: "Ferro",
  vitamins: "Vitamine",
  thyroid: "Tiroide",
  hormones: "Ormoni",
  inflammation: "Infiammazione",
  electrolytes: "Elettroliti",
  muscle: "Muscolo",
  other: "Altri esami",
}
