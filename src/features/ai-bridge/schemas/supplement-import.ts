import { z } from "zod"

import { parseDecimal } from "@/features/checkups/schemas/checkup-form"

const optNum = z
  .preprocess((v) => (v === "" || v === undefined ? null : parseDecimal(v)), z.number({ error: "deve essere un numero" }).nullable())
  .optional()

const text = z
  .string()
  .nullable()
  .optional()
  .transform((v) => (v && v.trim() ? v.trim() : null))

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "formato data atteso YYYY-MM-DD")

export const FORMS = ["capsule", "tablet", "softgel", "powder", "liquid", "drops", "gummy", "sachet", "other"] as const
export const FREQUENCIES = ["daily", "training_days", "weekly", "as_needed", "cycle"] as const
export const TIMINGS = ["morning", "empty_stomach", "breakfast", "lunch", "pre_workout", "post_workout", "with_meal", "dinner", "bedtime"] as const

export const ingredientImportSchema = z.object({
  code: z.string().trim().min(1, "codice ingrediente mancante"),
  name: z.string().trim().min(1, "nome ingrediente mancante"),
  amount: optNum,
  unit: text,
})

export const supplementImportSchema = z.object({
  name: z.string().trim().min(1, "nome mancante").max(120),
  brand: text,
  form: z.enum(FORMS).catch("other"),
  dose_label: text,
  servings_per_day: z.preprocess((v) => (v == null || v === "" ? 1 : parseDecimal(v)), z.number().positive().max(20)).catch(1),
  timing: z
    .preprocess((v) => (typeof v === "string" ? [v] : v == null ? [] : v), z.array(z.string()))
    .transform((a) => a.filter((t): t is (typeof TIMINGS)[number] => (TIMINGS as readonly string[]).includes(t)))
    .optional()
    .default([]),
  frequency: z.enum(FREQUENCIES).catch("daily"),
  days_per_week: z.preprocess((v) => (v == null || v === "" ? null : Number(v)), z.number().int().min(1).max(7).nullable()).catch(null).optional(),
  ingredients: z.array(ingredientImportSchema).optional().default([]),
  purpose: text,
  notes: text,
  start_date: isoDate.nullable().optional().catch(null),
  end_date: isoDate.nullable().optional().catch(null),
  is_active: z.boolean().optional().default(true),
})

export const supplementsImportSchema = z.object({
  schema: z.string().optional(),
  deactivate_missing: z.boolean().optional().default(false),
  supplements: z.array(supplementImportSchema).min(1, "nessun integratore trovato"),
})

export type SupplementsImport = z.output<typeof supplementsImportSchema>

export function normalizeSupplementInput(data: unknown): unknown {
  if (Array.isArray(data)) return { supplements: data }
  if (data && typeof data === "object" && !("supplements" in data) && "name" in data) return { supplements: [data] }
  return data
}
