import { z } from "zod"

import { Constants } from "@/types/database.types"
import { todayISO } from "@/lib/format"
import type { Profile } from "@/types/domain"

import { parseDecimal, toInputValue } from "@/features/checkups/schemas/checkup-form"

export const profileFormSchema = z.object({
  display_name: z.string().trim().max(60, "Massimo 60 caratteri"),
  sex: z.enum(["", ...Constants.public.Enums.sex_type]),
  birth_date: z
    .string()
    .refine((d) => d === "" || /^\d{4}-\d{2}-\d{2}$/.test(d), "Data non valida")
    .refine((d) => d === "" || (d >= "1900-01-01" && d <= todayISO()), "Data fuori intervallo"),
  height_cm: z.preprocess(
    parseDecimal,
    z
      .number({ error: "Altezza: inserisci un numero" })
      .min(100, "Altezza: minimo 100 cm")
      .max(250, "Altezza: massimo 250 cm")
      .nullable(),
  ),
  activity_level: z.enum(Constants.public.Enums.activity_level),
  goal: z.string().max(500, "Massimo 500 caratteri"),
})

export type ProfileFormInput = z.input<typeof profileFormSchema>
export type ProfileFormValues = z.output<typeof profileFormSchema>

export function profileToFormInput(p: Profile | null | undefined): ProfileFormInput {
  return {
    display_name: p?.display_name ?? "",
    sex: p?.sex ?? "",
    birth_date: p?.birth_date ?? "",
    height_cm: toInputValue(p?.height_cm),
    activity_level: p?.activity_level ?? "moderate",
    goal: p?.goal ?? "",
  }
}
