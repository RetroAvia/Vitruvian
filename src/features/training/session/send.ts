import { createClient } from "@/lib/supabase/client"
import type { Json } from "@/types/database.types"

import type { WorkoutPayload } from "../types"

/** Invia una sessione; l'id generato sul telefono rende l'invio ripetibile senza doppioni. */
export async function sendWorkout(payload: WorkoutPayload): Promise<string> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("save_workout", { p: payload as unknown as Json })
  if (!error) return data
  // database non ancora aggiornato (migrazione 0009 mancante): inserimento classico
  if (error.code === "P0002" && payload.id && payload.is_new !== false) {
    const retry = await supabase.rpc("save_workout", { p: { ...payload, id: null } as unknown as Json })
    if (!retry.error) return retry.data
    throw new Error(retry.error.message)
  }
  throw new Error(error.message)
}
