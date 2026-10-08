"use client"

import { CheckCircle2, LoaderCircle, Upload } from "lucide-react"
import Link from "next/link"
import { useMemo, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { useImportTraining, useTrainingPlans, useWorkouts } from "@/features/training/api/training"
import { planVolume, resolveExercise } from "@/features/training/engine/analysis"
import { findExercise, MUSCLES, type Muscle } from "@/features/training/engine/catalog"
import { GOAL_LABELS, type TrainingTree } from "@/features/training/types"
import { formatDate, formatNumber } from "@/lib/format"
import { playSound } from "@/lib/sound"
import { cn } from "@/lib/utils"

import { useParsedImport } from "../lib/use-parsed-import"
import { buildTrainingPrompt } from "../prompts/training-prompt"
import { normalizeTrainingInput, trainingImportSchema, type TrainingImport } from "../schemas/training-import"
import { PasteStep, PromptStep, StepCard } from "./bridge-steps"

const LABELS = { plan: "Scheda", days: "Giorno", exercises: "Esercizio", history: "Sessione", sets: "Serie" }
const DOW = ["", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"]

/** Albero "finto" per calcolare il volume della scheda prima di salvarla. */
function previewTree(plan: NonNullable<TrainingImport["plan"]>): TrainingTree {
  const now = ""
  return {
    plan: { id: "preview", user_id: "", name: plan.name, coach: null, goal: plan.goal, split: null, days_per_week: plan.days_per_week ?? null, valid_from: null, valid_to: null, is_active: true, notes: null, source: "ai_import", raw_payload: null, created_at: now, updated_at: now },
    days: plan.days.map((d, i) => ({
      id: `d${i}`,
      plan_id: "preview",
      user_id: "",
      label: d.label,
      day_of_week: d.day_of_week ?? null,
      focus: null,
      sort_order: i,
      created_at: now,
      updated_at: now,
      exercises: d.exercises.map((e, j) => ({
        id: `e${i}-${j}`,
        day_id: `d${i}`,
        user_id: "",
        exercise_code: e.code,
        name: e.name,
        muscle_primary: e.muscle_primary,
        muscles_secondary: e.muscles_secondary,
        pattern: e.pattern,
        sets: e.sets ?? null,
        reps_min: e.reps_min ?? null,
        reps_max: e.reps_max ?? null,
        target_rir: null,
        rest_seconds: null,
        tempo: null,
        load_kg: null,
        duration_min: e.duration_min ?? null,
        superset_group: null,
        notes: null,
        technique: e.technique,
        set_scheme: null,
        sort_order: j,
        created_at: now,
        updated_at: now,
      })),
    })),
  }
}

/**
 * @param embeddedText risposta incollata altrove (Coach AI): niente passaggi di prompt
 *        e incolla, solo verifica e import della parte "vitruvian.training.v1".
 */
export function TrainingBridge({ embeddedText, onImported }: { embeddedText?: string; onImported?: () => void } = {}) {
  const plansQ = useTrainingPlans()
  const workoutsQ = useWorkouts()
  const importM = useImportTraining()
  const [text, setText] = useState("")
  const [done, setDone] = useState<{ workouts: number; sets: number; plan: boolean; active: boolean } | null>(null)
  /** null = segue il campo "activate" della risposta dell'IA */
  const [activateChoice, setActivateChoice] = useState<boolean | null>(null)

  const prompt = useMemo(() => buildTrainingPrompt(), [])
  const parsed = useParsedImport(embeddedText ?? text, trainingImportSchema, normalizeTrainingInput, LABELS, "vitruvian.training.v1")

  const preview = useMemo(() => {
    if (parsed.kind !== "ok") return null
    const d = parsed.data
    const existingPlan = d.plan ? (plansQ.data ?? []).find((p) => p.name.toLowerCase() === d.plan?.name.toLowerCase()) : undefined
    const volume = d.plan ? planVolume(previewTree(d.plan)) : null
    const muscles = volume
      ? (Object.entries(volume.perMuscle) as Array<[Muscle, number]>).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1])
      : []
    const unknown = d.plan ? d.plan.days.flatMap((day) => day.exercises.filter((e) => !findExercise(e.code, e.name) && !e.muscle_primary).map((e) => e.name)) : []
    const dates = d.history.map((h) => h.date).sort()
    const existingDates = new Set((workoutsQ.data ?? []).map((w) => `${w.workout_date}|${w.title.toLowerCase()}`))
    const overwrite = d.history.filter((h) => existingDates.has(`${h.date}|${(h.title ?? h.day_label ?? "Allenamento").toLowerCase()}`)).length
    const totalSets = d.history.reduce((n, h) => n + h.exercises.reduce((m, e) => m + e.sets.length, 0), 0)
    return { d, existingPlan, volume, muscles, unknown, dates, overwrite, totalSets }
  }, [parsed, plansQ.data, workoutsQ.data])

  async function runImport() {
    if (parsed.kind !== "ok") return
    try {
      const activate = activateChoice ?? parsed.data.activate
      const r = await importM.mutateAsync({ ...parsed.data, activate, schema: "vitruvian.training.v1" })
      setDone({ workouts: r.workouts, sets: r.sets, plan: Boolean(r.plan_id), active: Boolean(r.plan_id) && (activate || Boolean(preview?.existingPlan?.is_active)) })
      setActivateChoice(null)
      setText("")
      onImported?.()
      playSound("success")
      toast.success("Allenamento importato", { description: `${r.plan_id ? "Scheda salvata" : "Nessuna scheda"} · ${r.workouts} sessioni · ${r.sets} serie` })
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
            message: [
              parsed.data.plan ? `Scheda "${parsed.data.plan.name}" (${parsed.data.plan.days.length} giorni)` : null,
              parsed.data.history.length ? `${parsed.data.history.length} sessioni nello storico` : null,
            ]
              .filter(Boolean)
              .join(" · "),
          }

  return (
    <div className="space-y-4">
      {embeddedText === undefined ? (
      <div className="grid gap-4 lg:grid-cols-2">
          <PromptStep
            prompt={prompt}
            hint={
              <ol className="list-inside list-decimal space-y-0.5">
                <li>Incolla il prompt in Gemini, ChatGPT o Claude.</li>
                <li>Allega la scheda (foto, PDF o testo) e, se ce l&apos;hai, il diario degli ultimi mesi con carichi e ripetizioni.</li>
                <li>Incolla qui la risposta: l&apos;app calcola volume per muscolo, progressi e la collega alle tue misure.</li>
              </ol>
            }
          />
          <PasteStep
            value={text}
            onChange={(v) => {
              setText(v)
              setDone(null)
            }}
            status={status}
          />
        </div>
      ) : (
        status &&
        !status.ok && (
          <p role="alert" className="rounded-xl bg-danger/10 p-3 text-xs text-danger ring-1 ring-inset ring-danger/25">
            {status.message}
            {"issues" in status && status.issues?.length ? `: ${status.issues.slice(0, 3).join(" · ")}` : ""}
          </p>
        )
      )}

      {done && (
        <StepCard n={embeddedText === undefined ? 4 : undefined} title="Import completato" done>
          <p className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="size-4 text-gain" />
            {done.plan ? (done.active ? "Scheda salvata e attivata" : "Scheda salvata (non attiva: la trovi nell'elenco schede)") : "Storico aggiornato"} · {done.workouts} sessioni · {done.sets} serie.
          </p>
          <Button asChild className="mt-4 rounded-xl">
            <Link href="/training">Vai all&apos;allenamento</Link>
          </Button>
        </StepCard>
      )}

      {preview && (
        <StepCard n={embeddedText === undefined ? 3 : undefined} title="Verifica e importa" description="Controlla giorni, esercizi e serie prima di salvare">
          <div className="space-y-5">
            {preview.d.plan && (
              <div>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold">{preview.d.plan.name}</p>
                  <span className="text-xs text-muted-foreground">
                    {GOAL_LABELS[preview.d.plan.goal]} · {preview.d.plan.days_per_week ?? preview.d.plan.days.length} giorni/settimana
                  </span>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset",
                      preview.existingPlan ? "bg-bia/10 text-bia ring-bia/25" : "bg-gain/10 text-gain ring-gain/25",
                    )}
                  >
                    {preview.existingPlan ? "Sostituisce la scheda con lo stesso nome" : "Nuova scheda"}
                  </span>
                </div>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {preview.d.plan.days.map((day) => (
                    <div key={day.label} className="surface-inset rounded-xl p-3">
                      <p className="text-sm font-semibold">
                        {day.label}
                        {day.day_of_week ? <span className="ml-2 text-xs font-normal text-muted-foreground">{DOW[day.day_of_week]}</span> : null}
                      </p>
                      <ul className="mt-2 space-y-1 text-xs">
                        {day.exercises.map((e, i) => {
                          const r = resolveExercise(e.code, e.name, e)
                          const known = Boolean(findExercise(e.code, e.name))
                          return (
                            <li key={`${e.code}-${i}`} className="flex justify-between gap-2 border-t pt-1">
                              <span className="min-w-0">
                                <span className="block truncate">{e.name}</span>
                                <span className={cn("block truncate text-[10px]", known ? "text-muted-foreground" : r.primary ? "text-bia" : "text-warn")}>
                                  {r.pattern === "cardio" ? "cardio" : r.primary ? MUSCLES[r.primary] : "muscolo non indicato"}
                                  {!known && " · personalizzato"}
                                </span>
                              </span>
                              <span className="whitespace-nowrap tabular text-muted-foreground">
                                {r.pattern === "cardio"
                                  ? `${formatNumber(e.duration_min, 0)} min`
                                  : `${e.sets ?? "?"}×${e.reps_min ?? "?"}${e.reps_max && e.reps_max !== e.reps_min ? `–${e.reps_max}` : ""}`}
                              </span>
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  ))}
                </div>
                {preview.muscles.length > 0 && (
                  <div className="mt-3">
                    <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Serie settimanali per muscolo</p>
                    <div className="flex flex-wrap gap-1.5">
                      {preview.muscles.map(([m, v]) => (
                        <span key={m} className={cn("rounded-full px-2 py-0.5 text-[11px] tabular ring-1 ring-inset", v < 8 ? "bg-warn/10 text-warn ring-warn/25" : v > 22 ? "bg-danger/10 text-danger ring-danger/25" : "bg-gain/10 text-gain ring-gain/25")}>
                          {MUSCLES[m]} {formatNumber(v, v % 1 ? 1 : 0)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {preview.unknown.length > 0 && (
                  <p className="mt-2 text-xs text-warn">
                    ⚠ Senza muscolo indicato (esclusi dal calcolo del volume): {preview.unknown.join(", ")}.
                  </p>
                )}
              </div>
            )}

            {preview.d.history.length > 0 && (
              <div className="surface-inset rounded-xl p-3 text-sm">
                <p className="font-semibold">Storico: {preview.d.history.length} sessioni</p>
                <p className="text-xs text-muted-foreground">
                  dal {formatDate(preview.dates[0], "medium")} al {formatDate(preview.dates[preview.dates.length - 1], "medium")} · {preview.totalSets} serie
                  {preview.overwrite > 0 && ` · ${preview.overwrite} già presenti verranno aggiornate`}
                </p>
              </div>
            )}
          </div>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {preview.d.plan ? (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={activateChoice ?? preview.d.activate}
                  onChange={(e) => setActivateChoice(e.target.checked)}
                  className="size-4 accent-[var(--neon)]"
                />
                Rendi questa la scheda attiva
              </label>
            ) : (
              <span />
            )}
            <Button className="rounded-xl" onClick={() => void runImport()} disabled={importM.isPending}>
              {importM.isPending ? <LoaderCircle className="size-4 animate-spin" /> : <Upload className="size-4" />}
              Importa
            </Button>
          </div>
        </StepCard>
      )}
    </div>
  )
}
