"use client"

import { LoaderCircle, Plus, Trash2 } from "lucide-react"
import { useEffect } from "react"
import { useFieldArray, useForm } from "react-hook-form"
import { toast } from "sonner"

import { FormField, NumberInput } from "@/components/shared/form-field"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { NativeSelect } from "@/components/ui/native-select"
import { Textarea } from "@/components/ui/textarea"
import {
  SUPPLEMENT_FORM_LABELS,
  SUPPLEMENT_FREQUENCY_LABELS,
  SUPPLEMENT_TIMINGS,
  type SupplementTiming,
} from "@/config/constants"
import { parseDecimal, toInputValue } from "@/features/checkups/schemas/checkup-form"
import { isNum } from "@/lib/format"
import { useSound } from "@/lib/sound"
import { cn } from "@/lib/utils"
import type { Supplement, SupplementForm, SupplementFrequency } from "@/types/domain"

import { useSaveSupplement } from "../api/supplements"
import { NUTRIENTS, resolveNutrient } from "../engine/nutrients"

interface FormValues {
  name: string
  brand: string
  form: SupplementForm
  dose_label: string
  servings_per_day: string
  frequency: SupplementFrequency
  days_per_week: string
  timing: string[]
  purpose: string
  start_date: string
  notes: string
  ingredients: Array<{ name: string; amount: string; unit: string }>
}

const UNITS = ["mg", "µg", "g", "UI", "mL"]

function toValues(s: Supplement | null): FormValues {
  return {
    name: s?.name ?? "",
    brand: s?.brand ?? "",
    form: s?.form ?? "capsule",
    dose_label: s?.dose_label ?? "",
    servings_per_day: toInputValue(s?.servings_per_day ?? 1),
    frequency: s?.frequency ?? "daily",
    days_per_week: s?.days_per_week ? String(s.days_per_week) : "",
    timing: s?.timing ?? [],
    purpose: s?.purpose ?? "",
    start_date: s?.start_date ?? "",
    notes: s?.notes ?? "",
    ingredients: (s?.ingredients ?? []).map((i) => ({
      name: resolveNutrient(i.code)?.name ?? i.name,
      amount: toInputValue(i.amount),
      unit: i.unit ?? resolveNutrient(i.code)?.unit ?? "mg",
    })),
  }
}

function slug(s: string) {
  return (
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "ingrediente"
  )
}

