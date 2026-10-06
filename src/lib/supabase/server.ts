/** Client Supabase per Server Components, Route Handlers e Server Actions. */
import "server-only"

import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

import { env } from "@/lib/env"
import type { Database } from "@/types/database.types"

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(env.supabaseUrl, env.supabaseKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch {
          // Chiamato da un Server Component: i cookie sono read-only.
          // Nessun problema, il refresh della sessione lo fa il proxy.
        }
      },
    },
  })
}
