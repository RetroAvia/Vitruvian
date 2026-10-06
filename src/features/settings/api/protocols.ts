"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"

import { queryKeys } from "@/lib/query-keys"
import { createClient } from "@/lib/supabase/client"
import type { TablesInsert } from "@/types/database.types"

export type ProtocolInput = Omit<TablesInsert<"bia_protocols">, "id" | "user_id" | "created_at" | "updated_at">

export function useSaveProtocol() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, values }: { id?: string; values: ProtocolInput }) => {
      const supabase = createClient()
      const { error } = id
        ? await supabase.from("bia_protocols").update(values).eq("id", id)
        : await supabase.from("bia_protocols").insert(values)
      if (error) {
        if (error.code === "23505") throw new Error("Esiste già un protocollo con questo nome")
        throw new Error(error.message)
      }
    },
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.protocols }),
        queryClient.invalidateQueries({ queryKey: queryKeys.checkups.all }),
      ]),
  })
}

export function useDeleteProtocol() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await createClient().from("bia_protocols").delete().eq("id", id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.protocols }),
        queryClient.invalidateQueries({ queryKey: queryKeys.checkups.all }),
      ]),
  })
}
