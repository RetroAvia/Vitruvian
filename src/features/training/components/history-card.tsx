"use client"

import { ChevronDown, FileDown, LoaderCircle, Pencil, Trash2 } from "lucide-react"
import { useMemo, useState } from "react"
import { toast } from "sonner"

import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { GlassCard } from "@/components/shared/glass-card"
import { Button } from "@/components/ui/button"
import { Emoji } from "@/components/shared/emoji"
import { formatDate, formatNumber, shiftISO, todayISO } from "@/lib/format"
import { cn } from "@/lib/utils"

import { exportWorkoutsCsv, useDeleteWorkout, useWorkoutDetail } from "../api/training"
import { activityCalendar, exerciseEmoji, isoWeekday } from "../engine/analysis"
import { SET_TYPE_LABELS, type WorkoutSummary } from "../types"

/** Calendario a "quadretti" degli ultimi 6 mesi (stile GitHub). */
export function ActivityHeatmap({ workouts }: { workouts: WorkoutSummary[] }) {
  const today = todayISO()
  const weeks = 26
  const cal = useMemo(() => activityCalendar(workouts, today, weeks * 7 + 7), [workouts, today])
  // la griglia parte dal lunedì di 26 settimane fa
  const start = shiftISO(today, -(weeks - 1) * 7 - (isoWeekday(today) - 1))
  const max = Math.max(1, ...[...cal.values()].map((v) => v.sets))
  const cols = Array.from({ length: weeks }, (_, w) => Array.from({ length: 7 }, (_, d) => shiftISO(start, w * 7 + d)))
  const total = [...cal.values()].length

  return (
    <GlassCard className="p-5">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold">Ultimi 6 mesi</h3>
        <span className="text-xs text-muted-foreground">{total} giorni di allenamento</span>
      </div>
      <div className="flex gap-[3px] overflow-x-auto pb-1" role="img" aria-label={`${total} allenamenti negli ultimi 6 mesi`}>
        {cols.map((col, i) => (
          <div key={i} className="flex flex-col gap-[3px]">
            {col.map((d) => {
              const v = cal.get(d)
              const future = d > today
              const lvl = v ? Math.min(4, Math.ceil((v.sets / max) * 4)) : 0
              return (
                <span
                  key={d}
                  title={v ? `${formatDate(d, "medium")}: ${v.titles.join(", ")} (${v.sets} serie)` : formatDate(d, "medium")}
                  className={cn(
                    "size-3 rounded-[3px] sm:size-3.5",
                    future ? "bg-transparent" : lvl === 0 ? "bg-muted/60" : lvl === 1 ? "bg-neon/30" : lvl === 2 ? "bg-neon/50" : lvl === 3 ? "bg-neon/75" : "bg-neon",
                    d === today && "ring-1 ring-foreground/50",
                  )}
                />
              )
            })}
          </div>
        ))}
      </div>
    </GlassCard>
  )
}

