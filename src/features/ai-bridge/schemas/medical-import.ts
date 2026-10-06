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

const textList = z
  .preprocess((v) => (typeof v === "string" ? [v] : v == null ? [] : v), z.array(z.string()))
  .transform((a) => a.map((s) => s.trim()).filter(Boolean))
  .optional()

const isoDate = z.string({ error: "data mancante" }).regex(/^\d{4}-\d{2}-\d{2}$/, "formato data atteso YYYY-MM-DD")

export const medicalMeasurementSchema = z
  .object({
    code: z.string().min(1, "codice misura mancante"),
    label: text,
    value: optNum,
    value_text: z.preprocess((v) => (v === undefined || v === null ? null : String(v)), z.string().nullable()).optional(),
    unit: text,
    ref_low: optNum,
    ref_high: optNum,
  })
  .refine((m) => m.value != null || (m.value_text != null && m.value_text.trim() !== ""), {
    message: "manca sia value sia value_text",
  })

export const medicalReportImportSchema = z.object({
  report_date: isoDate,
  kind: z.enum(Constants.public.Enums.medical_report_kind).catch("other"),
  title: z.string().trim().min(1, "titolo mancante").max(200),
  facility: text,
  physician: text,
  summary: text,
  conclusion: text,
  outcome: z.enum(Constants.public.Enums.medical_outcome).catch("unknown"),
  measurements: z.array(medicalMeasurementSchema).optional().default([]),
  findings: textList,
  recommendations: textList,
  next_check_date: isoDate.nullable().optional().catch(null),
  notes: text,
})

export const medicalImportSchema = z.object({
  schema: z.string().optional(),
  reports: z.array(medicalReportImportSchema).min(1, "nessun referto trovato"),
})

export type MedicalImport = z.output<typeof medicalImportSchema>

export function normalizeMedicalInput(data: unknown): unknown {
  if (Array.isArray(data)) return { reports: data }
  if (data && typeof data === "object" && !("reports" in data) && "report_date" in data) return { reports: [data] }
  return data
}
