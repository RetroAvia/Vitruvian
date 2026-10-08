"use client"

import { useOnline } from "@/lib/use-online"

import { useRecentWorkoutDetails } from "../api/training"
import { WorkoutPlayer } from "../components/workout-player"
import { useTraining } from "../hooks/use-training"
import { useWorkoutSession } from "./workout-session"

/** Collega il registro ai dati (caricato solo alla prima apertura: zero costo altrove). */
export function WorkoutContainer({ userId }: { userId: string }) {
  const open = useWorkoutSession((s) => s.open)
  const request = useWorkoutSession((s) => s.request)
  const close = useWorkoutSession((s) => s.close)
  const online = useOnline()
  const { report, workouts, isPending } = useTraining()
  const recentQ = useRecentWorkoutDetails()

  // "oggi": giorno previsto; nei giorni di riposo il prossimo in programma; fatto → sessione libera
  const today = report?.today
  const day =
    request.kind === "day" ? request.day : request.kind === "today" && today && !today.doneToday ? (today.rest ? (today.next ?? null) : today.day) : null
  // offline le richieste restano in pausa: si parte con quello che c'è in cache
  const ready = !online || (!isPending && !recentQ.isPending)

  return (
    <WorkoutPlayer
      userId={userId}
      open={open}
      onOpenChange={(o) => !o && close()}
      ready={ready}
      day={day}
      editId={request.kind === "edit" ? request.id : null}
      repeatId={request.kind === "repeat" ? request.id : null}
      recent={recentQ.data ?? []}
      summaries={workouts}
    />
  )
}
