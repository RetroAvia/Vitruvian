import { z } from "zod"

import { parseDecimal } from "@/features/checkups/schemas/checkup-form"
import { Constants } from "@/types/database.types"

const optNum = (min = 0, max = 100000) =>
  z
    .preprocess(
      (v) => (v === "" || v === undefined ? null : parseDecimal(v)),
      z.number({ error: "deve essere un numero" }).min(min).max(max).nullable(),
    )
    .optional()

const text = z
  .string()
  .nullable()
  .optional()
  .transform((v) => (v && v.trim() ? v.trim() : null))

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "formato data atteso YYYY-MM-DD")
  .nullable()
  .optional()
  .catch(null)

export const dietItemSchema = z.object({
  food: z.string().min(1, "nome alimento mancante"),
  quantity: optNum(0, 5000),
  unit: z.string().nullable().optional().transform((v) => v?.trim() || "g"),
  kcal: optNum(0, 5000),
  protein_g: optNum(0, 500),
  carbs_g: optNum(0, 1000),
  fat_g: optNum(0, 500),
  fiber_g: optNum(0, 200),
  alternative_group: z.preprocess((v) => (v === "" || v === undefined ? null : v), z.number().int().min(1).max(50).nullable()).optional().catch(null),
  notes: text,
})

export const dietMealSchema = z.object({
  slot: z.enum(Constants.public.Enums.meal_slot).catch("other"),
  label: text,
  time: z
    .string()
    .regex(/^\d{1,2}:\d{2}$/)
    .nullable()
    .optional()
    .catch(null),
  notes: text,
  items: z.array(dietItemSchema).min(1, "pasto senza alimenti"),
})

export const dietDaySchema = z.object({
  day_of_week: z.preprocess((v) => (v === "" || v === undefined ? null : v), z.number().int().min(1).max(7).nullable()).optional().catch(null),
  label: z.string().min(1, "etichetta del giorno mancante"),
  meals: z.array(dietMealSchema).min(1, "giorno senza pasti"),
})

export const dietImportSchema = z.object({
  schema: z.string().optional(),
  name: z.string().min(1, "nome del piano mancante"),
  professional: text,
  valid_from: isoDate,
  valid_to: isoDate,
  notes: text,
  targets: z
    .object({
      kcal: optNum(500, 10000),
      protein_g: optNum(0, 600),
      carbs_g: optNum(0, 1500),
      fat_g: optNum(0, 600),
      fiber_g: optNum(0, 200),
    })
    .nullable()
    .optional()
    .transform((t) => t ?? {}),
  days: z.array(dietDaySchema).min(1, "nessun giorno nel piano"),
})

export type DietImport = z.output<typeof dietImportSchema>

export function normalizeDietInput(data: unknown): unknown {
  if (data && typeof data === "object" && "plan" in data && !("days" in data)) return (data as { plan: unknown }).plan
  return data
}
