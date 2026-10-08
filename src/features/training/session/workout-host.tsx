"use client"

import { CloudOff, Dumbbell, Play, TriangleAlert } from "lucide-react"
import dynamic from "next/dynamic"
import { useEffect, useState } from "react"

import { cn } from "@/lib/utils"

import { retryOutbox } from "./outbox-sync"
import { updateOutbox } from "./storage"
import { useLocalWorkoutState, useWorkoutSession } from "./workout-session"

const loadContainer = () => import("./workout-container")
const WorkoutContainer = dynamic(() => loadContainer().then((m) => m.WorkoutContainer), { ssr: false })

/**
 * Registro allenamento sempre disponibile + pillola "allenamento in corso".
 * Il codice del registro si scarica a pagina ferma (inattività del browser):
 * non pesa sull'avvio ma è già in cache se poi si va offline in palestra.
 */
export function WorkoutHost({ userId }: { userId: string }) {
  const open = useWorkoutSession((s) => s.open)
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    if (open) setMounted(true)
  }, [open])
  useEffect(() => {
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void }
    if (w.requestIdleCallback) {
      const id = w.requestIdleCallback(() => void loadContainer().catch(() => {}), { timeout: 8000 })
      return () => w.cancelIdleCallback?.(id)
    }
    const t = setTimeout(() => void loadContainer().catch(() => {}), 4000)
    return () => clearTimeout(t)
  }, [])

  return (
    <>
      {mounted && <WorkoutContainer userId={userId} />}
      <ActiveWorkoutPill userId={userId} hidden={open} />
    </>
  )
}

function ActiveWorkoutPill({ userId, hidden }: { userId: string; hidden: boolean }) {
  const start = useWorkoutSession((s) => s.start)
  const { draft, outbox } = useLocalWorkoutState(userId, hidden)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const visible = !hidden && (Boolean(draft) || outbox.length > 0)
  // spazio in fondo alla pagina: la pillola non copre l'ultimo contenuto
  useEffect(() => {
    if (!visible) return
    document.documentElement.dataset.workoutPill = "1"
    return () => {
      delete document.documentElement.dataset.workoutPill
    }
  }, [visible])
  if (!visible) return null
  const failed = outbox.filter((x) => x.failed)

  const base =
    "no-print fixed right-3 z-40 flex items-center gap-2.5 rounded-2xl border shadow-[var(--shadow-raised)] glass-strong animate-page-in bottom-[calc(5.75rem+env(safe-area-inset-bottom))] lg:bottom-6 lg:right-6"

  if (failed.length > 0) {
    const f = failed[0] as (typeof failed)[number]
    return (
      <div role="alert" className={cn(base, "left-3 flex-wrap p-3 text-xs sm:left-auto sm:max-w-sm")}>
        <TriangleAlert className="size-4 shrink-0 text-danger" />
        <p className="min-w-0 flex-1">
          <span className="font-semibold">“{f.payload.title}” non sincronizzata</span>
          <span className="block truncate text-muted-foreground">{f.lastError ?? "Il server ha rifiutato i dati"}</span>
        </p>
        <div className="flex gap-1.5">
          <button type="button" onClick={() => retryOutbox(userId)} className="rounded-lg bg-neon px-2.5 py-1.5 font-semibold text-background">
            Riprova
          </button>
          <button
            type="button"
            onClick={() => {
              if (!confirmDiscard) return setConfirmDiscard(true)
              updateOutbox(userId, (l) => l.filter((x) => x.id !== f.id))
              setConfirmDiscard(false)
            }}
            className="rounded-lg px-2.5 py-1.5 font-medium text-danger ring-1 ring-inset ring-danger/40"
          >
            {confirmDiscard ? "Conferma" : "Scarta"}
          </button>
        </div>
      </div>
    )
  }

  if (!draft) {
    return (
      <div role="status" className={cn(base, "px-3 py-2 text-xs text-bia")}>
        <CloudOff className="size-4" />
        {outbox.length === 1 ? "1 sessione" : `${outbox.length} sessioni`} da sincronizzare
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => start()}
      className={cn(base, "left-3 p-2 pr-3 text-left transition-transform active:scale-[0.98] sm:left-auto sm:min-w-72")}
      aria-label={`Riprendi l'allenamento ${draft.title}`}
    >
      <span className="relative grid size-10 shrink-0 place-items-center rounded-xl bg-neon/15 text-neon">
        <Dumbbell className="size-5" />
        <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-gain ring-2 ring-background motion-safe:animate-pulse" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{draft.editing ? "Modifica in corso" : draft.title}</span>
        <span className="block text-xs text-muted-foreground">
          {!draft.editing && <><Minutes since={draft.startedAt} /> · </>}{draft.done}/{draft.total} serie
          {outbox.length > 0 && <span className="text-bia"> · {outbox.length} da sincronizzare</span>}
        </span>
      </span>
      <span className="flex h-9 items-center gap-1 rounded-xl bg-neon px-3 text-xs font-semibold text-background">
        <Play className="size-3.5" /> Riprendi
      </span>
    </button>
  )
}

/** Minuti trascorsi, aggiornati ogni 30 secondi (niente timer al secondo in background). */
function Minutes({ since }: { since: number }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [])
  const m = Math.max(0, Math.floor((now - since) / 60_000))
  return <span className="tabular">{m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`}</span>
}
