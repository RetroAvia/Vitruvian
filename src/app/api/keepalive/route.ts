/**
 * Keep-alive del database.
 * I progetti Supabase gratuiti vengono messi in pausa dopo 7 giorni senza attività:
 * Vercel Cron chiama questo endpoint ogni giorno (vedi vercel.json) e lui esegue
 * una query minima. Protetto da CRON_SECRET (Vercel lo invia come Bearer token).
 * Non legge né restituisce dati personali.
 */
import { env } from "@/lib/env"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 })
  }
  const res = await fetch(`${env.supabaseUrl}/rest/v1/measurement_sites?select=id&limit=1`, {
    headers: { apikey: env.supabaseKey },
    cache: "no-store",
  })
  return Response.json({ ok: res.ok, status: res.status, at: new Date().toISOString() })
}
