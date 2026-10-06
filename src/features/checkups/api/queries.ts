"use client"

import { useQuery } from "@tanstack/react-query"

import { queryKeys } from "@/lib/query-keys"
import { createClient } from "@/lib/supabase/client"
import type { BiaProtocol, Checkup, MeasurementSite } from "@/types/domain"

/** Tutte le visite (vista v_checkups) in ordine cronologico crescente. */
export function useCheckups() {
  return useQuery({
    queryKey: queryKeys.checkups.all,
    queryFn: async (): Promise<Checkup[]> => {
      const { data, error } = await createClient()
        .from("v_checkups")
        .select("*")
        .order("checkup_date", { ascending: true })

      if (error) throw new Error(error.message)
      return (data ?? []) as Checkup[]
    },
  })
}

/** Siti di misura visibili (di sistema + personali), in ordine di visualizzazione. */
export function useMeasurementSites() {
  return useQuery({
    queryKey: queryKeys.sites,
    staleTime: 30 * 60_000,
    queryFn: async (): Promise<MeasurementSite[]> => {
      const { data, error } = await createClient()
        .from("measurement_sites")
        .select("*")
        .order("sort_order", { ascending: true })
      if (error) throw new Error(error.message)
      return data ?? []
    },
  })
}

export function useBiaProtocols() {
  return useQuery({
    queryKey: queryKeys.protocols,
    queryFn: async (): Promise<BiaProtocol[]> => {
      const { data, error } = await createClient()
        .from("bia_protocols")
        .select("*")
        .order("active_from", { ascending: false, nullsFirst: true })
      if (error) throw new Error(error.message)
      return data ?? []
    },
  })
}
