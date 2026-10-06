"use client"

import { CheckCircle2, LoaderCircle, Upload } from "lucide-react"
import Link from "next/link"
import { useMemo, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { MEAL_SLOT_LABELS } from "@/config/constants"
import { useImportDietPlan } from "@/features/nutrition/api/nutrition"
import { dayTotals, macroKcal, mealTotals } from "@/features/nutrition/engine/totals"
import type { DayWithMeals, MealWithItems } from "@/features/nutrition/types"
import { formatNumber, isNum } from "@/lib/format"
import { playSound } from "@/lib/sound"

import { useParsedImport } from "../lib/use-parsed-import"
import { buildDietPrompt } from "../prompts/diet-prompt"
import { dietImportSchema, normalizeDietInput, type DietImport } from "../schemas/diet-import"
import { PasteStep, PromptStep, StepCard } from "./bridge-steps"

const LABELS = { days: "Giorno", meals: "Pasto", items: "Alimento" }

/** Converte il JSON importato nella stessa forma del piano salvato, per riusare il motore dei totali. */
function toTree(d: DietImport): DayWithMeals[] {
  return d.days.map((day, di) => ({
    id: `d${di}`,
    plan_id: "preview",
    user_id: "",
    day_of_week: day.day_of_week ?? null,
    label: day.label,
    sort_order: di,
    created_at: "",
    updated_at: "",
    meals: day.meals.map(
      (m, mi): MealWithItems => ({
        id: `d${di}m${mi}`,
        day_id: `d${di}`,
        user_id: "",
        slot: m.slot,
        label: m.label,
        time_hint: m.time ?? null,
        notes: m.notes,
        sort_order: mi,
        created_at: "",
        updated_at: "",
        items: m.items.map((it, ii) => ({
          id: `d${di}m${mi}i${ii}`,
          meal_id: `d${di}m${mi}`,
          user_id: "",
          food_name: it.food,
          quantity: it.quantity ?? null,
          unit: it.unit,
          kcal: it.kcal ?? null,
          protein_g: it.protein_g ?? null,
          carbs_g: it.carbs_g ?? null,
          fat_g: it.fat_g ?? null,
          fiber_g: it.fiber_g ?? null,
          alternative_group: it.alternative_group ?? null,
          notes: it.notes,
          sort_order: ii,
          created_at: "",
          updated_at: "",
        })),
      }),
    ),
  }))
}

export function DietBridge() {
  const importM = useImportDietPlan()
  const [text, setText] = useState("")
  const [activate, setActivate] = useState(true)
  const [done, setDone] = useState(false)

  const prompt = useMemo(() => buildDietPrompt(), [])
  const parsed = useParsedImport(text, dietImportSchema, normalizeDietInput, LABELS)

  const preview = useMemo(() => {
    if (parsed.kind !== "ok") return null
    const tree = toTree(parsed.data)
    const target = parsed.data.targets.kcal ?? null
    const warnings: string[] = []
    let missing = 0
    tree.forEach((day) =>
      day.meals.forEach((m) =>
        m.items.forEach((it) => {
          if (!isNum(it.kcal)) missing += 1
          else if (it.kcal > 40 && isNum(it.protein_g) && isNum(it.carbs_g) && isNum(it.fat_g)) {
            const est = macroKcal({ protein_g: it.protein_g, carbs_g: it.carbs_g, fat_g: it.fat_g })
            if (Math.abs(est - it.kcal) / it.kcal > 0.15) {
              warnings.push(`${day.label} › ${it.food_name}: ${formatNumber(it.kcal, 0)} kcal ma i macro ne danno ${formatNumber(est, 0)}`)
            }
          }
        }),
      ),
    )
    if (missing) warnings.unshift(`${missing} alimenti senza calorie: i totali saranno sottostimati`)
    const days = tree.map((d) => {
      const t = dayTotals(d)
      if (isNum(target) && t.kcal > 0 && Math.abs(t.kcal - target) / target > 0.1) {
        warnings.push(`${d.label}: ${formatNumber(t.kcal, 0)} kcal contro l'obiettivo di ${formatNumber(target, 0)}`)
      }
      return { d, t }
    })
    return { days, warnings, target }
  }, [parsed])

  async function runImport() {
    if (parsed.kind !== "ok") return
    try {
      await importM.mutateAsync({ ...parsed.data, schema: "vitruvian.diet.v1", activate, source: "ai_import" })
      setDone(true)
      setText("")
      playSound("success")
      toast.success("Piano alimentare importato")
    } catch (e) {
      playSound("error")
      toast.error("Import non riuscito", { description: e instanceof Error ? e.message : undefined })
    }
  }

  const status =
    parsed.kind === "empty"
      ? null
      : parsed.kind === "error"
        ? { ok: false, message: parsed.message, issues: parsed.issues }
        : {
            ok: true,
            message: `"${parsed.data.name}": ${parsed.data.days.length} ${parsed.data.days.length === 1 ? "giorno" : "giorni"}, ${parsed.data.days.reduce((n, d) => n + d.meals.length, 0)} pasti`,
          }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <PromptStep
          prompt={prompt}
          hint={
            <ol className="list-inside list-decimal space-y-0.5">
              <li>Apri Gemini, ChatGPT o Claude e incolla il prompt.</li>
              <li>Allega il PDF o le foto della dieta del nutrizionista.</li>
              <li>Se mancano i valori nutrizionali, l&apos;IA li stima dalle tabelle CREA/USDA.</li>
            </ol>
          }
        />
        <PasteStep
          value={text}
          onChange={(v) => {
            setText(v)
            setDone(false)
          }}
          status={status}
        />
      </div>

      {done && (
        <StepCard n={4} title="Import completato" done>
          <p className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="size-4 text-gain" />
            Piano salvato{activate ? " e attivato" : ""}.
          </p>
          <Button asChild className="mt-4 rounded-xl">
            <Link href="/nutrition">Vai alla nutrizione</Link>
          </Button>
        </StepCard>
      )}

      {preview && parsed.kind === "ok" && (
        <StepCard n={3} title="Verifica e importa" description="Pasti, alimenti e totali per giorno">
          <div className="mb-4 flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
            {parsed.data.professional && <span>{parsed.data.professional}</span>}
            {preview.target !== null && <span>Obiettivo {formatNumber(preview.target, 0)} kcal</span>}
            {parsed.data.targets.protein_g != null && <span>Proteine {formatNumber(parsed.data.targets.protein_g, 0)} g</span>}
          </div>

          {preview.warnings.length > 0 && (
            <ul className="mb-4 space-y-1 rounded-xl border border-warn/30 bg-warn/[0.06] p-3 text-xs text-warn">
              {preview.warnings.slice(0, 8).map((w) => (
                <li key={w}>⚠ {w}</li>
              ))}
            </ul>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            {preview.days.map(({ d, t }) => (
              <div key={d.id} className="rounded-xl surface-inset p-4">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-sm font-semibold">{d.label}</p>
                  <p className="text-xs tabular text-muted-foreground">
                    {formatNumber(t.kcal, 0)} kcal · P {formatNumber(t.protein_g, 0)} · C {formatNumber(t.carbs_g, 0)} · G{" "}
                    {formatNumber(t.fat_g, 0)}
                  </p>
                </div>
                <ul className="mt-3 space-y-2">
                  {d.meals.map((m) => (
                    <li key={m.id} className="text-xs">
                      <p className="font-medium">
                        {m.label ?? MEAL_SLOT_LABELS[m.slot]}
                        {m.time_hint && <span className="ml-1 text-muted-foreground">· {m.time_hint}</span>}
                        <span className="ml-1 tabular text-muted-foreground">· {formatNumber(mealTotals(m).kcal, 0)} kcal</span>
                      </p>
                      <p className="mt-0.5 text-muted-foreground">
                        {m.items
                          .map((it) => `${it.food_name}${isNum(it.quantity) ? ` ${formatNumber(it.quantity, 0)} ${it.unit}` : ""}${it.alternative_group ? ` [alt ${it.alternative_group}]` : ""}`)
                          .join(" · ")}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={activate}
                onChange={(e) => setActivate(e.target.checked)}
                className="size-4 accent-[var(--neon)]"
              />
              Rendi questo il piano attivo
            </label>
            <Button className="rounded-xl" onClick={() => void runImport()} disabled={importM.isPending}>
              {importM.isPending ? <LoaderCircle className="size-4 animate-spin" /> : <Upload className="size-4" />}
              Importa piano
            </Button>
          </div>
        </StepCard>
      )}
    </div>
  )
}
