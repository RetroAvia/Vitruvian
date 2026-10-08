"use client"

import { useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { useEffect, useRef } from "react"
import { toast } from "sonner"

import { clearLocalData } from "@/lib/local-cache"
import { useSessionUser } from "@/components/layout/session-user-context"
import { draftInfo } from "@/features/training/session/storage"
import { useWorkoutSession } from "@/features/training/session/workout-session"
import { createClient } from "@/lib/supabase/client"
import { useUiStore } from "@/stores/ui-store"

const EVENTS = ["pointerdown", "keydown", "scroll", "touchstart"] as const

/**
 * Disconnessione automatica dopo N minuti senza interazioni (impostabile in Sicurezza).
 * Sospesa durante un allenamento in corso e senza rete (non si potrebbe rientrare).
 */
export function IdleLogout() {
  const minutes = useUiStore((s) => s.idleLogoutMinutes)
  const user = useSessionUser()
  const router = useRouter()
  const qc = useQueryClient()
  const last = useRef(Date.now())

  useEffect(() => {
    if (!minutes) return
    last.current = Date.now()
    // attività condivisa tra le schede: una scheda in uso tiene vive anche le altre
    const KEY = "vitruvian-last-activity"
    let lastWrite = 0
    const bump = () => {
      last.current = Date.now()
      if (last.current - lastWrite > 15_000) {
        lastWrite = last.current
        try {
          localStorage.setItem(KEY, String(last.current))
        } catch {
          /* ignore */
        }
      }
    }
    const shared = () => {
      try {
        return Number(localStorage.getItem(KEY) ?? 0)
      } catch {
        return 0
      }
    }
    EVENTS.forEach((e) => window.addEventListener(e, bump, { passive: true }))
    const id = setInterval(async () => {
      if (useWorkoutSession.getState().open || !navigator.onLine || draftInfo(user.id)) {
        last.current = Date.now()
        return
      }
      if (Date.now() - Math.max(last.current, shared()) < minutes * 60_000) return
      clearInterval(id)
      await createClient().auth.signOut({ scope: "local" })
      clearLocalData(qc)
      toast.info("Disconnessione automatica per inattività")
      router.replace("/login")
      router.refresh()
    }, 30_000)
    return () => {
      clearInterval(id)
      EVENTS.forEach((e) => window.removeEventListener(e, bump))
    }
  }, [minutes, qc, router, user.id])

  return null
}
