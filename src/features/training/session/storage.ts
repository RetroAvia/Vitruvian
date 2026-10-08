/**
 * Salvataggi locali dell'allenamento, separati per utente (più account sullo
 * stesso telefono non si mescolano):
 *  - bozza della sessione in corso: scritta a ogni modifica, sopravvive a
 *    chiusure accidentali, riavvii del telefono e assenza di rete;
 *  - coda d'uscita ("outbox"): sessioni concluse senza connessione, inviate
 *    al server appena la rete torna disponibile.
 * Ogni modifica emette l'evento DRAFT_EVENT per aggiornare l'interfaccia.
 */
import type { WorkoutPayload } from "../types"

export const DRAFT_EVENT = "vitruvian:workout-storage"

const draftKey = (userId: string) => `vitruvian-workout-draft-v3:${userId}`
/** modifica di una sessione già salvata: chiave separata, non tocca l'allenamento in corso */
const editKey = (userId: string) => `vitruvian-workout-edit-v3:${userId}`
const outboxKey = (userId: string) => `vitruvian-outbox-v1:${userId}`
const LEGACY_KEYS = ["vitruvian-workout-draft", "vitruvian-workout-draft-v2"]

function emit() {
  try {
    window.dispatchEvent(new Event(DRAFT_EVENT))
  } catch {
    /* SSR */
  }
}

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function write(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

/* --------------------------------- Bozza --------------------------------- */

/** Bozza grezza (la forma è validata dal registro). `edit` = bozza di modifica. */
export function readDraftRaw(userId: string, edit = false): unknown {
  try {
    // bozze delle versioni precedenti, non legate a un utente: scartate
    for (const k of LEGACY_KEYS) localStorage.removeItem(k)
  } catch {
    /* ignore */
  }
  return read<unknown>(edit ? editKey(userId) : draftKey(userId))
}

/** Scrive (o cancella con null) la bozza; false se lo spazio del browser è pieno. */
export function writeDraftRaw(userId: string, draft: unknown, edit = false) {
  const ok = write(edit ? editKey(userId) : draftKey(userId), draft)
  if (!edit) emit()
  return ok
}

export interface DraftInfo {
  title: string
  startedAt: number
  done: number
  total: number
  editing: boolean
}

/** Riepilogo leggero della bozza (per la pillola "allenamento in corso"). */
export function draftInfo(userId: string): DraftInfo | null {
  const d = read<{ title?: string; startedAt?: number; id?: string | null; exercises?: Array<{ sets?: Array<{ done?: boolean }> }> }>(draftKey(userId))
  if (!d || !Array.isArray(d.exercises)) return null
  let done = 0
  let total = 0
  for (const e of d.exercises) for (const s of e.sets ?? []) {
    total++
    if (s.done) done++
  }
  return { title: d.title || "Allenamento", startedAt: d.startedAt ?? Date.now(), done, total, editing: Boolean(d.id) }
}

/* -------------------------------- Outbox -------------------------------- */

export interface OutboxItem {
  /** id della sessione (generato sul telefono: l'invio ripetuto non crea doppioni) */
  id: string
  payload: WorkoutPayload
  queuedAt: number
  attempts: number
  lastError?: string
  /** rifiutata dal server (dati non validi): non si ritenta da sola */
  failed?: boolean
}

export function readOutbox(userId: string): OutboxItem[] {
  const list = read<OutboxItem[]>(outboxKey(userId))
  return Array.isArray(list) ? list : []
}

export function queueWorkout(userId: string, payload: WorkoutPayload & { id: string }): boolean {
  const list = readOutbox(userId).filter((x) => x.id !== payload.id)
  list.push({ id: payload.id, payload, queuedAt: Date.now(), attempts: 0 })
  const ok = write(outboxKey(userId), list)
  emit()
  return ok
}

export function updateOutbox(userId: string, fn: (list: OutboxItem[]) => OutboxItem[]) {
  write(outboxKey(userId), fn(readOutbox(userId)))
  emit()
}

/** Rimuove bozze e code di TUTTI gli utenti (logout). */
export function clearTrainingStorage() {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i)
      if (k && (k.startsWith("vitruvian-workout-draft") || k.startsWith("vitruvian-outbox-"))) localStorage.removeItem(k)
    }
  } catch {
    /* ignore */
  }
  emit()
}

/** Errore di rete (nessuna risposta dal server) → la sessione va in coda, non persa. */
export function isNetworkError(e: unknown): boolean {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true
  const msg = e instanceof Error ? e.message : typeof e === "string" ? e : ""
  return /failed to fetch|fetch failed|networkerror|network request failed|load failed|timeout|aborted/i.test(msg)
}

export function newId(): string {
  try {
    return crypto.randomUUID()
  } catch {
    // fallback RFC 4122 v4
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0
      return (c === "x" ? r : (r & 0x3) | 0x8).toString(16)
    })
  }
}
