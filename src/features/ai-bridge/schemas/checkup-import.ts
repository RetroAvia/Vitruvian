import { z } from "zod"

import { parseDecimal } from "@/features/checkups/schemas/checkup-form"

const num = (min: number, max: number) =>
  z.preprocess(
    (v) => (v === "" || v === undefined ? null : parseDecimal(v)),
    z.number({ error: "deve essere un numero" }).min(min, `minimo ${min}`).max(max, `massimo ${max}`).nullable(),
  ).optional()

const text = z
  .string()
  .nullable()
  .optional()
  .transform((v) => (v && v.trim() ? v.trim() : null))

const isoDate = z
  .string({ error: "data mancante" })
  .regex(/^\d{4}-\d{2}-\d{2}$/, "formato data atteso YYYY-MM-DD")

export const biaImportSchema = z
  .object({
    bmr_kcal: num(600, 5000),
    fat_mass_pct: num(2, 70),
    lean_mass_kg: num(10, 150),
    muscle_mass_kg: num(5, 120),
    bone_mass_kg: num(0.5, 10),
    total_body_water_pct: num(30, 80),
    visceral_fat: num(0, 60),
    phase_angle_deg: num(1, 15),
    metabolic_age: num(10, 120),
    extra: z.record(z.string(), z.unknown()).nullable().optional(),
  })
  .nullable()
  .optional()

export const checkupImportItemSchema = z.object({
  checkup_date: isoDate,
  weight_kg: num(20, 350),
  professional: text,
  notes: text,
  bia: biaImportSchema,
  circumferences: z
    .array(
      z.object({
        site: z.string().min(1, "codice sito mancante"),
        side: z.enum(["none", "left", "right"]).optional().default("none"),
        value_cm: z.preprocess(parseDecimal, z.number({ error: "deve essere un numero" }).min(5).max(250)),
      }),
    )
    .optional()
    .default([]),
})

export const checkupImportSchema = z.object({
  schema: z.string().optional(),
  checkups: z.array(checkupImportItemSchema).min(1, "nessuna visita trovata"),
})

export type CheckupImport = z.output<typeof checkupImportSchema>
export type CheckupImportItem = z.output<typeof checkupImportItemSchema>

/** Accetta anche un array nudo o una singola visita. */
export function normalizeCheckupInput(data: unknown): unknown {
  if (Array.isArray(data)) return { checkups: data }
  if (data && typeof data === "object" && !("checkups" in data) && "checkup_date" in data) return { checkups: [data] }
  return data
}
