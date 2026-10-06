/**
 * Schema del form visita: unica fonte di verità per validazione,
 * messaggi d'errore e conversione verso il payload di save_checkup.
 * I limiti coincidono con i CHECK del database.
 */
import { z } from "zod"

import { formatNumber, isNum, todayISO } from "@/lib/format"
import type { BodySide, Checkup } from "@/types/domain"

/* ------------------------------------------------------------------ */
/* Numeri "all'italiana": accetta 75,2 e 75.2, stringa vuota = null    */
/* ------------------------------------------------------------------ */
export function parseDecimal(value: unknown): number | null {
  if (value === null || value === undefined) return null
  if (typeof value === "number") return value
  const s = String(value).trim().replace(/\s/g, "").replace(",", ".")
  if (s === "") return null
  const n = Number(s)
  return Number.isFinite(n) ? n : Number.NaN
}

export function toInputValue(value: number | null | undefined): string {
  return isNum(value) ? String(value).replace(".", ",") : ""
}

const decimal = (label: string, min: number, max: number, unit = "") => {
  const fmt = (v: number) => `${formatNumber(v, Number.isInteger(v) ? 0 : 1)}${unit}`
  return z.preprocess(
    parseDecimal,
    z
      .number({ error: `${label}: inserisci un numero valido` })
      .min(min, `${label}: minimo ${fmt(min)}`)
      .max(max, `${label}: massimo ${fmt(max)}`)
      .nullable(),
  )
}

