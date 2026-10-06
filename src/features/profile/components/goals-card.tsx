"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { LoaderCircle, Target } from "lucide-react"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { FormField, NumberInput } from "@/components/shared/form-field"
import { GlassCard } from "@/components/shared/glass-card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { useCheckups } from "@/features/checkups/api/queries"
import { goalsUnavailable } from "@/features/biometrics/engine/goals"
import { parseDecimal, toInputValue } from "@/features/checkups/schemas/checkup-form"
import { formatDate, formatNumber, todayISO } from "@/lib/format"
import { playSound } from "@/lib/sound"
import type { Profile } from "@/types/domain"

import { useProfile, useUpdateProfile } from "../api/profile"

const dec = (label: string, min: number, max: number) =>
  z.preprocess(parseDecimal, z.number({ error: `${label}: numero non valido` }).min(min, `${label}: minimo ${min}`).max(max, `${label}: massimo ${max}`).nullable())

const schema = z.object({
  target_weight_kg: dec("Peso", 30, 300),
  target_fat_pct: dec("Massa grassa", 3, 60),
  target_waist_cm: dec("Vita", 40, 200),
  target_ffm_kg: dec("Massa magra", 20, 150),
  target_date: z.string().refine((d) => d === "" || d >= todayISO(), "La data deve essere futura"),
  restart: z.boolean(),
})
type In = z.input<typeof schema>
type Out = z.output<typeof schema>

function toForm(p: Profile | null | undefined): In {
  return {
    target_weight_kg: toInputValue(p?.target_weight_kg),
    target_fat_pct: toInputValue(p?.target_fat_pct),
    target_waist_cm: toInputValue(p?.target_waist_cm),
    target_ffm_kg: toInputValue(p?.target_ffm_kg),
    target_date: p?.target_date ?? "",
    restart: false,
  }
}

export function GoalsCard() {
  const profileQ = useProfile()
  const checkupsQ = useCheckups()
  const update = useUpdateProfile()
  const profile = profileQ.data
  const latest = checkupsQ.data?.[checkupsQ.data.length - 1]

  const { register, handleSubmit, reset, formState: { errors, isDirty, isSubmitting } } = useForm<In, unknown, Out>({
    resolver: zodResolver(schema),
    defaultValues: toForm(null),
    mode: "onTouched",
  })
  useEffect(() => {
    if (profile) reset(toForm(profile))
  }, [profile, reset])

  const onSubmit = handleSubmit(async (v) => {
    try {
      const saved = await update.mutateAsync({
        target_weight_kg: v.target_weight_kg,
        target_fat_pct: v.target_fat_pct,
        target_waist_cm: v.target_waist_cm,
        target_ffm_kg: v.target_ffm_kg,
        target_date: v.target_date || null,
        goals_start_date: v.restart || !profile?.goals_start_date ? todayISO() : profile.goals_start_date,
      })
      reset(toForm(saved))
      playSound("success")
      toast.success("Obiettivi salvati", { description: "L'avanzamento è visibile in dashboard." })
    } catch (e) {
      playSound("error")
      toast.error("Salvataggio non riuscito", { description: e instanceof Error ? e.message : undefined })
    }
  })

  const field = (name: "target_weight_kg" | "target_fat_pct" | "target_waist_cm" | "target_ffm_kg", label: string, unit: string, current: number | null | undefined) => (
    <FormField id={`g-${name}`} label={label} error={errors[name]?.message} hint={current != null ? `Attuale: ${formatNumber(current, 1)} ${unit}` : undefined}>
      <NumberInput id={`g-${name}`} unit={unit} placeholder="—" invalid={Boolean(errors[name])} {...register(name)} />
    </FormField>
  )

  return (
    <GlassCard id="obiettivi" className="scroll-mt-24 p-5 sm:p-6">
      <div className="mb-5 flex items-center gap-3">
        <span className="grid size-9 place-items-center rounded-xl bg-gain/10 text-gain ring-1 ring-inset ring-gain/25">
          <Target className="size-4" />
        </span>
        <div>
          <h2 className="text-base font-semibold">Obiettivi</h2>
          <p className="text-xs text-muted-foreground">Compila solo quelli che ti interessano: la dashboard mostra l&apos;avanzamento.</p>
        </div>
      </div>

      {profileQ.isPending ? (
        <Skeleton className="h-48 rounded-xl" />
      ) : goalsUnavailable(profile) ? (
        <p className="surface-inset rounded-xl p-4 text-sm text-muted-foreground">
          Per attivare gli obiettivi esegui nello SQL Editor di Supabase la migrazione{" "}
          <code className="text-foreground">20261009000001_goals.sql</code>.
        </p>
      ) : (
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {field("target_weight_kg", "Peso obiettivo", "kg", latest?.weight_kg)}
            {field("target_fat_pct", "Massa grassa obiettivo", "%", latest?.fat_mass_pct)}
            {field("target_waist_cm", "Vita obiettivo", "cm", latest?.waist_cm)}
            {field("target_ffm_kg", "Massa magra obiettivo", "kg", latest?.ffm_kg)}
            <FormField id="g-date" label="Entro il (facoltativo)" error={errors.target_date?.message}>
              <Input id="g-date" type="date" className="h-10 rounded-lg" {...register("target_date")} />
            </FormField>
            <label className="flex items-end gap-2 pb-2 text-sm">
              <input type="checkbox" className="size-4 accent-[var(--neon)]" {...register("restart")} />
              <span>
                Misura i progressi da oggi
                {profile?.goals_start_date && (
                  <span className="block text-xs text-muted-foreground">ora dal {formatDate(profile.goals_start_date, "medium")}</span>
                )}
              </span>
            </label>
          </div>
          <div className="flex justify-end">
            <Button type="submit" className="rounded-xl" disabled={!isDirty || isSubmitting}>
              {isSubmitting && <LoaderCircle className="size-4 animate-spin" />}
              Salva obiettivi
            </Button>
          </div>
        </form>
      )}
    </GlassCard>
  )
}
