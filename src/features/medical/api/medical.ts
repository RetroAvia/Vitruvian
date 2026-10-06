"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { queryKeys } from "@/lib/query-keys"
import { createClient } from "@/lib/supabase/client"
import type { Json } from "@/types/database.types"
import type { MedicalReport } from "@/types/domain"

import { parseMeasurements } from "../engine/analysis"

export function useMedicalReports() {
  return useQuery({
    queryKey: queryKeys.medical,
    queryFn: async (): Promise<MedicalReport[]> => {
      const { data, error } = await createClient()
        .from("medical_reports")
        .select("*")
        .order("report_date", { ascending: false })
      // Migrazione 0005 non ancora eseguita → nessun referto, senza rompere le altre pagine
      if (error) {
        if (error.code === "42P01" || error.code === "PGRST205") return []
        throw new Error(error.message)
      }
      return (data ?? []).map((r) => ({ ...r, measurements: parseMeasurements(r.measurements) }))
    },
  })
}

export function useImportMedicalReports() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: unknown): Promise<string[]> => {
      const { data, error } = await createClient().rpc("import_medical_reports", { p: payload as Json })
      if (error) throw new Error(error.message)
      return data ?? []
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.medical }),
  })
}

export function useDeleteMedicalReport() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await createClient().from("medical_reports").delete().eq("id", id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.medical }),
  })
}
