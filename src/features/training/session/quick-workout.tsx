"use client"

import { BedDouble, CheckCircle2, ChevronDown, Dumbbell, Play, Repeat2, Sparkles } from "lucide-react"

import { useSessionUser } from "@/components/layout/session-user-context"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { relativeDay } from "@/lib/format"
import { playSound } from "@/lib/sound"
import { cn } from "@/lib/utils"

import { estimateMinutes } from "../engine/analysis"
import { useTraining } from "../hooks/use-training"
import { useLocalWorkoutState, useWorkoutSession, type WorkoutRequest } from "./workout-session"

/**
 * Avvio rapido dell'allenamento (dashboard): un tocco per la seduta di oggi,
 * menu per scegliere un altro giorno, una sessione libera o ripetere l'ultima.
 */
export function QuickWorkoutCard({ className }: { className?: string }) {
  const user = useSessionUser()
  const start = useWorkoutSession((s) => s.start)
  const playerOpen = useWorkoutSession((s) => s.open)
  const { draft } = useLocalWorkoutState(user.id, playerOpen)
  const { report, workouts } = useTraining()

  const t = report?.today
  const tree = report?.tree ?? null
  const target = t ? (t.doneToday ? null : t.rest ? t.next : t.day) : null
  const lastWorkout = workouts[0] ?? null

  const go = (req?: WorkoutRequest) => {
    playSound("tap")
    start(req)
  }

  const title = draft ? draft.title : target ? target.label : t?.doneToday ? `${t.doneToday.title} completato` : "Sessione libera"
  const detail = draft
    ? `In corso · ${draft.done}/${draft.total} serie`
    : target
      ? `${t?.rest ? "Oggi è riposo · prossimo giorno · " : ""}${target.exercises.length} esercizi · circa ${estimateMinutes(target)} min`
      : t?.doneToday
        ? `${t.doneToday.total_sets} serie registrate oggi`
        : tree
          ? "Allenati liberamente: registro, timer e progressi"
          : "Nessuna scheda attiva: parti libero o creane una"
  const Icon = draft ? Dumbbell : t?.doneToday ? CheckCircle2 : t?.rest ? BedDouble : Dumbbell

  return (
    <div className={cn("glass-raised relative flex items-center gap-3 overflow-hidden rounded-2xl border p-3 sm:p-4", className)}>
      <div aria-hidden className="absolute -left-10 -top-12 size-36 rounded-full bg-neon/10 blur-2xl" />
      <span className={cn("relative grid size-11 shrink-0 place-items-center rounded-xl", t?.doneToday && !draft ? "bg-gain/15 text-gain" : "bg-neon/15 text-neon")}>
        <Icon className="size-5" />
      </span>
      <div className="relative min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-neon/90">Allenamento rapido</p>
        <p className="truncate text-sm font-semibold sm:text-base">{title}</p>
        <p className="truncate text-xs text-muted-foreground">{detail}</p>
      </div>
      <div className="relative flex shrink-0 items-center">
        <Button className="h-11 rounded-xl rounded-r-none px-4 shadow-[0_6px_20px_-8px_var(--neon)]" onClick={() => go(draft || target ? { kind: "today" } : { kind: "day", day: null })}>
          <Play className="size-4" />
          <span className="hidden sm:inline">{draft ? "Riprendi" : "Inizia"}</span>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className="h-11 rounded-xl rounded-l-none border-l border-background/30 px-2" aria-label="Altre opzioni di allenamento" disabled={Boolean(draft)}>
              <ChevronDown className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            {tree && tree.days.length > 0 && (
              <>
                <DropdownMenuLabel>{tree.plan.name}</DropdownMenuLabel>
                {tree.days.map((d) => (
                  <DropdownMenuItem key={d.id} onSelect={() => go({ kind: "day", day: d })}>
                    <Dumbbell className="size-4" />
                    <span className="min-w-0 flex-1 truncate">{d.label}</span>
                    <span className="text-[11px] text-muted-foreground">{d.exercises.length} es.</span>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
              </>
            )}
            {lastWorkout && (
              <DropdownMenuItem onSelect={() => go({ kind: "repeat", id: lastWorkout.id, title: lastWorkout.title })}>
                <Repeat2 className="size-4" />
                <span className="min-w-0 flex-1 truncate">Ripeti “{lastWorkout.title}”</span>
                <span className="text-[11px] text-muted-foreground">{relativeDay(lastWorkout.workout_date)}</span>
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onSelect={() => go({ kind: "day", day: null })}>
              <Sparkles className="size-4" /> Sessione libera
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
