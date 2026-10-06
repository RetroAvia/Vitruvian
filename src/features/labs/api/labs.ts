"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { queryKeys } from "@/lib/query-keys"
import { createClient } from "@/lib/supabase/client"
import type { Json } from "@/types/database.types"
import type { LabAnalyte, LabReport, LabResult } from "@/types/domain"

export function useLabResults() {
  return useQuery({
    queryKey: queryKeys.labs.results,
    queryFn: async (): Promise<LabResult[]> => {
      const { data, error } = await createClient()
        .from("v_lab_results")
        .select("*")
        .order("report_date", { ascending: true })
      if (error) throw new Error(error.message)
      return (data ?? []) as LabResult[]
    },
  })
}

export function useLabAnalytes() {
  return useQuery({
    queryKey: queryKeys.labs.analytes,
    staleTime: 30 * 60_000,
    queryFn: async (): Promise<LabAnalyte[]> => {
      const { data, error } = await createClient().from("lab_analytes").select("*").order("sort_order")
      if (error) throw new Error(error.message)
      return data ?? []
    },
  })
}

export function useLabReports() {
  return useQuery({
    queryKey: queryKeys.labs.reports,
    queryFn: async (): Promise<LabReport[]> => {
      const { data, error } = await createClient()
        .from("lab_reports")
        .select("*")
        .order("report_date", { ascending: false })
      if (error) throw new Error(error.message)
      return data ?? []
    },
  })
}

function invalidateLabs(qc: ReturnType<typeof useQueryClient>) {
  return Promise.all([
    qc.invalidateQueries({ queryKey: queryKeys.labs.results }),
    qc.invalidateQueries({ queryKey: queryKeys.labs.reports }),
    qc.invalidateQueries({ queryKey: queryKeys.labs.analytes }),
  ])
}

export function useImportLabReports() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: unknown): Promise<string[]> => {
      const { data, error } = await createClient().rpc("import_lab_reports", { p: payload as Json })
      if (error) throw new Error(error.message)
      return data ?? []
    },
    onSuccess: () => invalidateLabs(qc),
  })
}

export function useDeleteLabReport() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await createClient().from("lab_reports").delete().eq("id", id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => invalidateLabs(qc),
  })
}
