"use client"

import { BedDouble, CheckCircle2, ChevronRight, Flame, Pencil, Play, Plus, Repeat2, Trophy } from "lucide-react"

import { MuscleFigure } from "@/components/body/muscle-figure"
import { GlassCard } from "@/components/shared/glass-card"
import { InsightList } from "@/components/shared/insight-list"
import { Button } from "@/components/ui/button"
import { Emoji } from "@/components/shared/emoji"
import { formatDate, formatNumber, relativeDay, shiftISO, todayISO } from "@/lib/format"
import { cn } from "@/lib/utils"

import { estimateMinutes, exerciseEmoji, isoWeekday, lastPerformance, resolveExercise, setsLabel } from "../engine/analysis"
import type { TrainingReport } from "../engine/report"
import { TECHNIQUES } from "../engine/techniques"
import type { TrainingDay, WorkoutSummary } from "../types"

const DOW_SHORT = ["L", "M", "M", "G", "V", "S", "D"]

type Report = TrainingReport

export function TodayPanel({
  report,
  workouts,
  draft,
  onStart,
  onEdit,
  onRepeat,
  onShowHistory,
  onShowAnalysis,
}: {
  report: Report
  workouts: WorkoutSummary[]
  draft: boolean
  onStart: (d: TrainingDay | null) => void
  onEdit: (w: WorkoutSummary) => void
  onRepeat: (w: WorkoutSummary) => void
  onShowHistory: () => void
  onShowAnalysis: () => void
}) {
  const t = report.today
  const target = t.doneToday ? null : t.rest ? t.next : t.day

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        {/* Seduta di oggi */}
        <GlassCard raised className="relative overflow-hidden p-5">
          <div aria-hidden className="absolute -right-16 -top-16 size-48 rounded-full bg-neon/15 blur-3xl" />
          <div className="relative flex flex-wrap items-center gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neon/90">{t.doneToday ? "Oggi · fatto" : t.rest ? "Oggi · riposo" : "Oggi"}</p>
            {draft && <span className="rounded-full bg-gain/15 px-2 py-0.5 text-[11px] font-medium text-gain">sessione in corso</span>}
          </div>

          {t.doneToday && (
            <div className="relative mt-2">
              <p className="flex items-center gap-2 text-xl font-semibold">
                <CheckCircle2 className="size-5 text-gain" /> {t.doneToday.title} completato
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {t.doneToday.total_sets} serie{t.doneToday.duration_min ? ` in ${t.doneToday.duration_min} minuti` : ""}. Ora recupero: proteine, sonno, idratazione.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button variant="outline" size="sm" className="rounded-lg" onClick={() => t.doneToday && onEdit(t.doneToday)}>
                  <Pencil className="size-3.5" /> Modifica
                </Button>
                <Button variant="ghost" size="sm" className="rounded-lg" onClick={() => onStart(null)}>
                  <Plus className="size-3.5" /> Altra sessione
                </Button>
              </div>
            </div>
          )}

          {!t.doneToday && !target && (
            <div className="relative mt-2">
              <p className="flex items-center gap-2 text-xl font-semibold">
                <BedDouble className="size-5 text-bia" /> Sessione libera
              </p>
              <p className="mt-1 text-sm text-muted-foreground">Nessuna scheda attiva: allenati liberamente, l&apos;app tiene traccia di carichi e progressi.</p>
              <Button className="mt-4 h-11 w-full rounded-xl sm:w-auto" onClick={() => onStart(null)}>
                <Play className="size-4" /> {draft ? "Riprendi" : "Inizia"}
              </Button>
            </div>
          )}

          {target && (
            <div className="relative mt-1">
              {t.rest && <p className="text-xs text-muted-foreground">Giorno di riposo: se ti alleni comunque, il prossimo in programma è</p>}
              <p className="text-xl font-semibold">{target.label}</p>
              <p className="text-sm text-muted-foreground">
                {target.focus ? `${target.focus} · ` : ""}
                {target.exercises.length} esercizi · {target.exercises.reduce((n, e) => n + (e.sets ?? 0), 0)} serie · circa {estimateMinutes(target)} min
              </p>
              <ol className="mt-3 divide-y divide-border/60 overflow-hidden rounded-xl border bg-background/30">
                {target.exercises.map((e, i) => {
                  const r = resolveExercise(e.exercise_code, e.name, e)
                  const last = r.pattern === "cardio" ? null : lastPerformance(r.code, [], workouts)
                  const top = last?.sets[0]
                  return (
                    <li key={e.id} className="flex items-center gap-2.5 px-2.5 py-2">
                      <span className="w-4 shrink-0 text-center text-[11px] text-muted-foreground tabular">{i + 1}</span>
                      <span className="h-8 w-4 shrink-0">
                        <MuscleFigure primary={r.primary} secondary={r.secondary} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm"><Emoji e={exerciseEmoji(e.exercise_code, e.name, e)} className="mr-1" />{e.name}</span>
                        {(e.technique !== "straight" || top) && (
                          <span className="block truncate text-[10px] text-muted-foreground">
                            {e.technique !== "straight" && <span className="text-bia">{TECHNIQUES[e.technique].short}</span>}
                            {e.technique !== "straight" && top && " · "}
                            {top && `ultima: ${top[1] ? `${formatNumber(top[1], top[1] % 1 ? 1 : 0)} kg × ` : ""}${top[0]}`}
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground tabular">
                        {r.pattern === "cardio" ? `${formatNumber(e.duration_min, 0)} min` : setsLabel(e)}
                      </span>
                    </li>
                  )
                })}
              </ol>
              <Button className="mt-4 h-12 w-full rounded-xl shadow-[0_6px_20px_-8px_var(--neon)] sm:w-auto sm:px-6" onClick={() => onStart(target)}>
                <Play className="size-4" /> {draft ? "Riprendi l'allenamento" : "Inizia l'allenamento"}
              </Button>
            </div>
          )}
        </GlassCard>

        <WeekCard report={report} workouts={workouts} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <GlassCard className="p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">Ultime sessioni</h3>
            <Button variant="ghost" size="sm" className="h-8 rounded-lg text-xs" onClick={onShowHistory}>
              Storico <ChevronRight className="size-3.5" />
            </Button>
          </div>
          {workouts.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">Nessuna sessione registrata.</p>
          ) : (
            <ul className="space-y-1.5">
              {workouts.slice(0, 4).map((w) => (
                <li key={w.id} className="flex items-center gap-3 rounded-xl surface-inset px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{w.title}</p>
                    <p className="text-[11px] text-muted-foreground tabular">
                      {relativeDay(w.workout_date)} · {w.total_sets} serie
                      {w.total_volume ? ` · ${formatNumber(Number(w.total_volume) / 1000, 1)} t` : ""}
                      {w.duration_min ? ` · ${w.duration_min} min` : ""}
                    </p>
                  </div>
                  <Button variant="ghost" size="icon" className="size-9 rounded-lg" aria-label={`Ripeti ${w.title}`} title="Ripeti questa sessione" onClick={() => onRepeat(w)}>
                    <Repeat2 className="size-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="size-9 rounded-lg" aria-label={`Modifica ${w.title}`} title="Modifica" onClick={() => onEdit(w)}>
                    <Pencil className="size-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </GlassCard>

        <GlassCard className="p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">Consigli</h3>
            {report.insights.length > 3 && (
              <Button variant="ghost" size="sm" className="h-8 rounded-lg text-xs" onClick={onShowAnalysis}>
                Tutti ({report.insights.length}) <ChevronRight className="size-3.5" />
              </Button>
            )}
          </div>
          <InsightList insights={report.insights.slice(0, 3)} />
        </GlassCard>
      </div>
    </>
  )
}

/** Settimana in corso + numeri chiave + andamento delle ultime 12 settimane, in un'unica card. */
function WeekCard({ report, workouts }: { report: Report; workouts: WorkoutSummary[] }) {
  const today = todayISO()
  const monday = shiftISO(today, -(isoWeekday(today) - 1))
  const done = new Set(workouts.filter((w) => w.workout_date >= monday).map((w) => w.workout_date))
  const planned = new Set((report.tree?.days ?? []).map((d) => d.day_of_week).filter(Boolean) as number[])
  const plannedPerWeek = report.plan?.sessionsPerWeek ?? null
  const weekDone = done.size
  const weekMax = Math.max(...report.logged.weekly.map((w) => w.sessions), plannedPerWeek ?? 0, 1)

  const stats: Array<{ label: string; value: string; hint?: string; tone?: string; icon?: typeof Flame }> = [
    { label: "a settimana", value: formatNumber(report.logged.sessionsPerWeek, 1), hint: plannedPerWeek ? `su ${plannedPerWeek}` : undefined },
    { label: "costanza", value: report.adherence === null ? "—" : `${report.adherence}%`, tone: report.adherence !== null && report.adherence < 70 ? "text-warn" : undefined },
    { label: "settimane di fila", value: String(report.streak), icon: Flame },
    { label: "record 30 gg", value: String(report.prs.length), icon: Trophy },
  ]

  return (
    <GlassCard className="flex flex-col p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold">Questa settimana</h3>
        <p className="text-xs text-muted-foreground tabular">
          {weekDone}
          {plannedPerWeek ? `/${plannedPerWeek}` : ""} sessioni
        </p>
      </div>
      <div className="mt-3 grid grid-cols-7 gap-1.5">
        {DOW_SHORT.map((label, i) => {
          const date = shiftISO(monday, i)
          const isToday = date === today
          const isDone = done.has(date)
          const isPlanned = planned.has(i + 1)
          return (
            <div key={date} className="flex flex-col items-center gap-1">
              <span className={cn("text-[10px] font-medium", isToday ? "text-neon" : "text-muted-foreground")}>{label}</span>
              <span
                className={cn(
                  "grid size-8 place-items-center rounded-full text-[11px] tabular ring-1 ring-inset",
                  isDone ? "bg-gain text-background ring-gain" : isPlanned ? (date < today ? "ring-warn/50 text-warn" : "ring-neon/40 text-foreground") : "ring-border text-muted-foreground",
                  isToday && !isDone && "ring-2 ring-neon",
                )}
                title={isDone ? "Allenamento fatto" : isPlanned ? "In programma" : "Riposo"}
              >
                {isDone ? <CheckCircle2 className="size-4" /> : Number(date.slice(8))}
              </span>
            </div>
          )
        })}
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border/60">
        {stats.map((s) => {
          const Icon = s.icon
          return (
            <div key={s.label} className="bg-card/80 px-3 py-2.5">
              <dt className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                {Icon && <Icon className="size-3" />} {s.label}
              </dt>
              <dd className={cn("font-display text-lg font-semibold tabular", s.tone)}>
                {s.value}
                {s.hint && <span className="ml-1 text-xs font-normal text-muted-foreground">{s.hint}</span>}
              </dd>
            </div>
          )
        })}
      </dl>

      <div className="mt-auto flex items-end gap-1 pt-4" aria-label="Sessioni nelle ultime 12 settimane">
        {report.logged.weekly.map((w) => (
          <div key={w.start} className="flex h-14 flex-1 items-end overflow-hidden rounded-[4px] bg-muted/40" title={`Settimana dal ${formatDate(w.start, "medium")}: ${w.sessions} sessioni, ${w.sets} serie`}>
            <div className={cn("w-full rounded-[4px]", plannedPerWeek && w.sessions >= plannedPerWeek ? "bg-gain" : w.sessions > 0 ? "bg-neon" : "")} style={{ height: `${(w.sessions / weekMax) * 100}%` }} />
          </div>
        ))}
      </div>
      <p className="mt-1.5 text-[10px] text-muted-foreground">Ultime 12 settimane{plannedPerWeek ? ` · verde = obiettivo raggiunto` : ""}</p>
    </GlassCard>
  )
}