export function SupplementFormDialog({
  open,
  onOpenChange,
  supplement,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  supplement: Supplement | null
}) {
  const save = useSaveSupplement()
  const play = useSound()
  const form = useForm<FormValues>({ defaultValues: toValues(supplement) })
  const { register, handleSubmit, reset, watch, setValue, formState } = form
  const ingredients = useFieldArray({ control: form.control, name: "ingredients" })

  useEffect(() => {
    if (open) reset(toValues(supplement))
  }, [open, supplement, reset])

  const timing = watch("timing")
  const frequency = watch("frequency")

  async function onSubmit(v: FormValues) {
    const servings = parseDecimal(v.servings_per_day)
    if (!isNum(servings) || servings <= 0 || servings > 20) {
      form.setError("servings_per_day", { message: "Inserisci un numero tra 0,25 e 20" })
      return
    }
    const ings = v.ingredients
      .filter((i) => i.name.trim())
      .map((i) => {
        const def = resolveNutrient(i.name)
        const amount = parseDecimal(i.amount)
        return { code: def?.code ?? slug(i.name), name: i.name.trim(), amount: isNum(amount) ? amount : null, unit: i.unit || null }
      })
    try {
      await save.mutateAsync({
        id: supplement?.id,
        name: v.name.trim(),
        brand: v.brand.trim() || null,
        form: v.form,
        dose_label: v.dose_label.trim() || null,
        servings_per_day: servings,
        frequency: v.frequency,
        days_per_week: v.days_per_week ? Number(v.days_per_week) : null,
        timing: v.timing,
        purpose: v.purpose.trim() || null,
        start_date: v.start_date || null,
        notes: v.notes.trim() || null,
        ingredients: ings,
      })
      play("success")
      toast.success(supplement ? "Integratore aggiornato" : "Integratore aggiunto")
      onOpenChange(false)
    } catch (e) {
      play("error")
      toast.error("Salvataggio non riuscito", { description: e instanceof Error ? e.message : undefined })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{supplement ? "Modifica integratore" : "Nuovo integratore"}</DialogTitle>
          <DialogDescription>Quantità degli ingredienti riferite a UNA dose, come in etichetta.</DialogDescription>
        </DialogHeader>

        <form id="supplement-form" onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="s-name" label="Nome" error={formState.errors.name?.message}>
              <Input id="s-name" className="h-10 rounded-lg" {...register("name", { required: "Il nome è obbligatorio" })} />
            </FormField>
            <FormField id="s-brand" label="Marca">
              <Input id="s-brand" className="h-10 rounded-lg" {...register("brand")} />
            </FormField>
            <FormField id="s-form" label="Formato">
              <NativeSelect id="s-form" {...register("form")}>
                {Object.entries(SUPPLEMENT_FORM_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField id="s-dose" label="Una dose" hint="Es. 1 capsula, 5 g, 20 gocce">
              <Input id="s-dose" className="h-10 rounded-lg" {...register("dose_label")} />
            </FormField>
            <FormField id="s-servings" label="Dosi al giorno" error={formState.errors.servings_per_day?.message}>
              <NumberInput id="s-servings" unit="×" {...register("servings_per_day")} />
            </FormField>
            <FormField id="s-freq" label="Frequenza">
              <NativeSelect id="s-freq" {...register("frequency")}>
                {Object.entries(SUPPLEMENT_FREQUENCY_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            {(frequency === "training_days" || frequency === "weekly") && (
              <FormField id="s-dpw" label="Giorni a settimana">
                <NativeSelect id="s-dpw" {...register("days_per_week")}>
                  <option value="">—</option>
                  {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </NativeSelect>
              </FormField>
            )}
            <FormField id="s-start" label="In uso dal">
              <Input id="s-start" type="date" className="h-10 rounded-lg" {...register("start_date")} />
            </FormField>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Quando lo prendi</p>
            <div className="flex flex-wrap gap-1.5">
              {(Object.entries(SUPPLEMENT_TIMINGS) as Array<[SupplementTiming, string]>).map(([k, label]) => {
                const on = timing.includes(k)
                return (
                  <button
                    key={k}
                    type="button"
                    aria-pressed={on}
                    onClick={() => {
                      setValue("timing", on ? timing.filter((t) => t !== k) : [...timing, k], { shouldDirty: true })
                      play("tap")
                    }}
                    className={cn(
                      "h-8 rounded-full border px-3 text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      on ? "border-neon/40 bg-neon/10 text-neon" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">Composizione per dose</p>
              <Button type="button" variant="ghost" size="sm" className="rounded-lg" onClick={() => ingredients.append({ name: "", amount: "", unit: "mg" })}>
                <Plus className="size-4" />
                Ingrediente
              </Button>
            </div>
            <datalist id="nutrient-names">
              {NUTRIENTS.map((n) => (
                <option key={n.code} value={n.name} />
              ))}
            </datalist>
            {ingredients.fields.length === 0 && (
              <p className="surface-inset rounded-xl p-3 text-xs text-muted-foreground">
                Aggiungi gli ingredienti dall&apos;etichetta per calcolare le dosi totali e controllare i limiti di sicurezza.
              </p>
            )}
            {ingredients.fields.map((f, i) => (
              <div key={f.id} className="grid grid-cols-[1fr_90px_80px_auto] gap-2">
                <Input aria-label="Ingrediente" list="nutrient-names" placeholder="Es. Vitamina D" className="h-10 rounded-lg" {...register(`ingredients.${i}.name`)} />
                <NumberInput aria-label="Quantità" placeholder="0" {...register(`ingredients.${i}.amount`)} />
                <NativeSelect aria-label="Unità" {...register(`ingredients.${i}.unit`)}>
                  {UNITS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </NativeSelect>
                <Button type="button" variant="ghost" size="icon" className="size-10 rounded-lg" aria-label="Rimuovi ingrediente" onClick={() => ingredients.remove(i)}>
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="s-purpose" label="Scopo">
              <Input id="s-purpose" className="h-10 rounded-lg" {...register("purpose")} />
            </FormField>
            <FormField id="s-notes" label="Note">
              <Textarea id="s-notes" rows={1} className="min-h-10 rounded-lg" {...register("notes")} />
            </FormField>
          </div>
        </form>

        <DialogFooter>
          <Button variant="ghost" className="rounded-xl" onClick={() => onOpenChange(false)}>
            Annulla
          </Button>
          <Button type="submit" form="supplement-form" className="rounded-xl" disabled={save.isPending}>
            {save.isPending && <LoaderCircle className="size-4 animate-spin" />}
            Salva
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
