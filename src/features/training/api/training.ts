"use client"

/**
 * Accesso ai dati dell'allenamento, pensato per restare leggero negli anni:
 *  - elenco sessioni: solo intestazione + riepilogo (pochi byte a sessione)
 *  - serie complete: solo delle ultime 8 settimane (precompilazione del registro)
 *    oppure della singola sessione aperta
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { shiftISO, todayISO } from "@/lib/format"
import { queryKeys } from "@/lib/query-keys"
import { createClient } from "@/lib/supabase/client"
import type { Json } from "@/types/database.types"

import { sendWorkout } from "../session/send"
import type {
  CompactExercise,
  ExerciseSummary,
  PlanPayload,
  SchemeStep,
  Technique,
  TrainingPlan,
  TrainingTree,
  Workout,
  WorkoutPayload,
  WorkoutSummary,
} from "../types"

/** Migrazione non ancora eseguita → sezione vuota invece di un errore. */
const missingTable = (code?: string) => code === "42P01" || code === "PGRST205" || code === "42703"
const PAGE = 1000
const SUMMARY_COLUMNS =
  "id,user_id,workout_date,plan_day_id,title,duration_min,session_rpe,notes,source,total_sets,total_volume,summary,created_at,updated_at"

const asArray = <T,>(j: unknown): T[] => (Array.isArray(j) ? (j as T[]) : [])

/** Riga non trovata (es. eliminata da un'altra scheda o dispositivo). */
const NOT_FOUND = "Elemento non trovato: potrebbe essere stato eliminato."

export function useTrainingPlans() {
  return useQuery({
    queryKey: queryKeys.training.plans,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<TrainingPlan[]> => {
      const { data, error } = await createClient()
        .from("training_plans")
        .select("*")
        .order("is_active", { ascending: false })
        .order("created_at", { ascending: false })
      if (error) {
        if (missingTable(error.code)) return []
        throw new Error(error.message)
      }
      return data ?? []
    },
  })
}

export function useTrainingTree(planId: string | null) {
  return useQuery({
    queryKey: queryKeys.training.tree(planId ?? "none"),
    enabled: Boolean(planId),
    // scheda appena eliminata: inutile riprovare
    retry: (n, e) => e.message !== NOT_FOUND && n < 3,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<TrainingTree> => {
      const client = createClient()
      const { data: plan, error: e1 } = await client.from("training_plans").select("*").eq("id", planId as string).maybeSingle()
      if (e1) throw new Error(e1.message)
      if (!plan) throw new Error(NOT_FOUND)
      const { data: days, error: e2 } = await client.from("training_days").select("*").eq("plan_id", plan.id).order("sort_order")
      if (e2) throw new Error(e2.message)
      const ids = (days ?? []).map((d) => d.id)
      const { data: exercises, error: e3 } = ids.length
        ? await client.from("training_exercises").select("*").in("day_id", ids).order("sort_order")
        : { data: [], error: null }
      if (e3) throw new Error(e3.message)
      return {
        plan,
        days: (days ?? []).map((d) => ({
          ...d,
          exercises: (exercises ?? [])
            .filter((e) => e.day_id === d.id)
            .map((e) => ({ ...e, technique: (e.technique ?? "straight") as Technique, set_scheme: Array.isArray(e.set_scheme) ? (e.set_scheme as unknown as SchemeStep[]) : null })),
        })),
      }
    },
  })
}

/** Tutte le sessioni, solo riepilogo (≈ 300 byte l'una): anni di storico in pochi KB. */
export function useWorkouts() {
  return useQuery({
    queryKey: queryKeys.training.workouts,
    queryFn: async (): Promise<WorkoutSummary[]> => {
      const client = createClient()
      const out: WorkoutSummary[] = []
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await client
          .from("workouts")
          .select(SUMMARY_COLUMNS)
          .order("workout_date", { ascending: false })
          .order("created_at", { ascending: false })
          .range(from, from + PAGE - 1)
        if (error) {
          if (missingTable(error.code)) return []
          throw new Error(error.message)
        }
        for (const w of data ?? []) out.push({ ...w, summary: asArray<ExerciseSummary>(w.summary) })
        if (!data || data.length < PAGE) break
      }
      return out
    },
  })
}

function toWorkout(w: Record<string, unknown>): Workout {
  return { ...(w as unknown as Workout), summary: asArray<ExerciseSummary>(w.summary), exercises: asArray<CompactExercise>(w.exercises) }
}

/** Serie complete delle ultime 8 settimane (precompilazione e analisi delle serie). */
export function useRecentWorkoutDetails() {
  return useQuery({
    queryKey: queryKeys.training.recent,
    queryFn: async (): Promise<Workout[]> => {
      const { data, error } = await createClient()
        .from("workouts")
        .select("*")
        .gte("workout_date", shiftISO(todayISO(), -56))
        .order("workout_date", { ascending: false })
      if (error) {
        if (missingTable(error.code)) return []
        throw new Error(error.message)
      }
      return (data ?? []).map((w) => toWorkout(w as unknown as Record<string, unknown>))
    },
  })
}

