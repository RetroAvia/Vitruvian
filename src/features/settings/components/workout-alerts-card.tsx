"use client"

import { BellRing, LoaderCircle, Lock, Volume2 } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"

import { useSessionUser } from "@/components/layout/session-user-context"
import { GlassCard } from "@/components/shared/glass-card"
import { Button } from "@/components/ui/button"
import { disablePush, enablePush, PUSH_EVENT, pushStatus, testPush, type PushStatus } from "@/features/training/session/rest-push"
import { playAlert, playSound } from "@/lib/sound"
import { useUiStore } from "@/stores/ui-store"

import { Row, Toggle } from "./security-card"

/** Avvisi del recupero: bip con l'app aperta e notifiche sulla schermata di blocco. */
export function WorkoutAlertsCard() {
  const user = useSessionUser()
  const restSound = useUiStore((s) => s.restSound)
  const setRestSound = useUiStore((s) => s.setRestSound)
  const [status, setStatus] = useState<PushStatus>({ state: "off" })
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const refresh = () => setStatus(pushStatus(user.id))
    refresh()
    window.addEventListener(PUSH_EVENT, refresh)
    return () => window.removeEventListener(PUSH_EVENT, refresh)
  }, [user.id])

  async function run(fn: () => Promise<void>, ok: string) {
    setBusy(true)
    try {
      await fn()
      playSound("success")
      toast.success(ok)
    } catch (e) {
      playSound("error")
      toast.error("Operazione non riuscita", { description: e instanceof Error ? e.message : undefined })
    } finally {
      setBusy(false)
      setStatus(pushStatus(user.id))
    }
  }

  return (
    <GlassCard className="p-5 sm:p-6">
      <div className="mb-5 flex items-center gap-3">
        <span className="grid size-9 place-items-center rounded-xl bg-neon/10 text-neon ring-1 ring-inset ring-neon/25">
          <BellRing className="size-4" />
        </span>
        <div>
          <h2 className="text-sm font-semibold">Avvisi del recupero</h2>
          <p className="text-xs text-muted-foreground">Sapere quando ripartire, anche con il telefono in tasca.</p>
        </div>
      </div>

      <div className="space-y-4">
        <Row icon={Volume2} title="Bip di fine recupero" desc="Conto alla rovescia negli ultimi 3 secondi e bip finale (vibrazione su Android). Su iPhone il bip non suona con il tasto silenzioso attivo.">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="rounded-lg" onClick={() => playAlert("restEnd")} disabled={!restSound}>
              Prova
            </Button>
            <Toggle on={restSound} label="Bip di fine recupero" onChange={setRestSound} />
          </div>
        </Row>

        <div className="rounded-xl border p-4">
          <div className="flex items-start gap-3">
            <Lock className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Notifiche sulla schermata di blocco</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Quando blocchi il telefono durante il recupero vedi esercizio, serie fatte, prossima serie e ora di fine; allo scadere arriva una notifica con
                suono e vibrazione (anche in modalità silenziosa vibra). Tocchi la notifica e torni al registro. La musica non si ferma.
              </p>
              {status.state === "unsupported" || status.state === "denied" ? (
                <p className="mt-3 rounded-lg bg-warn/10 px-3 py-2 text-xs text-warn ring-1 ring-inset ring-warn/25">{status.reason}</p>
              ) : (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {status.state === "on" ? (
                    <>
                      <span className="rounded-full bg-gain/15 px-2.5 py-1 text-xs font-medium text-gain">✅ Attive su questo dispositivo</span>
                      <Button size="sm" variant="outline" className="rounded-lg" disabled={busy} onClick={() => void run(() => testPush(user.id), "Prova inviata: blocca il telefono, arriva tra 10 secondi")}>
                        Invia una prova
                      </Button>
                      <Button size="sm" variant="ghost" className="rounded-lg text-muted-foreground" disabled={busy} onClick={() => void run(() => disablePush(user.id), "Notifiche disattivate")}>
                        Disattiva
                      </Button>
                    </>
                  ) : (
                    <Button size="sm" className="rounded-lg" disabled={busy} onClick={() => void run(() => enablePush(user.id), "Notifiche attivate")}>
                      {busy ? <LoaderCircle className="size-4 animate-spin" /> : <BellRing className="size-4" />}
                      Attiva su questo dispositivo
                    </Button>
                  )}
                </div>
              )}
              <p className="mt-3 text-[11px] text-muted-foreground">
                Su iPhone serve iOS 16.4 o successivo e l&apos;app aperta dall&apos;icona sulla schermata Home. Recuperi da 10 secondi a 4 minuti e mezzo.
              </p>
            </div>
          </div>
        </div>
      </div>
    </GlassCard>
  )
}
