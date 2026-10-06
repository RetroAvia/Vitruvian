"use client"

import { useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { useEffect, useRef } from "react"
import { toast } from "sonner"

import { clearLocalData } from "@/lib/local-cache"
import { createClient } from "@/lib/supabase/client"
import { useUiStore } from "@/stores/ui-store"

const EVENTS = ["pointerdown", "keydown", "scroll", "touchstart"] as const

/** Disconnessione automatica dopo N minuti senza interazioni (impostabile in Sicurezza). */
export function IdleLogout() {
  const minutes = useUiStore((s) => s.idleLogoutMinutes)
  const router = useRouter()
  const qc = useQueryClient()
  const last = useRef(Date.now())

  useEffect(() => {
    if (!minutes) return
    last.current = Date.now()
    const bump = () => {
      last.current = Date.now()
    }
    EVENTS.forEach((e) => window.addEventListener(e, bump, { passive: true }))
    const id = setInterval(async () => {
      if (Date.now() - last.current < minutes * 60_000) return
      clearInterval(id)
      await createClient().auth.signOut()
      clearLocalData(qc)
      toast.info("Sei stato disconnesso per inattività")
      router.replace("/login")
      router.refresh()
    }, 30_000)
    return () => {
      clearInterval(id)
      EVENTS.forEach((e) => window.removeEventListener(e, bump))
    }
  }, [minutes, qc, router])

  return null
}
