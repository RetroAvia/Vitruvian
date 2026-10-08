"use client"

/**
 * Sessione di allenamento globale: il registro vive nella shell dell'app, quindi
 * si può avviare da qualsiasi pagina (dashboard, ricerca rapida, allenamento) e
 * resta attivo cambiando pagina.
 */
import { useEffect, useState } from "react"
import { create } from "zustand"

import type { TrainingDay } from "../types"
import { DRAFT_EVENT, draftInfo, readOutbox, type DraftInfo, type OutboxItem } from "./storage"

export type WorkoutRequest =
  /** giorno previsto oggi dalla scheda attiva (o sessione libera) */
  | { kind: "today" }
  /** giorno specifico (null = sessione libera) */
  | { kind: "day"; day: TrainingDay | null }
  /** ripete una sessione passata con gli stessi esercizi e carichi */
  | { kind: "repeat"; id: string; title: string }
  /** modifica una sessione salvata */
  | { kind: "edit"; id: string }

interface WorkoutSessionState {
  open: boolean
  request: WorkoutRequest
  /** avvia o riprende (se c'è una bozza in corso viene sempre ripresa) */
  start: (request?: WorkoutRequest) => void
  close: () => void
}

export const useWorkoutSession = create<WorkoutSessionState>()((set) => ({
  open: false,
  request: { kind: "today" },
  start: (request = { kind: "today" }) => set({ open: true, request }),
  close: () => set({ open: false }),
}))

/** Stato reattivo della bozza e della coda offline dell'utente. */
export function useLocalWorkoutState(userId: string, paused = false): { draft: DraftInfo | null; outbox: OutboxItem[] } {
  const [state, setState] = useState<{ draft: DraftInfo | null; outbox: OutboxItem[] }>({ draft: null, outbox: [] })
  useEffect(() => {
    // con il registro aperto la bozza cambia a ogni tocco: niente letture inutili
    if (paused) return
    const refresh = () => {
      const next = { draft: draftInfo(userId), outbox: readOutbox(userId) }
      // nuovo stato solo se cambia davvero (evita ridisegni inutili)
      setState((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next))
    }
    refresh()
    const onStorage = (e: StorageEvent) => {
      if (!e.key || e.key.includes(userId)) refresh()
    }
    window.addEventListener(DRAFT_EVENT, refresh)
    window.addEventListener("storage", onStorage)
    return () => {
      window.removeEventListener(DRAFT_EVENT, refresh)
      window.removeEventListener("storage", onStorage)
    }
  }, [userId, paused])
  return state
}
