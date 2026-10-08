"use client"

import { ChevronDown, Pencil, Play, Star, Trash2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { GlassCard } from "@/components/shared/glass-card"
import { Button } from "@/components/ui/button"
import { NativeSelect } from "@/components/ui/native-select"
import { Emoji } from "@/components/shared/emoji"
import { formatDate, formatNumber } from "@/lib/format"
import { playSound } from "@/lib/sound"
import { cn } from "@/lib/utils"

import { useActivateTrainingPlan, useDeleteTrainingPlan } from "../api/training"
import { exerciseEmoji, resolveExercise, setsLabel } from "../engine/analysis"
import { MUSCLES } from "../engine/catalog"
import { TECHNIQUES } from "../engine/techniques"
import { GOAL_LABELS, type TrainingDay, type TrainingPlan, type TrainingTree } from "../types"

const DOW = ["", "Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato", "Domenica"]

export function PlanCard({
  tree,
  plans,
  selectedId,
  onSelect,
  onStart,
  onEdit,
}: {
  onEdit: () => void
  tree: TrainingTree
  plans: TrainingPlan[]
  selectedId: string
  onSelect: (id: string) => void
  onStart: (day: TrainingDay) => void
}) {
  const activate = useActivateTrainingPlan()
  const del = useDeleteTrainingPlan()
  const [confirm, setConfirm] = useState(false)
  const [open, setOpen] = useState<string | null>(tree.days[0]?.id ?? null)
  const p = tree.plan

  return (
    <GlassCard className="p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            {p.name}
            {p.is_active && <span className="rounded-full bg-gain/10 px-2 py-0.5 text-[10px] font-medium text-gain ring-1 ring-inset ring-gain/25">Attiva</span>}
          </h3>
          <p className="text-xs text-muted-foreground">
            {[GOAL_LABELS[p.goal] ?? p.goal, p.split, `${p.days_per_week ?? tree.days.length} giorni/settimana`, p.coach, p.valid_from ? `dal ${formatDate(p.valid_from, "medium")}` : null].filter(Boolean).join(" · ")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {plans.length > 1 && (
            <NativeSelect aria-label="Scheda" value={selectedId} onChange={(e) => onSelect(e.target.value)} className="w-48">
              {plans.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                  {x.is_active ? " (attiva)" : ""}
                </option>
              ))}
            </NativeSelect>
          )}
          {!p.is_active && (
            <Button
              variant="outline"
              size="sm"
              className="rounded-lg"
              disabled={activate.isPending}
              onClick={() =>
                activate.mutate(p.id, {
                  onSuccess: () => {
                    playSound("success")
                    toast.success("Scheda attivata")
                  },
                  onError: (e) => toast.error(e.message),
                })
              }
            >
              <Star className="size-4" /> Attiva
            </Button>
          )}
          <Button variant="outline" size="sm" className="rounded-lg" onClick={onEdit}>
            <Pencil className="size-4" /> Modifica
          </Button>
          <Button variant="ghost" size="icon" className="size-9 rounded-lg text-danger hover:text-danger" aria-label="Elimina scheda" onClick={() => setConfirm(true)}>
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        {tree.days.map((d) => {
          const isOpen = open === d.id
          const sets = d.exercises.reduce((n, e) => n + (e.sets ?? 0), 0)
          return (
            <div key={d.id} className="surface-inset overflow-hidden rounded-xl">
              <div className="flex items-center gap-2 pr-2">
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setOpen(isOpen ? null : d.id)}
                  className="flex min-w-0 flex-1 items-center gap-3 p-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                >
                  <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform duration-300", isOpen && "rotate-180")} />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{d.label}</span>
                    <span className="block truncate text-[11px] text-muted-foreground">
                      {[d.day_of_week ? DOW[d.day_of_week] : null, d.focus, `${d.exercises.length} esercizi · ${sets} serie`].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                </button>
                <Button size="sm" variant="ghost" className="shrink-0 rounded-lg text-neon" onClick={() => onStart(d)}>
                  <Play className="size-3.5" /> Inizia
                </Button>
              </div>
              <div className={cn("grid transition-[grid-template-rows] duration-300 ease-out", isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
                <div className="overflow-hidden">
                  <div className="overflow-x-auto border-t px-3 pb-3">
                    <table className="w-full text-xs tabular sm:min-w-[520px]">
                      <thead>
                        <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                          <th className="py-2 pr-2 font-medium">Esercizio</th>
                          <th className="hidden py-2 pr-2 font-medium sm:table-cell">Muscolo</th>
                          <th className="py-2 pr-2 text-right font-medium">Serie × rip.</th>
                          <th className="hidden py-2 pr-2 text-right font-medium sm:table-cell">RIR</th>
                          <th className="hidden py-2 text-right font-medium sm:table-cell">Recupero</th>
                        </tr>
                      </thead>
                      <tbody>
                        {d.exercises.map((e) => {
                          const r = resolveExercise(e.exercise_code, e.name, e)
                          return (
                            <tr key={e.id} className="border-t">
                              <td className="py-1.5 pr-2">
                                {e.superset_group ? <span className="mr-1 rounded bg-bia/15 px-1 text-[10px] text-bia">SS{e.superset_group}</span> : null}
                                <Emoji e={exerciseEmoji(e.exercise_code, e.name, e)} />
                                {e.name}
                                {e.technique !== "straight" && <span className="ml-1.5 rounded bg-neon/10 px-1 text-[10px] text-neon">{TECHNIQUES[e.technique].short}</span>}
                                {e.notes && <span className="block text-[10px] text-muted-foreground">{e.notes}</span>}
                              </td>
                              <td className="hidden py-1.5 pr-2 text-muted-foreground sm:table-cell">{r.pattern === "cardio" ? "Cardio" : r.primary ? MUSCLES[r.primary] : "—"}</td>
                              <td className="whitespace-nowrap py-1.5 pr-2 text-right">
                                {r.pattern === "cardio"
                                  ? `${formatNumber(e.duration_min, 0)} min`
                                  : setsLabel(e)}
                                {e.load_kg ? <span className="block text-[10px] text-muted-foreground">{formatNumber(e.load_kg, 1)} kg</span> : null}
                              </td>
                              <td className="hidden py-1.5 pr-2 text-right text-muted-foreground sm:table-cell">{e.target_rir ?? "–"}</td>
                              <td className="hidden py-1.5 text-right text-muted-foreground sm:table-cell">{e.rest_seconds ? `${Math.floor(e.rest_seconds / 60)}:${String(e.rest_seconds % 60).padStart(2, "0")}` : "–"}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
      {p.notes && <p className="mt-3 text-xs text-muted-foreground">{p.notes}</p>}

      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={`Eliminare la scheda "${p.name}"?`}
        description="Le sessioni già registrate restano nello storico (scollegate dalla scheda)."
        pending={del.isPending}
        onConfirm={async () => {
          try {
            await del.mutateAsync(p.id)
            setConfirm(false)
            toast.success("Scheda eliminata")
          } catch (e) {
            toast.error("Eliminazione non riuscita", { description: e instanceof Error ? e.message : undefined })
          }
        }}
      />
    </GlassCard>
  )
}
