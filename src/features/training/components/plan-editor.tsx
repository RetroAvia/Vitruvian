"use client"

import * as DialogPrimitive from "@radix-ui/react-dialog"
import { ArrowDown, ArrowUp, Copy, LoaderCircle, Plus, Save, Trash2, X } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"

import { MuscleFigure } from "@/components/body/muscle-figure"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { NativeSelect } from "@/components/ui/native-select"
import { Emoji } from "@/components/shared/emoji"
import { parseDecimal } from "@/features/checkups/schemas/checkup-form"
import { isNum } from "@/lib/format"
import { playSound } from "@/lib/sound"
import { cn } from "@/lib/utils"

import { useSaveTrainingPlan } from "../api/training"
import { exerciseEmoji, resolveExercise } from "../engine/analysis"
import { MUSCLES } from "../engine/catalog"
import { TECHNIQUES } from "../engine/techniques"
import { GOAL_LABELS, type PlanPayload, type Technique, type TrainingTree } from "../types"
import { ExercisePicker, type PickedExercise } from "./exercise-picker"

interface EEx {
  key: string
  code: string
  name: string
  primary: string | null
  secondary: string[]
  pattern: string | null
  sets: string
  repsMin: string
  repsMax: string
  rest: string
  rir: string
  load: string
  minutes: string
  technique: Technique
  superset: string
  notes: string
}
interface EDay {
  key: string
  label: string
  dow: string
  focus: string
  exercises: EEx[]
}
interface EPlan {
  id: string | null
  name: string
  goal: string
  split: string
  coach: string
  daysPerWeek: string
  notes: string
  active: boolean
  days: EDay[]
}

let seq = 0
const k = () => `e${Date.now().toString(36)}${(seq++).toString(36)}`
const s = (v: number | null | undefined) => (isNum(v) ? String(v).replace(".", ",") : "")
const n = (v: string) => {
  const x = parseDecimal(v)
  return isNum(x) ? x : null
}
const DOW = ["", "Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato", "Domenica"]
const RESTS = [30, 45, 60, 75, 90, 120, 150, 180, 240]

export function fromTree(tree: TrainingTree): EPlan {
  return {
    id: tree.plan.id,
    name: tree.plan.name,
    goal: tree.plan.goal,
    split: tree.plan.split ?? "",
    coach: tree.plan.coach ?? "",
    daysPerWeek: s(tree.plan.days_per_week),
    notes: tree.plan.notes ?? "",
    active: tree.plan.is_active,
    days: tree.days.map((d) => ({
      key: k(),
      label: d.label,
      dow: s(d.day_of_week),
      focus: d.focus ?? "",
      exercises: d.exercises.map((e) => ({
        key: k(),
        code: e.exercise_code,
        name: e.name,
        primary: e.muscle_primary,
        secondary: e.muscles_secondary,
        pattern: e.pattern,
        sets: s(e.sets),
        repsMin: s(e.reps_min),
        repsMax: s(e.reps_max),
        rest: s(e.rest_seconds),
        rir: s(e.target_rir),
        load: s(e.load_kg),
        minutes: s(e.duration_min),
        technique: e.technique,
        superset: s(e.superset_group),
        notes: e.notes ?? "",
      })),
    })),
  }
}

export function fromPayload(p: PlanPayload): EPlan {
  return {
    id: null,
    name: p.name,
    goal: p.goal,
    split: p.split ?? "",
    coach: p.coach ?? "",
    daysPerWeek: s(p.days_per_week),
    notes: p.notes ?? "",
    active: true,
    days: p.days.map((d) => ({
      key: k(),
      label: d.label,
      dow: s(d.day_of_week),
      focus: d.focus ?? "",
      exercises: d.exercises.map((e) => {
        const r = resolveExercise(e.code, e.name)
        return { key: k(), code: e.code, name: e.name, primary: r.primary, secondary: r.secondary, pattern: r.pattern, sets: s(e.sets), repsMin: s(e.reps_min), repsMax: s(e.reps_max), rest: s(e.rest_seconds), rir: s(e.target_rir), load: s(e.load_kg), minutes: s(e.duration_min), technique: e.technique ?? "straight", superset: s(e.superset_group), notes: e.notes ?? "" }
      }),
    })),
  }
}

export const emptyPlan = (): EPlan => ({ id: null, name: "", goal: "hypertrophy", split: "", coach: "", daysPerWeek: "3", notes: "", active: true, days: [{ key: k(), label: "Giorno A", dow: "", focus: "", exercises: [] }] })

