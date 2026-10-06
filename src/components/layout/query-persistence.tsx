"use client"

import { useQueryClient } from "@tanstack/react-query"
import { useEffect } from "react"

import { restoreCache, saveCache } from "@/lib/local-cache"
import { useUiStore } from "@/stores/ui-store"

/** Collega la cache di TanStack Query a localStorage (vedi lib/local-cache). */
export function QueryPersistence({ userId }: { userId: string }) {
  const qc = useQueryClient()
  const enabled = useUiStore((s) => s.offlineCache)

  useEffect(() => {
    if (!enabled) return
    restoreCache(qc, userId)
    let timer: ReturnType<typeof setTimeout> | undefined
    const unsub = qc.getQueryCache().subscribe((e) => {
      if (e.type !== "updated" || e.action.type !== "success") return
      clearTimeout(timer)
      timer = setTimeout(() => saveCache(qc, userId), 1500)
    })
    const onHide = () => {
      if (document.visibilityState === "hidden") saveCache(qc, userId)
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
