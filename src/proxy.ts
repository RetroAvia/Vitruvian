/**
 * Next.js 16+: questo file si chiama `proxy.ts` (ex `middleware.ts`).
 * Se il tuo progetto usa Next.js 15, rinominalo in `src/middleware.ts`:
 * il contenuto resta identico (l'export default funziona con entrambi).
 */
import type { NextRequest } from "next/server"

import { updateSession } from "@/lib/supabase/session"

export default async function proxy(request: NextRequest) {
  return updateSession(request)
}

export const config = {
  matcher: [
    // Tutto tranne asset statici e immagini
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-icon.png|manifest.webmanifest|sw.js|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
}
