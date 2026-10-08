"use client"

import { useQueryClient } from "@tanstack/react-query"
import { useEffect } from "react"

import { clearLocalData, restoreCache, saveCache } from "@/lib/local-cache"
import { createClient } from "@/lib/supabase/client"
import { useUiStore } from "@/stores/ui-store"

/** Utente a cui appartengono i dati nella cache in memoria (stessa scheda del browser). */
let cacheOwner: string | null = null
/** sessione chiusa (anche da un'altra scheda): niente più salvataggi finché non si rientra */
let signedOut = false

/**
 * Da chiamare all'inizio della shell (prima che le pagine leggano la cache):
 * con un cambio di account senza logout esplicito (sessione scaduta, altro
 * utente sullo stesso browser) i dati del precedente vengono scartati.
 */
export function useCacheOwner(userId: string) {
  const qc = useQueryClient()
  if (signedOut) return
  if (cacheOwner !== userId) {
    if (cacheOwner !== null) qc.clear()
    cacheOwner = userId
  }
}

/** Collega la cache di TanStack Query a localStorage (vedi lib/local-cache). */
export function QueryPersistence({ userId }: { userId: string }) {
  const qc = useQueryClient()
  const enabled = useUiStore((s) => s.offlineCache)

  // logout da un'altra scheda o sessione revocata: si svuota anche qui e si smette di salvare
  useEffect(() => {
    const { data } = createClient().auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        signedOut = true
        cacheOwner = null
        clearLocalData(qc)
        // uscita fatta in un'altra scheda: anche questa torna al login
        if (!window.location.pathname.startsWith("/login")) window.location.replace("/login")
      } else if (event === "SIGNED_IN") {
        signedOut = false
      }
    })
    return () => data.subscription.unsubscribe()
  }, [qc])

  useEffect(() => {
    if (!enabled) return
    restoreCache(qc, userId)
    let timer: ReturnType<typeof setTimeout> | undefined
    const unsub = qc.getQueryCache().subscribe((e) => {
      if (e.type !== "updated" || e.action.type !== "success") return
      clearTimeout(timer)
      timer = setTimeout(() => cacheOwner === userId && saveCache(qc, userId), 1500)
    })
    const onHide = () => {
      if (document.visibilityState === "hidden" && cacheOwner === userId) saveCache(qc, userId)
    }
    document.addEventListener("visibilitychange", onHide)
    return () => {
      unsub()
      clearTimeout(timer)
      document.removeEventListener("visibilitychange", onHide)
    }
  }, [qc, userId, enabled])

  return null
}
