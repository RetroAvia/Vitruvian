import type {
  ActivityLevel,
  DataSource,
  LabCategory,
  MealSlot,
  MedicalOutcome,
  MedicalReportKind,
  Sex,
  SupplementForm,
  SupplementFrequency,
} from "@/types/domain"

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

export const MEDICAL_KIND_LABELS: Record<MedicalReportKind, string> = {
  ecg: "Elettrocardiogramma",
  echo: "Ecocardiogramma",
  stress_test: "Test da sforzo",
  holter: "Holter",
  blood_pressure: "Pressione arteriosa",
  spirometry: "Spirometria",
  sports_medical: "Visita medico-sportiva",
  dexa: "DEXA / MOC",
  imaging: "Imaging (eco, RX, RM)",
  specialist: "Visita specialistica",
  other: "Altro referto",
}

export const MEDICAL_OUTCOME_LABELS: Record<MedicalOutcome, string> = {
  normal: "Nella norma",
  borderline: "Da monitorare",
  abnormal: "Alterato",
  unknown: "Non indicato",
}

export const SUPPLEMENT_FORM_LABELS: Record<SupplementForm, string> = {
  capsule: "Capsula",
  tablet: "Compressa",
  softgel: "Perla",
  powder: "Polvere",
  liquid: "Liquido",
  drops: "Gocce",
  gummy: "Caramella gommosa",
  sachet: "Bustina",
  other: "Altro",
}

export const SUPPLEMENT_FREQUENCY_LABELS: Record<SupplementFrequency, string> = {
  daily: "Tutti i giorni",
  training_days: "Giorni di allenamento",
  weekly: "Settimanale",
  as_needed: "Al bisogno",
  cycle: "A cicli",
}

/** Momenti di assunzione, nell'ordine della giornata. */
export const SUPPLEMENT_TIMINGS = {
  morning: "Al risveglio",
  empty_stomach: "A digiuno",
  breakfast: "Colazione",
  lunch: "Pranzo",
  pre_workout: "Pre-allenamento",
  post_workout: "Post-allenamento",
  with_meal: "Con un pasto",
  dinner: "Cena",
  bedtime: "Prima di dormire",
} as const
export type SupplementTiming = keyof typeof SUPPLEMENT_TIMINGS
