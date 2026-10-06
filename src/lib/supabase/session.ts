/**
 * Gate di autenticazione eseguito dal proxy (ex middleware) a ogni richiesta:
 *  1. rinnova la sessione Supabase e riscrive i cookie
 *  2. manda al login chi non è autenticato
 *  3. manda alla dashboard chi è già autenticato e apre /login
 */
import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

import { env } from "@/lib/env"
import type { Database } from "@/types/database.types"

const PUBLIC_PATHS = ["/login", "/manifest.webmanifest"]
/** Endpoint senza sessione utente, protetti da un proprio segreto (es. cron). */
const OPEN_API = ["/api/keepalive"]

function isPublic(pathname: string) {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

export async function updateSession(request: NextRequest) {
  if (OPEN_API.some((p) => request.nextUrl.pathname === p)) return NextResponse.next({ request })

  let response = NextResponse.next({ request })

  const supabase = createServerClient<Database>(env.supabaseUrl, env.supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
      },
    },
  })

  // IMPORTANTE: nessuna logica tra createServerClient e getClaims().
  const { data } = await supabase.auth.getClaims()
  const isAuthenticated = Boolean(data?.claims?.sub)
  const { pathname, search } = request.nextUrl

  const redirectTo = (path: string, params?: Record<string, string>) => {
    const url = request.nextUrl.clone()
    url.pathname = path
    url.search = ""
    if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
    const redirect = NextResponse.redirect(url)
    // Conserva i cookie di sessione eventualmente rinnovati
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie))
    return redirect
  }

  if (!isAuthenticated && !isPublic(pathname)) {
    return redirectTo("/login", pathname === "/" ? undefined : { next: `${pathname}${search}` })
  }

  // Passaggio MFA: utente con password verificata ma senza codice → resta sul login
  const mfaStep = pathname === "/login" && request.nextUrl.searchParams.get("mfa") === "1"
  if (isAuthenticated && isPublic(pathname) && !mfaStep) {
    return redirectTo("/dashboard")
  }

  return response
}