function addDaysISO(iso: string, days: number) {
  const [y, m, d] = iso.split("-").map(Number)
  const date = new Date(y ?? 1970, (m ?? 1) - 1, (d ?? 1) + days)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/* ------------------------------------------------------------------ */
/* Metadati dei campi BIA (render del form + tabella)                  */
/* ------------------------------------------------------------------ */
export const BIA_PRIMARY_FIELDS = [
  { name: "fat_mass_pct", label: "Massa grassa", unit: "%", min: 2, max: 70 },
  { name: "lean_mass_kg", label: "Massa magra (referto)", unit: "kg", min: 10, max: 150 },
  { name: "bmr_kcal", label: "Metabolismo basale", unit: "kcal", min: 600, max: 5000 },
  { name: "total_body_water_pct", label: "Acqua corporea", unit: "%", min: 30, max: 80 },
  { name: "visceral_fat", label: "Grasso viscerale", unit: "", min: 0, max: 60 },
] as const

export const BIA_SECONDARY_FIELDS = [
  { name: "muscle_mass_kg", label: "Massa muscolare", unit: "kg", min: 5, max: 120 },
  { name: "bone_mass_kg", label: "Massa ossea", unit: "kg", min: 0.5, max: 10 },
  { name: "phase_angle_deg", label: "Angolo di fase", unit: "°", min: 1, max: 15 },
  { name: "metabolic_age", label: "Età metabolica", unit: "anni", min: 10, max: 120 },
] as const

export type BiaFieldName =
  | (typeof BIA_PRIMARY_FIELDS)[number]["name"]
  | (typeof BIA_SECONDARY_FIELDS)[number]["name"]

const BIA_NAMES: BiaFieldName[] = [...BIA_PRIMARY_FIELDS, ...BIA_SECONDARY_FIELDS].map((f) => f.name)

/* ------------------------------------------------------------------ */
/* Schema                                                              */
/* ------------------------------------------------------------------ */
const biaShape = Object.fromEntries(
  [...BIA_PRIMARY_FIELDS, ...BIA_SECONDARY_FIELDS].map((f) => [
    f.name,
    decimal(f.label, f.min, f.max, f.unit ? ` ${f.unit}` : ""),
  ]),
) as Record<BiaFieldName, ReturnType<typeof decimal>>

export const checkupFormSchema = z
  .object({
    checkup_date: z
      .string()
      .min(1, "La data è obbligatoria")
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Data non valida")
      .refine((d) => d <= addDaysISO(todayISO(), 1), "La data non può essere nel futuro")
      .refine((d) => d >= "2000-01-01", "Data troppo vecchia: controlla l'anno"),
    weight_kg: decimal("Peso", 20, 350, " kg"),
    protocol_id: z.string(),
    professional: z.string().max(120, "Massimo 120 caratteri"),
    notes: z.string().max(2000, "Massimo 2000 caratteri"),
    ...biaShape,
    circumferences: z.record(z.string(), decimal("Circonferenza", 5, 250, " cm")),
  })
  .superRefine((v, ctx) => {
    const hasBia = BIA_NAMES.some((n) => isNum(v[n]))
    const hasCirc = Object.values(v.circumferences).some(isNum)
    if (!isNum(v.weight_kg) && !hasBia && !hasCirc) {
      ctx.addIssue({ code: "custom", path: ["weight_kg"], message: "Inserisci almeno un valore (peso, BIA o una misura)" })
    }
    if (isNum(v.weight_kg) && isNum(v.lean_mass_kg) && v.lean_mass_kg >= v.weight_kg) {
      ctx.addIssue({ code: "custom", path: ["lean_mass_kg"], message: "La massa magra non può superare il peso" })
    }
    if (isNum(v.weight_kg) && isNum(v.muscle_mass_kg) && v.muscle_mass_kg >= v.weight_kg) {
      ctx.addIssue({ code: "custom", path: ["muscle_mass_kg"], message: "La massa muscolare non può superare il peso" })
    }
  })

export type CheckupFormInput = z.input<typeof checkupFormSchema>
export type CheckupFormValues = z.output<typeof checkupFormSchema>

/* ------------------------------------------------------------------ */
/* Chiavi circonferenze: "waist", "calf_right", "arm_left"             */
/* ------------------------------------------------------------------ */
export function parseSiteKey(key: string): { site: string; side: BodySide } {
  const m = key.match(/^(.*)_(left|right)$/)
  return m ? { site: m[1] ?? key, side: m[2] as BodySide } : { site: key, side: "none" }
}

export function siteKey(site: string, side: BodySide) {
  return side === "none" ? site : `${site}_${side}`
}

/* ------------------------------------------------------------------ */
/* Conversioni                                                         */
/* ------------------------------------------------------------------ */
export function checkupToFormInput(c: Checkup | undefined, defaults: { protocolId?: string | null } = {}): CheckupFormInput {
  const circumferences: Record<string, string> = {}
  const sites = c?.all_sites
  if (sites && typeof sites === "object" && !Array.isArray(sites)) {
    for (const [k, v] of Object.entries(sites)) {
      circumferences[k] = typeof v === "number" ? toInputValue(v) : ""
    }
  }

  return {
    checkup_date: c?.checkup_date ?? todayISO(),
    weight_kg: toInputValue(c?.weight_kg),
    protocol_id: (c ? c.protocol_id : defaults.protocolId) ?? "",
    professional: c?.professional ?? "",
    notes: c?.notes ?? "",
    fat_mass_pct: toInputValue(c?.fat_mass_pct),
    lean_mass_kg: toInputValue(c?.lean_mass_kg),
    bmr_kcal: toInputValue(c?.bmr_kcal),
    total_body_water_pct: toInputValue(c?.total_body_water_pct),
    visceral_fat: toInputValue(c?.visceral_fat),
    muscle_mass_kg: toInputValue(c?.muscle_mass_kg),
    bone_mass_kg: toInputValue(c?.bone_mass_kg),
    phase_angle_deg: toInputValue(c?.phase_angle_deg),
    metabolic_age: toInputValue(c?.metabolic_age),
    circumferences,
  }
}

export interface SaveCheckupPayload {
  id: string | null
  checkup_date: string
  weight_kg: number | null
  professional: string | null
  notes: string | null
  source?: string
  bia: ({ protocol_id: string | null } & Record<BiaFieldName, number | null>) | null
  circumferences: Array<{ site: string; side: BodySide; value_cm: number }>
}

export function formValuesToPayload(v: CheckupFormValues, id: string | null): SaveCheckupPayload {
  const biaValues = Object.fromEntries(BIA_NAMES.map((n) => [n, v[n] ?? null])) as Record<BiaFieldName, number | null>
  const hasBia = BIA_NAMES.some((n) => isNum(biaValues[n]))

  return {
    id,
    checkup_date: v.checkup_date,
    weight_kg: v.weight_kg ?? null,
    professional: v.professional.trim() || null,
    notes: v.notes.trim() || null,
    bia: hasBia ? { protocol_id: v.protocol_id || null, ...biaValues } : null,
    circumferences: Object.entries(v.circumferences)
      .filter((e): e is [string, number] => isNum(e[1]))
      .map(([key, value_cm]) => ({ ...parseSiteKey(key), value_cm })),
  }
}

/** Payload per ricreare una visita eliminata (funzione "Annulla"). */
export function checkupToPayload(c: Checkup): SaveCheckupPayload {
  const parsed = checkupFormSchema.safeParse(checkupToFormInput(c))
  if (!parsed.success) throw new Error("Impossibile ricostruire la visita")
  return { ...formValuesToPayload(parsed.data, null), source: c.source ?? "manual" }
}
