"use client"

import { onlineManager, useQueryClient } from "@tanstack/react-query"
import { useEffect, useRef } from "react"
import { toast } from "sonner"

import { queryKeys } from "@/lib/query-keys"

import { sendWorkout } from "./send"
import { isNetworkError, readOutbox, updateOutbox } from "./storage"

export const OUTBOX_RETRY_EVENT = "vitruvian:outbox-retry"

/** Nuovo tentativo manuale anche per le sessioni rifiutate. */
export function retryOutbox(userId: string) {
  updateOutbox(userId, (l) => l.map((x) => ({ ...x, failed: false })))
  window.dispatchEvent(new Event(OUTBOX_RETRY_EVENT))
}

/**
 * Sincronizza le sessioni concluse offline: all'avvio, al ritorno della rete e
 * quando l'app torna in primo piano. Nessun timer attivo se la coda è vuota.
 */
export function OutboxSync({ userId }: { userId: string }) {
  const qc = useQueryClient()
  const running = useRef(false)

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined

    async function flush() {
      if (running.current || (typeof navigator !== "undefined" && navigator.onLine === false)) return
      const items = readOutbox(userId).filter((x) => !x.failed)
      if (items.length === 0) return
      running.current = true
      let sent = 0
      let pending = false
      for (const item of items) {
        try {
          await sendWorkout(item.payload)
          updateOutbox(userId, (l) => l.filter((x) => x.id !== item.id))
          sent++
        } catch (e) {
          const network = isNetworkError(e)
          pending = pending || network
          updateOutbox(userId, (l) => l.map((x) => (x.id === item.id ? { ...x, attempts: x.attempts + 1, failed: !network, lastError: e instanceof Error ? e.message : String(e) } : x)))
          if (network) break
          toast.error(`"${item.payload.title}" non è stata accettata dal server`, { description: e instanceof Error ? e.message : undefined, duration: 10_000 })
        }
      }
      running.current = false
      if (sent > 0) {
        toast.success(sent === 1 ? "Sessione offline sincronizzata" : `${sent} sessioni offline sincronizzate`)
        void Promise.all([
          qc.invalidateQueries({ queryKey: queryKeys.training.workouts }),
          qc.invalidateQueries({ queryKey: queryKeys.training.recent }),
        ])
      }
      // rete instabile: nuovo tentativo tra un minuto
      if (pending) {
        clearTimeout(timer)
        timer = setTimeout(() => void flush(), 60_000)
      }
    }

    void flush()
    const onVisible = () => document.visibilityState === "visible" && void flush()
    const unsub = onlineManager.subscribe((online) => online && void flush())
    window.addEventListener("online", flush)
    window.addEventListener(OUTBOX_RETRY_EVENT, flush)
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      window.removeEventListener(OUTBOX_RETRY_EVENT, flush)
      clearTimeout(timer)
      unsub()
      window.removeEventListener("online", flush)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [userId, qc])

  return null
}
