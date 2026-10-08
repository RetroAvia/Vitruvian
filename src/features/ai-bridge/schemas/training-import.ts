import { z } from "zod"

import { parseDecimal } from "@/features/checkups/schemas/checkup-form"

const num = (min: number, max: number) =>
  z
    .preprocess((v) => (v === "" || v === undefined || v === null ? null : parseDecimal(v)), z.number({ error: "deve essere un numero" }).min(min).max(max).nullable())
    .optional()
    .catch(null)

const int = (min: number, max: number) =>
  z
    .preprocess((v) => (v === "" || v === undefined || v === null ? null : Math.round(Number(parseDecimal(v)))), z.number().int().min(min).max(max).nullable())
    .optional()
    .catch(null)

const text = z
  .string()
  .nullable()
  .optional()
  .transform((v) => (v && v.trim() ? v.trim() : null))

const isoDate = z.string({ error: "data mancante" }).regex(/^\d{4}-\d{2}-\d{2}$/, "formato data atteso YYYY-MM-DD")

export const TECHNIQUE_KEYS = ["straight", "pyramid", "reverse_pyramid", "drop_set", "rest_pause", "myo_reps", "cluster", "amrap", "emom", "tempo"] as const

export const GOALS = ["hypertrophy", "strength", "recomp", "fat_loss", "endurance", "general"] as const

export const planExerciseSchema = z
  .object({
    code: z.string().trim().optional(),
    name: z.string().trim().min(1, "nome esercizio mancante"),
    muscle_primary: text,
    muscles_secondary: z.preprocess((v) => (typeof v === "string" ? [v] : v == null ? [] : v), z.array(z.string())).optional().default([]),
    pattern: text,
    sets: int(1, 20),
    reps_min: int(1, 100),
    reps_max: int(1, 100),
    target_rir: num(0, 10),
    rest_seconds: int(0, 900),
    tempo: text,
    load_kg: num(0, 1000),
    duration_min: num(0.5, 600),
    superset_group: int(1, 50),
    notes: text,
    technique: z.enum(TECHNIQUE_KEYS).optional().catch("straight").default("straight"),
    set_scheme: z
      .array(z.object({ reps: z.coerce.number().int().min(1).max(100), load_pct: z.coerce.number().min(10).max(150).nullable().optional() }))
      .nullable()
      .optional()
      .catch(null),
  })
  .transform((e) => ({ ...e, code: e.code || e.name, reps_max: e.reps_max != null && e.reps_min != null && e.reps_max < e.reps_min ? e.reps_min : e.reps_max }))

export const planDaySchema = z.object({
  label: z.string().trim().min(1, "nome del giorno mancante"),
  day_of_week: int(1, 7),
  focus: text,
  exercises: z.array(planExerciseSchema).min(1, "giorno senza esercizi"),
})

export const historySetSchema = z.object({
  reps: int(0, 200),
  weight_kg: num(0, 1000),
  rpe: num(1, 10),
  duration_min: num(0.5, 600),
  warmup: z.boolean().optional().catch(false),
})

export const historyWorkoutSchema = z.object({
  date: isoDate,
  title: text,
  day_label: text,
  duration_min: int(1, 600),
  session_rpe: num(1, 10),
  notes: text,
  exercises: z
    .array(
      z
        .object({ code: z.string().trim().optional(), name: z.string().trim().min(1), sets: z.array(historySetSchema).min(1, "nessuna serie") })
        .transform((e) => ({ ...e, code: e.code || e.name })),
    )
    .min(1, "sessione senza esercizi"),
})

export const trainingImportSchema = z
  .object({
    schema: z.string().optional(),
    activate: z.boolean().optional().default(true),
    plan: z
      .object({
        name: z.string().trim().min(1, "nome della scheda mancante").max(120),
        coach: text,
        goal: z.enum(GOALS).catch("hypertrophy"),
        split: text,
        days_per_week: int(1, 7),
        valid_from: isoDate.nullable().optional().catch(null),
        valid_to: isoDate.nullable().optional().catch(null),
        notes: text,
        days: z.array(planDaySchema).min(1, "la scheda non ha giorni"),
      })
      .nullable()
      .optional(),
    history: z.array(historyWorkoutSchema).optional().default([]),
  })
  .refine((d) => Boolean(d.plan) || d.history.length > 0, { message: "serve almeno la scheda (plan) o lo storico (history)" })

export type TrainingImport = z.output<typeof trainingImportSchema>

export function normalizeTrainingInput(data: unknown): unknown {
  if (data && typeof data === "object" && !Array.isArray(data) && !("plan" in data) && "days" in data) return { plan: data }
  if (Array.isArray(data)) return { history: data }
  return data
}
