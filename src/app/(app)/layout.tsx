import { redirect } from "next/navigation"

import { AppShell } from "@/components/layout/app-shell"
import { createClient } from "@/lib/supabase/server"
import type { SessionUser } from "@/types/domain"

/** Area protetta: seconda linea di difesa dopo il proxy + dati utente per la shell. */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const claims = data?.claims

  if (!claims?.sub) redirect("/login")

  const email = typeof claims.email === "string" ? claims.email : ""

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", claims.sub)
    .maybeSingle()

  const user: SessionUser = {
    id: claims.sub,
    email,
    displayName: profile?.display_name || email.split("@")[0] || "Utente",
  }

  return <AppShell user={user}>{children}</AppShell>
}
