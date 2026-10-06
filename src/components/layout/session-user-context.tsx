"use client"

import { createContext, useContext, type ReactNode } from "react"

import type { SessionUser } from "@/types/domain"

const SessionUserContext = createContext<SessionUser | null>(null)

export function SessionUserProvider({ user, children }: { user: SessionUser; children: ReactNode }) {
  return <SessionUserContext.Provider value={user}>{children}</SessionUserContext.Provider>
}

/** Utente autenticato corrente (disponibile in tutta l'area protetta). */
export function useSessionUser(): SessionUser {
  const user = useContext(SessionUserContext)
  if (!user) throw new Error("useSessionUser deve essere usato dentro <AppShell>")
  return user
}
