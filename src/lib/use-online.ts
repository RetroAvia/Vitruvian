"use client"

import { onlineManager } from "@tanstack/react-query"
import { useSyncExternalStore } from "react"

/** Stato della connessione (lo stesso che usa TanStack Query per mettere in pausa le richieste). */
export function useOnline(): boolean {
  return useSyncExternalStore(
    (cb) => onlineManager.subscribe(cb),
    () => onlineManager.isOnline(),
    () => true,
  )
}