export function HistoryCard({ workouts, onEdit }: { workouts: WorkoutSummary[]; onEdit: (w: WorkoutSummary) => void }) {
  const [limit, setLimit] = useState(15)
  const [open, setOpen] = useState<string | null>(null)
  const [toDelete, setToDelete] = useState<WorkoutSummary | null>(null)
  const del = useDeleteWorkout()
  const list = workouts.slice(0, limit)
  const [exporting, setExporting] = useState(false)

  async function onExport() {
    setExporting(true)
    try {
      const csv = await exportWorkoutsCsv()
      const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }))
      const a = document.createElement("a")
      a.href = url
      a.download = `vitruvian-allenamenti-${todayISO()}.csv`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (e) {
      toast.error("Esportazione non riuscita", { description: e instanceof Error ? e.message : undefined })
    } finally {
      setExporting(false)
    }
  }

  return (
    <GlassCard className="p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">Storico sessioni</h3>
          <p className="text-xs text-muted-foreground">{workouts.length} sessioni · i dettagli si caricano solo quando apri una sessione</p>
        </div>
        {workouts.length > 0 && (
          <Button variant="outline" size="sm" className="rounded-lg" disabled={exporting} onClick={() => void onExport()}>
            {exporting ? <LoaderCircle className="size-3.5 animate-spin" /> : <FileDown className="size-3.5" />} Esporta CSV
          </Button>
        )}
      </div>
      {list.length === 0 ? (
        <p className="surface-inset rounded-xl p-4 text-center text-sm text-muted-foreground">Ancora nessuna sessione.</p>
      ) : (
        <ul className="cv-auto space-y-2">
          {list.map((w) => {
            const isOpen = open === w.id
            return (
              <li key={w.id} className="surface-inset overflow-hidden rounded-xl">
                <div className="flex items-center gap-1 pr-2">
                  <button type="button" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : w.id)} className="flex min-w-0 flex-1 items-center gap-3 p-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
                    <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform duration-300", isOpen && "rotate-180")} />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">
                        {w.title} <span className="font-normal text-muted-foreground">· {formatDate(w.workout_date, "medium")}</span>
                      </span>
                      <span className="block truncate text-[11px] text-muted-foreground">
                        {[`${w.summary.length} esercizi`, `${w.total_sets} serie`, Number(w.total_volume) > 0 ? `${formatNumber(Number(w.total_volume) / 1000, 1)} t` : null, w.duration_min ? `${w.duration_min} min` : null, w.session_rpe ? `RPE ${formatNumber(w.session_rpe, 1)}` : null]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>
                  </button>
                  <Button variant="ghost" size="icon" className="size-8 rounded-lg" aria-label="Modifica sessione" onClick={() => onEdit(w)}>
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="size-8 rounded-lg text-danger hover:text-danger" aria-label="Elimina sessione" onClick={() => setToDelete(w)}>
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
                {isOpen && <WorkoutDetail workout={w} />}
              </li>
            )
          })}
        </ul>
      )}
      {workouts.length > limit && (
        <Button variant="ghost" size="sm" className="mt-3 w-full rounded-lg text-muted-foreground" onClick={() => setLimit((l) => l + 30)}>
          Mostra altre
        </Button>
      )}

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Eliminare la sessione?"
        description={toDelete ? `${toDelete.title} del ${formatDate(toDelete.workout_date, "long")} e tutte le sue serie.` : ""}
        pending={del.isPending}
        onConfirm={async () => {
          if (!toDelete) return
          try {
            await del.mutateAsync(toDelete.id)
            setToDelete(null)
            toast.success("Sessione eliminata")
          } catch (e) {
            toast.error("Eliminazione non riuscita", { description: e instanceof Error ? e.message : undefined })
          }
        }}
      />
    </GlassCard>
  )
}

function WorkoutDetail({ workout }: { workout: WorkoutSummary }) {
  const q = useWorkoutDetail(workout.id)
  if (q.isPending) {
    return (
      <div className="flex justify-center border-t p-3">
        <LoaderCircle className="size-4 animate-spin text-muted-foreground" />
      </div>
    )
  }
  const ex = q.data?.exercises ?? []
  return (
    <ul className="animate-page-in space-y-1.5 border-t px-3 py-2 text-xs">
      {ex.map((e, i) => (
        <li key={`${e.c}-${i}`} className="flex justify-between gap-3">
          <span className="truncate"><Emoji e={exerciseEmoji(e.c, e.n)} className="mr-1" />{e.n}</span>
          <span className="text-right tabular text-muted-foreground">
            {e.m
              ? `${formatNumber(e.m, 0)} min`
              : (e.s ?? []).map((s, j) => (
                  <span key={j} className={cn("ml-1.5 inline-block", s[3] === 1 && "text-warn/80", s[3] >= 2 && "text-bia")} title={SET_TYPE_LABELS[s[3]]}>
                    {s[1] ? `${formatNumber(s[1], 1)}×` : ""}
                    {s[0]}
                  </span>
                ))}
          </span>
        </li>
      ))}
      {workout.notes && <li className="pt-1 italic text-muted-foreground">{workout.notes}</li>}
    </ul>
  )
}
