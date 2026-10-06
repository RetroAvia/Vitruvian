"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { queryKeys } from "@/lib/query-keys"
import { createClient } from "@/lib/supabase/client"
import type { Json } from "@/types/database.types"
import type { MealLogStatus } from "@/types/domain"

import type { DayWithMeals, DietPlanRow, MealLog, PlanTree } from "../types"

export function useDietPlans() {
  return useQuery({
    queryKey: queryKeys.diet.plans,
    queryFn: async (): Promise<DietPlanRow[]> => {
      const { data, error } = await createClient()
        .from("diet_plans")
        .select("*")
        .order("is_active", { ascending: false })
        .order("created_at", { ascending: false })
      if (error) throw new Error(error.message)
      return data ?? []
    },
  })
}

/** Piano completo: giorni → pasti → alimenti (query separate, assemblate qui). */
export function usePlanTree(planId: string | null) {
  return useQuery({
    queryKey: queryKeys.diet.tree(planId ?? "none"),
    enabled: Boolean(planId),
    queryFn: async (): Promise<PlanTree> => {
      const supabase = createClient()
      const { data: plan, error: e1 } = await supabase.from("diet_plans").select("*").eq("id", planId as string).single()
      if (e1) throw new Error(e1.message)
      const { data: days, error: e2 } = await supabase
        .from("diet_days")
        .select("*")
        .eq("plan_id", plan.id)
        .order("sort_order")
      if (e2) throw new Error(e2.message)
      const dayIds = (days ?? []).map((d) => d.id)
      const { data: meals, error: e3 } = dayIds.length
        ? await supabase.from("meals").select("*").in("day_id", dayIds).order("sort_order")
        : { data: [], error: null }
      if (e3) throw new Error(e3.message)
      const mealIds = (meals ?? []).map((m) => m.id)
      const { data: items, error: e4 } = mealIds.length
        ? await supabase.from("meal_items").select("*").in("meal_id", mealIds).order("sort_order")
        : { data: [], error: null }
      if (e4) throw new Error(e4.message)

      const tree: DayWithMeals[] = (days ?? []).map((d) => ({
        ...d,
        meals: (meals ?? [])
          .filter((m) => m.day_id === d.id)
          .map((m) => ({ ...m, items: (items ?? []).filter((i) => i.meal_id === m.id) })),
      }))
      return { plan, days: tree }
    },
  })
}

export function useMealLogs(fromISO: string) {
  return useQuery({
    queryKey: queryKeys.diet.logs(fromISO),
    queryFn: async (): Promise<MealLog[]> => {
      const { data, error } = await createClient()
        .from("meal_logs")
        .select("*")
        .gte("log_date", fromISO)
        .order("log_date")
      if (error) throw new Error(error.message)
      return data ?? []
    },
  })
}

/** Segna un pasto (fatto/saltato/sostituito) o lo azzera; aggiornamento ottimistico. */
export function useSetMealLog(fromISO: string) {
  const qc = useQueryClient()
  const key = queryKeys.diet.logs(fromISO)
  return useMutation({
    mutationFn: async ({ mealId, date, status }: { mealId: string; date: string; status: MealLogStatus | null }) => {
      const supabase = createClient()
      if (status === null) {
        const { error } = await supabase.from("meal_logs").delete().eq("meal_id", mealId).eq("log_date", date)
        if (error) throw new Error(error.message)
        return
      }
      const { error } = await supabase
        .from("meal_logs")
        .upsert({ meal_id: mealId, log_date: date, status }, { onConflict: "user_id,meal_id,log_date" })
      if (error) throw new Error(error.message)
    },
    onMutate: async ({ mealId, date, status }) => {
      await qc.cancelQueries({ queryKey: key })
      const prev = qc.getQueryData<MealLog[]>(key)
      qc.setQueryData<MealLog[]>(key, (old = []) => {
        const rest = old.filter((l) => !(l.meal_id === mealId && l.log_date === date))
        if (status === null) return rest
        const now = new Date().toISOString()
        return [
          ...rest,
          { id: `tmp-${mealId}-${date}`, user_id: "", meal_id: mealId, log_date: date, status, notes: null, created_at: now, updated_at: now },
        ]
      })
      return { prev }
    },
    onError: (_e, _v, ctx) => ctx?.prev && qc.setQueryData(key, ctx.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: queryKeys.diet.allLogs }),
  })
}

function invalidatePlans(qc: ReturnType<typeof useQueryClient>) {
  return qc.invalidateQueries({ queryKey: ["diet"] })
}

export function useActivatePlan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await createClient().from("diet_plans").update({ is_active: true }).eq("id", id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => invalidatePlans(qc),
  })
}

export function useDeletePlan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await createClient().from("diet_plans").delete().eq("id", id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => invalidatePlans(qc),
  })
}

export function useImportDietPlan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: unknown): Promise<string> => {
      const { data, error } = await createClient().rpc("import_diet_plan", { p: payload as Json })
      if (error) throw new Error(error.message)
      return data
    },
    onSuccess: () => invalidatePlans(qc),
  })
}
