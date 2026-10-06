"use client"

/**
 * Cache locale della sessione (avvio istantaneo).
 * Salva in localStorage lo stato delle query riuscite, legato all'utente e
 * valido 24 ore; al riavvio i dati compaiono subito mentre arrivano quelli
 * aggiornati dal server. Cancellata al logout e alla disconnessione automatica.
 */
import { dehydrate, hydrate, type QueryClient } from "@tanstack/react-query"

const KEY = "vitruvian-cache-v1"
const MAX_AGE_MS = 24 * 60 * 60 * 1000

interface Stored {
  userId: string
  savedAt: number
  state: ReturnType<typeof dehydrate>
}

export function restoreCache(qc: QueryClient, userId: string) {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return
    const s = JSON.parse(raw) as Stored
    if (s.userId !== userId || Date.now() - s.savedAt > MAX_AGE_MS) {
      localStorage.removeItem(KEY)
      return
    }
    hydrate(qc, s.state)
  } catch {
    /* cache corrotta o storage non disponibile: si ignora */
  }
}

export function saveCache(qc: QueryClient, userId: string) {
  try {
    const state = dehydrate(qc, { shouldDehydrateQuery: (q) => q.state.status === "success" })
    localStorage.setItem(KEY, JSON.stringify({ userId, savedAt: Date.now(), state } satisfies Stored))
  } catch {
    /* quota piena o storage bloccato: nessun problema, si lavora solo online */
  }
}

/** Rimuove i dati sanitari dal dispositivo (logout, uscita automatica, opzione disattivata). */
export function clearLocalData(qc?: QueryClient) {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
  qc?.clear()
}
