/**
 * Ricezione dei dati di Apple Salute dal Comando Rapido di iPhone.
 * Nessuna sessione: il Comando invia il codice personale generato in
 * Impostazioni → Apple Salute. Il database controlla il codice (ne conserva
 * solo l'impronta) e salva un valore al giorno.
 *
 * Accetta JSON, modulo o parametri nell'URL:
 *   token, date (vuota = oggi), steps, active_kcal, resting_hr, hrv, sleep_hours, weight_kg
 */
import { createClient } from "@supabase/supabase-js"

import { sleepHours } from "@/features/health/engine/parse"
import { env } from "@/lib/env"
import type { Database } from "@/types/database.types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const FIELDS = ["token", "date", "steps", "active_kcal", "resting_hr", "hrv", "sleep_hours", "weight_kg"] as const
type Field = (typeof FIELDS)[number]

/** Valore in testo: i Comandi Rapidi possono mandare numeri, testo o liste. */
function text(v: unknown): string | null {
  if (v === null || v === undefined) return null
  if (Array.isArray(v)) return text(v[v.length - 1])
  const s = String(v).trim()
  return s ? s.slice(0, 200) : null
}

async function readInput(request: Request): Promise<Partial<Record<Field, string | null>>> {
  const out: Partial<Record<Field, string | null>> = {}
  const url = new URL(request.url)
  for (const f of FIELDS) if (url.searchParams.has(f)) out[f] = text(url.searchParams.get(f))
  const type = request.headers.get("content-type") ?? ""
  try {
    if (type.includes("application/json")) {
      const j = (await request.json()) as Record<string, unknown>
      for (const f of FIELDS) if (f in j) out[f] = text(j[f])
    } else if (type.includes("form")) {
      const fd = await request.formData()
      for (const f of FIELDS) if (fd.has(f)) out[f] = text(fd.get(f))
    }
  } catch {
    /* corpo vuoto o non leggibile: restano i parametri dell'URL */
  }
  const auth = request.headers.get("authorization")
  if (!out.token && auth) out.token = auth.replace(/^Bearer\s+/i, "").trim()
  return out
}

export async function POST(request: Request) {
  const input = await readInput(request)
  if (!input.token) return Response.json({ ok: false, error: "Manca il codice personale (token)" }, { status: 400 })

  const supabase = createClient<Database>(env.supabaseUrl, env.supabaseKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data, error } = await supabase.rpc("ingest_health", {
    p_token: input.token,
    p_date: input.date ?? null,
    p_steps: input.steps ?? null,
    p_active_kcal: input.active_kcal ?? null,
    p_resting_hr: input.resting_hr ?? null,
    p_hrv: input.hrv ?? null,
    p_sleep_hours: sleepHours(input.sleep_hours),
    p_weight_kg: input.weight_kg ?? null,
  })
  if (error) {
    const status = error.code === "28000" ? 401 : 400
    return Response.json({ ok: false, error: status === 401 ? "Codice non valido: generane uno nuovo in Impostazioni" : error.message }, { status })
  }
  return Response.json(data ?? { ok: true })
}

