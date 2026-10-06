"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { LoaderCircle, UserRound } from "lucide-react"
import { useEffect } from "react"
import { useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"

import { FormField, NumberInput } from "@/components/shared/form-field"
import { GlassCard } from "@/components/shared/glass-card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { NativeSelect } from "@/components/ui/native-select"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { ACTIVITY_LEVELS, SEX_LABELS } from "@/config/constants"
import { ageAt } from "@/features/biometrics/engine/indices"
import { todayISO } from "@/lib/format"
import type { ActivityLevel, Sex } from "@/types/domain"

import { useProfile, useUpdateProfile } from "../api/profile"
import {
  profileFormSchema,
  profileToFormInput,
  type ProfileFormInput,
  type ProfileFormValues,
} from "../schemas/profile-form"

export function ProfileCard() {
  const profileQ = useProfile()
  const update = useUpdateProfile()

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<ProfileFormInput, unknown, ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: profileToFormInput(null),
    mode: "onTouched",
  })

  useEffect(() => {
    if (profileQ.data) reset(profileToFormInput(profileQ.data))
  }, [profileQ.data, reset])

  const birth = useWatch({ control, name: "birth_date" })
  const activity = useWatch({ control, name: "activity_level" })
  const age = ageAt(birth || null, todayISO())

  const onSubmit = handleSubmit(async (v) => {
    try {
      const saved = await update.mutateAsync({
        display_name: v.display_name || null,
        sex: v.sex === "" ? null : v.sex,
        birth_date: v.birth_date || null,
        height_cm: v.height_cm,
        activity_level: v.activity_level,
        goal: v.goal.trim() || null,
      })
      reset(profileToFormInput(saved))
      toast.success("Profilo aggiornato")
    } catch (e) {
      toast.error("Salvataggio non riuscito", { description: e instanceof Error ? e.message : undefined })
    }
  })

  return (
    <GlassCard className="p-5 sm:p-6">
      <div className="mb-5 flex items-center gap-3">
        <span className="grid size-9 place-items-center rounded-xl bg-neon/10 text-neon ring-1 ring-inset ring-neon/25">
          <UserRound className="size-4" />
        </span>
        <div>
          <h2 className="text-base font-semibold">Profilo biometrico</h2>
          <p className="text-xs text-muted-foreground">Usato per BMI, FFMI, rapporto vita/altezza e TDEE.</p>
        </div>
      </div>

      {profileQ.isPending ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : (
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="p-name" label="Nome visualizzato" error={errors.display_name?.message}>
              <Input id="p-name" className="h-10 rounded-lg" {...register("display_name")} />
            </FormField>
            <FormField id="p-sex" label="Sesso" error={errors.sex?.message}>
              <NativeSelect id="p-sex" className="h-10 rounded-lg" {...register("sex")}>
                <option value="">Non specificato</option>
                {(Object.keys(SEX_LABELS) as Sex[]).map((s) => (
                  <option key={s} value={s}>
                    {SEX_LABELS[s]}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField
              id="p-birth"
              label="Data di nascita"
              error={errors.birth_date?.message}
              hint={age !== null ? `${age} anni` : undefined}
            >
              <Input id="p-birth" type="date" className="h-10 rounded-lg" {...register("birth_date")} />
            </FormField>
            <FormField id="p-height" label="Altezza" error={errors.height_cm?.message}>
              <NumberInput id="p-height" unit="cm" invalid={Boolean(errors.height_cm)} {...register("height_cm")} />
            </FormField>
            <FormField
              id="p-activity"
              label="Livello di attività"
              error={errors.activity_level?.message}
              hint={`${ACTIVITY_LEVELS[activity as ActivityLevel]?.hint ?? ""} · TDEE = BMR × ${ACTIVITY_LEVELS[activity as ActivityLevel]?.factor ?? "—"}`}
              className="sm:col-span-2"
            >
              <NativeSelect id="p-activity" className="h-10 rounded-lg" {...register("activity_level")}>
                {(Object.keys(ACTIVITY_LEVELS) as ActivityLevel[]).map((a) => (
                  <option key={a} value={a}>
                    {ACTIVITY_LEVELS[a].label}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField id="p-goal" label="Obiettivo" error={errors.goal?.message} className="sm:col-span-2">
              <Textarea
                id="p-goal"
                rows={2}
                className="rounded-lg"
                placeholder="Es. ricomposizione: mantenere il peso aumentando la massa magra"
                {...register("goal")}
              />
            </FormField>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              className="rounded-xl"
              disabled={!isDirty}
              onClick={() => reset(profileToFormInput(profileQ.data))}
            >
              Ripristina
            </Button>
            <Button type="submit" className="rounded-xl" disabled={!isDirty || isSubmitting}>
              {isSubmitting && <LoaderCircle className="size-4 animate-spin" />}
              Salva profilo
            </Button>
          </div>
        </form>
      )}
    </GlassCard>
  )
}