function toPayload(p: EPlan): PlanPayload {
  return {
    id: p.id,
    name: p.name.trim(),
    goal: p.goal,
    split: p.split.trim() || null,
    coach: p.coach.trim() || null,
    days_per_week: n(p.daysPerWeek),
    notes: p.notes.trim() || null,
    is_active: p.active,
    days: p.days
      .filter((d) => d.label.trim())
      .map((d) => ({
        label: d.label.trim(),
        day_of_week: n(d.dow),
        focus: d.focus.trim() || null,
        exercises: d.exercises.map((e) => {
          const reps_min = n(e.repsMin)
          const reps_max = n(e.repsMax)
          return {
            code: e.code,
            name: e.name,
            muscle_primary: e.primary,
            muscles_secondary: e.secondary,
            pattern: e.pattern,
            sets: n(e.sets),
            reps_min,
            reps_max: isNum(reps_max) && isNum(reps_min) && reps_max < reps_min ? reps_min : reps_max,
            rest_seconds: n(e.rest),
            target_rir: n(e.rir),
            load_kg: n(e.load),
            duration_min: n(e.minutes),
            technique: e.technique,
            superset_group: n(e.superset),
            notes: e.notes.trim() || null,
          }
        }),
      })),
  }
}

/** Editor completo della scheda: giorni, esercizi, serie, tecniche, superserie. */
export function PlanEditor({ open, onOpenChange, initial, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; initial: EPlan | null; onSaved?: (id: string) => void }) {
  const save = useSaveTrainingPlan()
  const [plan, setPlan] = useState<EPlan>(emptyPlan)
  const [dayIdx, setDayIdx] = useState(0)
  const [picker, setPicker] = useState(false)

  useEffect(() => {
    if (open) {
      setPlan(initial ?? emptyPlan())
      setDayIdx(0)
    }
  }, [open, initial])

  const day = plan.days[dayIdx]
  const setDay = (fn: (d: EDay) => EDay) => setPlan((p) => ({ ...p, days: p.days.map((d, i) => (i === dayIdx ? fn(d) : d)) }))
  const setEx = (key: string, patch: Partial<EEx>) => setDay((d) => ({ ...d, exercises: d.exercises.map((e) => (e.key === key ? { ...e, ...patch } : e)) }))
  const move = <T,>(arr: T[], i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= arr.length) return arr
    const copy = [...arr]
    ;[copy[i], copy[j]] = [copy[j] as T, copy[i] as T]
    return copy
  }

  function addExercise(p: PickedExercise) {
    const cardio = p.pattern === "cardio"
    const strength = Boolean(resolveExercise(p.code, p.name).strength)
    setDay((d) => ({
      ...d,
      exercises: [
        ...d.exercises,
        { key: k(), code: p.code, name: p.name, primary: p.primary, secondary: p.secondary, pattern: p.pattern, sets: cardio ? "" : "3", repsMin: cardio ? "" : strength ? "6" : "10", repsMax: cardio ? "" : strength ? "8" : "12", rest: cardio ? "" : strength ? "150" : "90", rir: cardio ? "" : "2", load: "", minutes: cardio ? "20" : "", technique: "straight", superset: "", notes: "" },
      ],
    }))
  }

  async function onSave() {
    const payload = toPayload(plan)
    if (!payload.name) return toast.error("Dai un nome alla scheda")
    if (payload.days.length === 0 || payload.days.every((d) => d.exercises.length === 0)) return toast.error("Aggiungi almeno un esercizio")
    try {
      const id = await save.mutateAsync(payload)
      playSound("success")
      toast.success(plan.id ? "Scheda aggiornata" : "Scheda creata")
      onSaved?.(id)
      onOpenChange(false)
    } catch (e) {
      playSound("error")
      toast.error("Salvataggio non riuscito", { description: e instanceof Error ? e.message : undefined })
    }
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm" />
        <DialogPrimitive.Content onInteractOutside={(e) => e.preventDefault()} className="fixed inset-0 z-50 flex flex-col bg-background outline-none sm:inset-4 sm:mx-auto sm:max-w-4xl sm:rounded-3xl sm:border sm:shadow-2xl">
          <header className="flex items-center gap-3 border-b px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] sm:pt-4">
            <DialogPrimitive.Close className="grid size-10 place-items-center rounded-xl text-muted-foreground hover:bg-accent" aria-label="Chiudi senza salvare">
              <X className="size-5" />
            </DialogPrimitive.Close>
            <DialogPrimitive.Title className="flex-1 text-base font-semibold">{plan.id ? "Modifica scheda" : "Nuova scheda"}</DialogPrimitive.Title>
            <DialogPrimitive.Description className="sr-only">Giorni, esercizi, serie e tecniche</DialogPrimitive.Description>
            <Button className="rounded-xl" onClick={() => void onSave()} disabled={save.isPending}>
              {save.isPending ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}
              Salva
            </Button>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="space-y-1 text-xs text-muted-foreground sm:col-span-2">
                Nome
                <Input value={plan.name} onChange={(e) => setPlan({ ...plan, name: e.target.value })} className="h-10 rounded-xl" placeholder="Es. Upper Lower inverno" />
              </label>
              <label className="space-y-1 text-xs text-muted-foreground">
                Obiettivo
                <NativeSelect value={plan.goal} onChange={(e) => setPlan({ ...plan, goal: e.target.value })}>
                  {Object.entries(GOAL_LABELS).map(([key, v]) => (
                    <option key={key} value={key}>
                      {v}
                    </option>
                  ))}
                </NativeSelect>
              </label>
              <label className="space-y-1 text-xs text-muted-foreground">
                Allenamenti/settimana
                <NativeSelect value={plan.daysPerWeek} onChange={(e) => setPlan({ ...plan, daysPerWeek: e.target.value })}>
                  {[1, 2, 3, 4, 5, 6, 7].map((x) => (
                    <option key={x} value={x}>
                      {x}
                    </option>
                  ))}
                </NativeSelect>
              </label>
              <label className="space-y-1 text-xs text-muted-foreground">
                Divisione
                <Input value={plan.split} onChange={(e) => setPlan({ ...plan, split: e.target.value })} className="h-10 rounded-xl" placeholder="Es. Push / Pull / Legs" />
              </label>
              <label className="space-y-1 text-xs text-muted-foreground">
                Preparatore
                <Input value={plan.coach} onChange={(e) => setPlan({ ...plan, coach: e.target.value })} className="h-10 rounded-xl" />
              </label>
              <label className="space-y-1 text-xs text-muted-foreground sm:col-span-2">
                Note
                <Input value={plan.notes} onChange={(e) => setPlan({ ...plan, notes: e.target.value })} className="h-10 rounded-xl" />
              </label>
            </div>
            <label className="mt-3 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={plan.active} onChange={(e) => setPlan({ ...plan, active: e.target.checked })} className="size-4 accent-[var(--neon)]" />
              Scheda attiva (quella proposta ogni giorno)
            </label>

            {/* Giorni */}
            <div className="-mx-4 mt-5 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
              {plan.days.map((d, i) => (
                <button
                  key={d.key}
                  type="button"
                  onClick={() => setDayIdx(i)}
                  className={cn("h-9 shrink-0 rounded-xl border px-3 text-sm font-medium", i === dayIdx ? "border-neon/50 bg-neon/10 text-neon" : "text-muted-foreground")}
                >
                  {d.label || `Giorno ${i + 1}`} <span className="text-[11px] opacity-70">{d.exercises.length}</span>
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  setPlan((p) => ({ ...p, days: [...p.days, { key: k(), label: `Giorno ${String.fromCharCode(65 + p.days.length)}`, dow: "", focus: "", exercises: [] }] }))
                  setDayIdx(plan.days.length)
                }}
                className="flex h-9 shrink-0 items-center gap-1 rounded-xl border border-dashed px-3 text-sm text-muted-foreground"
              >
                <Plus className="size-4" /> Giorno
              </button>
            </div>

            {day && (
              <div className="mt-3 space-y-3">
                <div className="grid gap-2 sm:grid-cols-[1fr_150px_1fr_auto]">
                  <Input aria-label="Nome del giorno" value={day.label} onChange={(e) => setDay((d) => ({ ...d, label: e.target.value }))} className="h-10 rounded-xl" />
                  <NativeSelect aria-label="Giorno della settimana" value={day.dow} onChange={(e) => setDay((d) => ({ ...d, dow: e.target.value }))}>
                    <option value="">A rotazione</option>
                    {DOW.slice(1).map((x, i) => (
                      <option key={x} value={i + 1}>
                        {x}
                      </option>
                    ))}
                  </NativeSelect>
                  <Input aria-label="Focus del giorno" placeholder="Focus (es. petto e tricipiti)" value={day.focus} onChange={(e) => setDay((d) => ({ ...d, focus: e.target.value }))} className="h-10 rounded-xl" />
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="size-10 rounded-xl" aria-label="Duplica giorno" onClick={() => {
                      setPlan((p) => ({ ...p, days: [...p.days, { ...day, key: k(), label: `${day.label} (copia)`, exercises: day.exercises.map((e) => ({ ...e, key: k() })) }] }))
                      setDayIdx(plan.days.length)
                    }}>
                      <Copy className="size-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="size-10 rounded-xl text-danger" aria-label="Elimina giorno" disabled={plan.days.length === 1} onClick={() => {
                      setPlan((p) => ({ ...p, days: p.days.filter((_, i) => i !== dayIdx) }))
                      setDayIdx(Math.max(0, dayIdx - 1))
                    }}>
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>

                {day.exercises.map((e, i) => {
                  const cardio = e.pattern === "cardio"
                  return (
                    <div key={e.key} className="surface-inset rounded-2xl p-3">
                      <div className="flex items-start gap-3">
                        <div className="h-16 w-8 shrink-0">
                          <MuscleFigure primary={(e.primary as never) ?? null} secondary={e.secondary as never} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">
                            {e.superset && <span className="mr-1 rounded bg-bia/15 px-1 text-[10px] text-bia">SS{e.superset}</span>}
                            <Emoji e={exerciseEmoji(e.code ?? "", e.name, { muscle_primary: (e.primary as never) ?? null, pattern: cardio ? "cardio" : undefined })} className="mr-1" />
                            {e.name}
                          </p>
                          <p className="text-[11px] text-muted-foreground">{e.primary ? MUSCLES[e.primary as keyof typeof MUSCLES] : cardio ? "Cardio" : "—"}</p>
                        </div>
                        <div className="flex">
                          <Button variant="ghost" size="icon" className="size-8 rounded-lg" aria-label="Sposta su" onClick={() => setDay((d) => ({ ...d, exercises: move(d.exercises, i, -1) }))}>
                            <ArrowUp className="size-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="size-8 rounded-lg" aria-label="Sposta giù" onClick={() => setDay((d) => ({ ...d, exercises: move(d.exercises, i, 1) }))}>
                            <ArrowDown className="size-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="size-8 rounded-lg text-danger" aria-label="Rimuovi esercizio" onClick={() => setDay((d) => ({ ...d, exercises: d.exercises.filter((x) => x.key !== e.key) }))}>
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </div>
                      {cardio ? (
                        <label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                          Minuti
                          <Input inputMode="numeric" value={e.minutes} onChange={(x) => setEx(e.key, { minutes: x.target.value })} className="h-9 w-20 rounded-lg text-center" />
                        </label>
                      ) : (
                        <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-7">
                          <Field label="Serie" value={e.sets} onChange={(v) => setEx(e.key, { sets: v })} />
                          <Field label="Rip. min" value={e.repsMin} onChange={(v) => setEx(e.key, { repsMin: v })} />
                          <Field label="Rip. max" value={e.repsMax} onChange={(v) => setEx(e.key, { repsMax: v })} />
                          <label className="space-y-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                            Recupero
                            <NativeSelect value={e.rest} onChange={(x) => setEx(e.key, { rest: x.target.value })} className="h-9">
                              <option value="">—</option>
                              {RESTS.map((r) => (
                                <option key={r} value={r}>
                                  {Math.floor(r / 60)}:{String(r % 60).padStart(2, "0")}
                                </option>
                              ))}
                            </NativeSelect>
                          </label>
                          <Field label="RIR" value={e.rir} onChange={(v) => setEx(e.key, { rir: v })} />
                          <Field label="Carico kg" value={e.load} onChange={(v) => setEx(e.key, { load: v })} />
                          <label className="space-y-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                            Superserie
                            <NativeSelect value={e.superset} onChange={(x) => setEx(e.key, { superset: x.target.value })} className="h-9">
                              <option value="">—</option>
                              {[1, 2, 3, 4, 5].map((g) => (
                                <option key={g} value={g}>
                                  SS{g}
                                </option>
                              ))}
                            </NativeSelect>
                          </label>
                          <label className="col-span-3 space-y-1 text-[10px] uppercase tracking-wider text-muted-foreground sm:col-span-3">
                            Tecnica
                            <NativeSelect value={e.technique} onChange={(x) => setEx(e.key, { technique: x.target.value as Technique })} className="h-9">
                              {(Object.keys(TECHNIQUES) as Technique[]).map((t) => (
                                <option key={t} value={t}>
                                  {TECHNIQUES[t].label}
                                </option>
                              ))}
                            </NativeSelect>
                          </label>
                          <label className="col-span-3 space-y-1 text-[10px] uppercase tracking-wider text-muted-foreground sm:col-span-4">
                            Note
                            <Input value={e.notes} onChange={(x) => setEx(e.key, { notes: x.target.value })} className="h-9 rounded-lg normal-case tracking-normal" placeholder="Es. presa stretta, pausa al petto" />
                          </label>
                          {e.technique !== "straight" && <p className="col-span-3 text-[11px] text-muted-foreground sm:col-span-7">{TECHNIQUES[e.technique].description}</p>}
                        </div>
                      )}
                    </div>
                  )
                })}
                <Button variant="outline" className="h-11 w-full rounded-xl border-dashed" onClick={() => setPicker(true)}>
                  <Plus className="size-4" /> Aggiungi esercizio a {day.label || "questo giorno"}
                </Button>
              </div>
            )}
          </div>
          <ExercisePicker open={picker} onOpenChange={setPicker} onPick={addExercise} />
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="space-y-1 text-[10px] uppercase tracking-wider text-muted-foreground">
      {label}
      <Input inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} className="h-9 rounded-lg px-1 text-center text-sm tabular" />
    </label>
  )
}

export type { EPlan }
