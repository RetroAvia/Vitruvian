/** Client Supabase per i Client Components (browser). Singleton per tab. */
import { createBrowserClient } from "@supabase/ssr"
import type { SupabaseClient } from "@supabase/supabase-js"

import { env } from "@/lib/env"
import type { Database } from "@/types/database.types"

export type TypedSupabaseClient = SupabaseClient<Database>

let browserClient: TypedSupabaseClient | undefined

export function createClient(): TypedSupabaseClient {
  if (!browserClient) {
    browserClient = createBrowserClient<Database>(env.supabaseUrl, env.supabaseKey)
  }
  return browserClient
}