/** Una sessione completa (apertura dallo storico o modifica). */
export function useWorkoutDetail(id: string | null) {
  const qc = useQueryClient()
  return useQuery({
    queryKey: queryKeys.training.detail(id ?? "none"),
    enabled: Boolean(id),
    retry: (n, e) => e.message !== NOT_FOUND && n < 3,
    staleTime: 10 * 60_000,
    // le sessioni delle ultime 8 settimane sono già in cache (anche offline): niente attesa
    initialData: () => (id ? qc.getQueryData<Workout[]>(queryKeys.training.recent)?.find((w) => w.id === id) : undefined),
    initialDataUpdatedAt: () => qc.getQueryState(queryKeys.training.recent)?.dataUpdatedAt,
    queryFn: async (): Promise<Workout> => {
      const { data, error } = await createClient().from("workouts").select("*").eq("id", id as string).maybeSingle()
      if (error) throw new Error(error.message)
      if (!data) throw new Error(NOT_FOUND)
      return toWorkout(data as unknown as Record<string, unknown>)
    },
  })
}

function invalidateAll(qc: ReturnType<typeof useQueryClient>) {
  return qc.invalidateQueries({ queryKey: ["training"] })
}

export function useImportTraining() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: unknown) => {
      const { data, error } = await createClient().rpc("import_training", { p: payload as Json })
      if (error) throw new Error(error.message)
      return (data ?? {}) as { plan_id: string | null; workouts: number; sets: number }
    },
    onSuccess: () => invalidateAll(qc),
  })
}

export function useSaveTrainingPlan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: PlanPayload): Promise<string> => {
      const { data, error } = await createClient().rpc("save_training_plan", { p: payload as unknown as Json })
      if (error) throw new Error(error.message)
      return data
    },
    onSuccess: () => invalidateAll(qc),
  })
}

export function useSaveWorkout() {
  const qc = useQueryClient()
  return useMutation({
    // "always": senza rete la richiesta fallisce subito e il registro mette la sessione in coda
    networkMode: "always",
    mutationFn: (payload: WorkoutPayload): Promise<string> => sendWorkout(payload),
    // aggiornamento in background: il registro mostra subito il riepilogo
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.training.workouts })
      void qc.invalidateQueries({ queryKey: queryKeys.training.recent })
      void qc.invalidateQueries({ queryKey: ["training", "detail"] })
    },
  })
}

export function useDeleteWorkout() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await createClient().from("workouts").delete().eq("id", id)
      if (error) throw new Error(error.message)
    },
    onSuccess: (_, id) => {
      qc.removeQueries({ queryKey: queryKeys.training.detail(id) })
      return Promise.all([qc.invalidateQueries({ queryKey: queryKeys.training.workouts }), qc.invalidateQueries({ queryKey: queryKeys.training.recent })])
    },
  })
}

export function useActivateTrainingPlan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await createClient().from("training_plans").update({ is_active: true }).eq("id", id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => invalidateAll(qc),
  })
}

export function useDeleteTrainingPlan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await createClient().from("training_plans").delete().eq("id", id)
      if (error) throw new Error(error.message)
    },
    onSuccess: (_, id) => {
      qc.removeQueries({ queryKey: queryKeys.training.tree(id) })
      return invalidateAll(qc)
    },
  })
}

/**
 * Esporta tutte le sessioni (serie comprese) in CSV per Excel/Fogli Google.
 * Scaricate a pagine solo al momento dell'export: l'app normalmente non le tiene in memoria.
 */
export async function exportWorkoutsCsv(): Promise<string> {
  const client = createClient()
  const rows: string[] = ["data;sessione;esercizio;serie;tipo;kg;ripetizioni;rpe;minuti;note"]
  const TYPES = ["allenante", "riscaldamento", "drop", "rest-pause", "cedimento"]
  const q = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v)
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const dec = (v: number | null | undefined) => (v === null || v === undefined ? "" : String(v).replace(".", ","))
  for (let page = 0; ; page++) {
    const { data, error } = await client
      .from("workouts")
      .select("workout_date,title,notes,exercises")
      .order("workout_date", { ascending: true })
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(page * 200, page * 200 + 199)
    if (error) throw new Error(error.message)
    for (const w of data ?? []) {
      for (const e of asArray<CompactExercise>(w.exercises)) {
        const sets = e.s ?? []
        if (sets.length === 0) rows.push([w.workout_date, q(w.title), q(e.n), "", "cardio", "", "", "", dec(e.m), q(w.notes)].join(";"))
        sets.forEach((s, i) => rows.push([w.workout_date, q(w.title), q(e.n), i + 1, TYPES[s[3]] ?? "", dec(s[1]), s[0], dec(s[2]), "", i === 0 ? q(w.notes) : ""].join(";")))
      }
    }
    if (!data || data.length < 200) break
  }
  // BOM: Excel riconosce accenti e separatore
  return "﻿" + rows.join("\n")
}
