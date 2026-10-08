"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { queryKeys } from "@/lib/query-keys"
import { createClient } from "@/lib/supabase/client"
import type { Json, TablesInsert } from "@/types/database.types"
import type { Supplement, SupplementLog } from "@/types/domain"

import { parseIngredients } from "../engine/analysis"

const missingTable = (code?: string) => code === "42P01" || code === "PGRST205"

export function useSupplements() {
  return useQuery({
    queryKey: queryKeys.supplements.all,
    queryFn: async (): Promise<Supplement[]> => {
      const { data, error } = await createClient()
        .from("supplements")
        .select("*")
        .order("is_active", { ascending: false })
        .order("sort_order")
        .order("name")
      if (error) {
        if (missingTable(error.code)) return []
        throw new Error(error.message)
      }
      return (data ?? []).map((s) => ({
        ...s,
        form: s.form as Supplement["form"],
        frequency: s.frequency as Supplement["frequency"],
        ingredients: parseIngredients(s.ingredients),
      }))
    },
  })
}

export function useSupplementLogs(fromISO: string) {
  return useQuery({
    queryKey: queryKeys.supplements.logs(fromISO),
    queryFn: async (): Promise<SupplementLog[]> => {
      const { data, error } = await createClient().from("supplement_logs").select("*").gte("log_date", fromISO)
      if (error) {
        if (missingTable(error.code)) return []
        throw new Error(error.message)
      }
      return data ?? []
    },
  })
}

/** Spunta/despunta con aggiornamento ottimistico (la UI risponde subito). */
export function useToggleSupplementLog(fromISO: string) {
  const qc = useQueryClient()
  const key = queryKeys.supplements.logs(fromISO)
  return useMutation({
    mutationFn: async ({ supplementId, date, taken }: { supplementId: string; date: string; taken: boolean }) => {
      const client = createClient()
      if (taken) {
        const { error } = await client
          .from("supplement_logs")
          .upsert({ supplement_id: supplementId, log_date: date, taken: true }, { onConflict: "user_id,supplement_id,log_date" })
        if (error) throw new Error(error.message)
      } else {
        const { error } = await client.from("supplement_logs").delete().eq("supplement_id", supplementId).eq("log_date", date)
        if (error) throw new Error(error.message)
      }
    },
    onMutate: async ({ supplementId, date, taken }) => {
      await qc.cancelQueries({ queryKey: key })
      const prev = qc.getQueryData<SupplementLog[]>(key)
      qc.setQueryData<SupplementLog[]>(key, (old = []) => {
        const rest = old.filter((l) => !(l.supplement_id === supplementId && l.log_date === date))
        if (!taken) return rest
        const now = new Date().toISOString()
        return [...rest, { id: `tmp-${supplementId}-${date}`, user_id: "", supplement_id: supplementId, log_date: date, taken: true, created_at: now, updated_at: now }]
      })
      return { prev }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: queryKeys.supplements.allLogs }),
  })
}

export function useImportSupplements() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: unknown): Promise<string[]> => {
      const { data, error } = await createClient().rpc("import_supplements", { p: payload as Json })
      if (error) throw new Error(error.message)
      return data ?? []
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.supplements.all }),
  })
}

export type SupplementInput = Omit<TablesInsert<"supplements">, "user_id" | "created_at" | "updated_at"> & { id?: string }

export function useSaveSupplement() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...values }: SupplementInput) => {
      const client = createClient()
      const { error } = id
        ? await client.from("supplements").update(values).eq("id", id)
        : await client.from("supplements").insert({ ...values, source: "manual" })
      if (error) {
        if (error.code === "23505") throw new Error("Esiste già un integratore con questo nome e marca")
        throw new Error(error.message)
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.supplements.all }),
  })
}

export function useSetSupplementActive() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, active, today, startDate }: { id: string; active: boolean; today: string; startDate?: string | null }) => {
      // non ancora iniziato: la fine non può precedere l'inizio
      const end = startDate && startDate > today ? startDate : today
      const { error } = await createClient()
        .from("supplements")
        .update(active ? { is_active: true, end_date: null } : { is_active: false, end_date: end })
        .eq("id", id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.supplements.all }),
  })
}

export function useDeleteSupplement() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await createClient().from("supplements").delete().eq("id", id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["supplements"] }),
  })
}
