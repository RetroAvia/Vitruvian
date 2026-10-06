"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"

import { queryKeys } from "@/lib/query-keys"
import { createClient } from "@/lib/supabase/client"
import type { Json } from "@/types/database.types"

import type { SaveCheckupPayload } from "../schemas/checkup-form"

function invalidateCheckups(queryClient: ReturnType<typeof useQueryClient>) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.checkups.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.circumferences }),
  ])
}

/** Crea o aggiorna una visita completa (RPC atomica save_checkup). */
export function useSaveCheckup() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: SaveCheckupPayload): Promise<string> => {
      const { data, error } = await createClient().rpc("save_checkup", { p: payload as unknown as Json })
      if (error) throw new Error(error.hint ? `${error.message}. ${error.hint}` : error.message)
      return data
    },
    onSuccess: () => invalidateCheckups(queryClient),
  })
}

/** Elimina una visita (BIA e circonferenze vengono eliminate in cascata). */
export function useDeleteCheckup() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await createClient().from("checkups").delete().eq("id", id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => invalidateCheckups(queryClient),
  })
}

/** Import multiplo dall'AI Bridge (semantica merge, atomico). */
export function useImportCheckups() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: unknown): Promise<string[]> => {
      const { data, error } = await createClient().rpc("import_checkups", { p: payload as Json })
      if (error) throw new Error(error.hint ? `${error.message}. ${error.hint}` : error.message)
      return data ?? []
    },
    onSuccess: () => invalidateCheckups(queryClient),
  })
}
