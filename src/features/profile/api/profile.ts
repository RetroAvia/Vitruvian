"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { useSessionUser } from "@/components/layout/session-user-context"
import { queryKeys } from "@/lib/query-keys"
import { createClient } from "@/lib/supabase/client"
import type { TablesUpdate } from "@/types/database.types"
import type { Profile } from "@/types/domain"

export function useProfile() {
  const user = useSessionUser()
  return useQuery({
    queryKey: queryKeys.profile,
    queryFn: async (): Promise<Profile | null> => {
      const { data, error } = await createClient().from("profiles").select("*").eq("id", user.id).maybeSingle()
      if (error) throw new Error(error.message)
      return data
    },
  })
}

export function useUpdateProfile() {
  const user = useSessionUser()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (patch: TablesUpdate<"profiles">) => {
      const { data, error } = await createClient()
        .from("profiles")
        .update(patch)
        .eq("id", user.id)
        .select("*")
        .single()
      if (error) throw new Error(error.message)
      return data
    },
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.profile, data)
      // altezza e attività cambiano gli indici calcolati nella vista
      void queryClient.invalidateQueries({ queryKey: queryKeys.checkups.all })
      // i valori di riferimento delle analisi dipendono da sesso ed età (calcolati dal database)
      void queryClient.invalidateQueries({ queryKey: ["labs"] })
    },
  })
}
