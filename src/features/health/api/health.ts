"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { queryKeys } from "@/lib/query-keys"
import { createClient } from "@/lib/supabase/client"

import type { HealthDay } from "../engine/health"

/** Tabella non ancora creata (migrazione 0011 da eseguire) → nessun dato invece di un errore. */
const missingTable = (code?: string) => code === "42P01" || code === "PGRST205"

export function useHealthDays(days = 90) {
  return useQuery({
    queryKey: queryKeys.health.days,
    staleTime: 10 * 60_000,
    queryFn: async (): Promise<HealthDay[]> => {
      const from = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10)
      const { data, error } = await createClient()
        .from("health_daily")
        .select("day, steps, active_kcal, resting_hr, hrv_ms, sleep_min, weight_kg")
        .gte("day", from)
        .order("day", { ascending: false })
      if (error) {
        if (missingTable(error.code)) return []
        throw new Error(error.message)
      }
      return (data ?? []).map((r) => ({
        day: r.day,
        steps: r.steps,
        active_kcal: r.active_kcal === null ? null : Number(r.active_kcal),
        resting_hr: r.resting_hr === null ? null : Number(r.resting_hr),
        hrv_ms: r.hrv_ms === null ? null : Number(r.hrv_ms),
        sleep_min: r.sleep_min === null ? null : Number(r.sleep_min),
        weight_kg: r.weight_kg === null ? null : Number(r.weight_kg),
      }))
    },
  })
}

export interface HealthLink {
  created_at: string
  last_used_at: string | null
  /** false = migrazione 0011 non ancora eseguita */
  available: boolean
}

export function useHealthLink() {
  return useQuery({
    queryKey: queryKeys.health.link,
    queryFn: async (): Promise<HealthLink | null> => {
      const { data, error } = await createClient().from("health_tokens").select("created_at, last_used_at").maybeSingle()
      if (error) {
        if (missingTable(error.code)) return { created_at: "", last_used_at: null, available: false }
        throw new Error(error.message)
      }
      return data ? { ...data, available: true } : null
    },
  })
}

async function sha256Hex(text: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("")
}

/** Nuovo codice personale (il precedente smette di funzionare). Restituito in chiaro una sola volta. */
export function useCreateHealthToken() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (): Promise<string> => {
      const bytes = crypto.getRandomValues(new Uint8Array(24))
      const token = `vt_${btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")}`
      const { error } = await createClient()
        .from("health_tokens")
        .upsert({ token_hash: await sha256Hex(token), created_at: new Date().toISOString(), last_used_at: null }, { onConflict: "user_id" })
      if (error) throw new Error(missingTable(error.code) ? "Esegui prima la migrazione 20261016000001_push_health.sql su Supabase." : error.message)
      return token
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.health.link }),
  })
}

export function useDisconnectHealth() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (deleteData: boolean) => {
      const supabase = createClient()
      const { error } = await supabase.from("health_tokens").delete().not("user_id", "is", null)
      if (error) throw new Error(error.message)
      if (deleteData) {
        const { error: e2 } = await supabase.from("health_daily").delete().not("day", "is", null)
        if (e2) throw new Error(e2.message)
      }
    },
    onSuccess: () => Promise.all([qc.invalidateQueries({ queryKey: queryKeys.health.link }), qc.invalidateQueries({ queryKey: queryKeys.health.days })]),
  })
}
