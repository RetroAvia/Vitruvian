/**
 * Notifica di fine recupero (schermo bloccato).
 * Il registro chiama questo endpoint quando parte un recupero (una sola richiesta,
 * così parte anche se blocchi subito il telefono). Il server crea il timer,
 * risponde subito e attende la fine del recupero (max ~5 minuti); poi manda la
 * notifica solo se il timer esiste ancora (saltato o modificato = cancellato).
 * Autenticazione: token di sessione dell'utente (verificato all'inizio, le scritture
 * passano dalla RLS). A fine attesa, quando il token può essere scaduto, si usa
 * l'id casuale del timer come biglietto monouso (funzione consume_rest_timer).
 */
import { createClient } from "@supabase/supabase-js"
import { after } from "next/server"

import { env } from "@/lib/env"
import { sendPush, vapidFromEnv } from "@/lib/server/web-push"
import type { Database } from "@/types/database.types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
/** Vercel: durata massima della funzione (piano Hobby: fino a 300 s). */
export const maxDuration = 300

const MAX_DELAY_MS = 285_000
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const clip = (v: unknown, n: number) => (typeof v === "string" ? v.slice(0, n) : "")

export async function POST(request: Request) {
  const keys = vapidFromEnv()
  if (!keys) return Response.json({ error: "Notifiche non configurate sul server" }, { status: 503 })

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "")
  if (!token) return Response.json({ error: "Non autenticato" }, { status: 401 })

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return Response.json({ error: "Richiesta non valida" }, { status: 400 })
  }
  const timerId = clip(body.timerId, 40)
  const endpoint = clip(body.endpoint, 1000)
  // durata relativa: niente problemi se l'orologio del telefono è sbagliato
  const delay = typeof body.delayMs === "number" ? body.delayMs : NaN
  if (!UUID.test(timerId) || !endpoint || !Number.isFinite(delay)) return Response.json({ error: "Richiesta non valida" }, { status: 400 })
  if (delay > MAX_DELAY_MS) return Response.json({ error: "Recupero troppo lungo per l'avviso" }, { status: 422 })
  const at = Date.now() + Math.max(0, delay)

  const supabase = createClient<Database>(env.supabaseUrl, env.supabaseKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: userData, error: userError } = await supabase.auth.getUser(token)
  if (userError || !userData.user) return Response.json({ error: "Sessione scaduta" }, { status: 401 })

  const { data: sub } = await supabase.from("push_subscriptions").select("id, endpoint, p256dh, auth").eq("endpoint", endpoint).maybeSingle()
  if (!sub) return Response.json({ error: "Dispositivo non registrato" }, { status: 404 })

  // un solo recupero alla volta: il nuovo sostituisce i precedenti (+15 s, serie successiva…)
  await supabase.from("rest_timers").delete().eq("user_id", userData.user.id)
  const { error: insertError } = await supabase.from("rest_timers").insert({ id: timerId, fire_at: new Date(at).toISOString() })
  if (insertError) return Response.json({ error: insertError.message }, { status: 400 })

  const message = {
    title: clip(body.title, 80) || "⏱️ Recupero finito",
    body: clip(body.body, 160),
    tag: "vt-rest",
    url: "/training",
  }

  // dopo la risposta: attesa fino alla fine del recupero, poi l'avviso
  after(async () => {
    const wait = Math.max(0, at - Date.now())
    if (wait > 0) await new Promise((r) => setTimeout(r, wait))
    // timer ancora valido? (cancellato = saltato, modificato o finito con l'app aperta)
    const anon = createClient<Database>(env.supabaseUrl, env.supabaseKey, { auth: { persistSession: false, autoRefreshToken: false } })
    const { data: valid, error } = await anon.rpc("consume_rest_timer", { p_id: timerId })
    if (error || !valid) return
    try {
      const status = await sendPush(sub, message, keys, 120)
      if (status === 404 || status === 410) await anon.rpc("drop_push_subscription", { p_endpoint: sub.endpoint })
      else if (status >= 400) console.warn(`[push] invio rifiutato dal servizio push: ${status}`)
    } catch (e) {
      console.warn("[push] servizio push non raggiungibile", e)
    }
  })

  return Response.json({ ok: true }, { status: 202 })
}
