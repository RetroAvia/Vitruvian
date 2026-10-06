import { z } from "zod"

import { parseDecimal } from "@/features/checkups/schemas/checkup-form"
import { Constants } from "@/types/database.types"

const optNum = z
  .preprocess((v) => (v === "" || v === undefined ? null : parseDecimal(v)), z.number({ error: "deve essere un numero" }).nullable())
  .optional()

const text = z
  .string()
  .nullable()
  .optional()
  .transform((v) => (v && v.trim() ? v.trim() : null))

export const labResultImportSchema = z
  .object({
    code: z.string().min(1, "codice esame mancante"),
    name: text,
    category: z.enum(Constants.public.Enums.lab_category).optional().catch(undefined),
    value: optNum,
    value_text: z.preprocess((v) => (v === undefined || v === null ? null : String(v)), z.string().nullable()).optional(),
    unit: text,
    ref_low: optNum,
    ref_high: optNum,
    note: text,
  })
  .refine((r) => r.value != null || (r.value_text != null && r.value_text.trim() !== ""), {
    message: "manca sia value sia value_text",
  })

export const labReportImportSchema = z.object({
  report_date: z.string({ error: "data mancante" }).regex(/^\d{4}-\d{2}-\d{2}$/, "formato data atteso YYYY-MM-DD"),
  lab_name: text,
  fasting: z.boolean().nullable().optional(),
  notes: text,
  results: z.array(labResultImportSchema).min(1, "nessun esame nel referto"),
})

export const labImportSchema = z.object({
  schema: z.string().optional(),
  reports: z.array(labReportImportSchema).min(1, "nessun referto trovato"),
})

export type LabImport = z.output<typeof labImportSchema>

export function normalizeLabInput(data: unknown): unknown {
  if (Array.isArray(data)) return { reports: data }
  if (data && typeof data === "object" && !("reports" in data) && "results" in data) return { reports: [data] }
  return data
}

/** Codice normalizzato come fa il database (snake_case minuscolo). */
export function normalizeCode(code: string): string {
  let c = code.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "")
  if (c && !/^[a-z]/.test(c)) c = `x_${c}`
  return c
}

/** Confronto unità tollerante (µ/u, maiuscole, spazi). */
export function sameUnit(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return true
  const n = (s: string) => s.toLowerCase().replace(/\s/g, "").replace(/μ|µ/g, "u").replace(",", ".")
  return n(a) === n(b)
}
