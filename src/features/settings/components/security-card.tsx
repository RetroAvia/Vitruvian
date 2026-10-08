"use client"

import { useQueryClient } from "@tanstack/react-query"
import { KeyRound, LoaderCircle, LogOut, ShieldCheck, ShieldOff, Smartphone, Timer, Volume2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { GlassCard } from "@/components/shared/glass-card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { NativeSelect } from "@/components/ui/native-select"
import { clearLocalData } from "@/lib/local-cache"
import { playSound, useSound } from "@/lib/sound"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import { useUiStore } from "@/stores/ui-store"

interface Factor {
  id: string
  friendly_name?: string
  status: string
  created_at: string
}

/** Verifica in due passaggi (TOTP), disconnessione automatica, suoni, sessioni. */
export function SecurityCard() {
  const router = useRouter()
  const qc = useQueryClient()
  const play = useSound()
  const soundEnabled = useUiStore((s) => s.soundEnabled)
  const setSoundEnabled = useUiStore((s) => s.setSoundEnabled)
  const idle = useUiStore((s) => s.idleLogoutMinutes)
  const setIdle = useUiStore((s) => s.setIdleLogoutMinutes)
  const offlineCache = useUiStore((s) => s.offlineCache)
  const setOfflineCache = useUiStore((s) => s.setOfflineCache)

  const [factors, setFactors] = useState<Factor[] | null>(null)
  const [enroll, setEnroll] = useState<{ id: string; qr: string; secret: string } | null>(null)
  const [code, setCode] = useState("")
  const [busy, setBusy] = useState(false)
  const [confirmOff, setConfirmOff] = useState(false)
  const [confirmGlobal, setConfirmGlobal] = useState(false)

  const load = useCallback(async () => {
    const { data, error } = await createClient().auth.mfa.listFactors()
    if (error) {
      setFactors([])
      return
    }
    setFactors((data?.totp ?? []) as Factor[])
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const verified = (factors ?? []).filter((f) => f.status === "verified")

  async function startEnroll() {
    setBusy(true)
    const client = createClient()
    // pulizia di eventuali tentativi non completati
    const { data: list } = await client.auth.mfa.listFactors()
    for (const f of (list?.all ?? []).filter((x) => x.status === "unverified")) await client.auth.mfa.unenroll({ factorId: f.id })
    const { data, error } = await client.auth.mfa.enroll({ factorType: "totp", friendlyName: `Vitruvian ${new Date().toLocaleDateString("it-IT")}` })
    setBusy(false)
    if (error || !data) {
      play("error")
      toast.error("Impossibile attivare la verifica", { description: error?.message })
      return
    }
    setEnroll({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret })
    setCode("")
  }

  async function confirmEnroll() {
    if (!enroll) return
    setBusy(true)
    const { error } = await createClient().auth.mfa.challengeAndVerify({ factorId: enroll.id, code: code.trim() })
    setBusy(false)
    if (error) {
      play("error")
      toast.error("Codice non valido", { description: "Controlla l'ora del telefono e riprova con il codice nuovo." })
      return
    }
    play("celebrate")
    toast.success("Verifica in due passaggi attiva", { description: "Al prossimo accesso ti verrà chiesto il codice dell'app." })
    setEnroll(null)
    void load()
  }

  async function disable() {
    setBusy(true)
    const client = createClient()
    for (const f of verified) {
      const { error } = await client.auth.mfa.unenroll({ factorId: f.id })
      if (error) {
        setBusy(false)
        toast.error("Disattivazione non riuscita", { description: error.message })
        return
      }
    }
    await client.auth.refreshSession()
    setBusy(false)
    setConfirmOff(false)
    toast.success("Verifica in due passaggi disattivata")
    void load()
  }

  async function signOutEverywhere() {
    setBusy(true)
    await createClient().auth.signOut({ scope: "global" })
    clearLocalData(qc)
    router.replace("/login")
    router.refresh()
  }

  return (
    <GlassCard id="security" className="scroll-mt-24 p-5">
      <div className="mb-4 flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-gain/10 text-gain ring-1 ring-inset ring-gain/25">
          <ShieldCheck className="size-4" />
        </span>
        <div>
          <h2 className="text-sm font-semibold">Sicurezza e preferenze</h2>
          <p className="text-xs text-muted-foreground">Proteggi l&apos;accesso ai tuoi dati sanitari.</p>
        </div>
      </div>

      {/* MFA */}
      <div className="surface-inset rounded-xl p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex gap-3">
            <Smartphone className="mt-0.5 size-4 shrink-0 text-neon" />
            <div>
              <p className="text-sm font-medium">Verifica in due passaggi</p>
              <p className="text-xs text-muted-foreground">
                Oltre alla password serve il codice di un&apos;app (Google Authenticator, Microsoft Authenticator, 1Password…). Senza il telefono nessuno può
                leggere i dati, neppure con la password.
              </p>
            </div>
          </div>
          {factors === null ? (
            <LoaderCircle className="size-4 animate-spin text-muted-foreground" />
          ) : verified.length > 0 ? (
            <span className="rounded-full bg-gain/10 px-2 py-0.5 text-[11px] font-medium text-gain ring-1 ring-inset ring-gain/25">Attiva</span>
          ) : (
            <span className="rounded-full bg-warn/10 px-2 py-0.5 text-[11px] font-medium text-warn ring-1 ring-inset ring-warn/25">Non attiva</span>
          )}
        </div>

        {enroll ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-[160px_1fr]">
            {/* eslint-disable-next-line @next/next/no-img-element -- QR SVG generato da Supabase (data URL) */}
            <img src={enroll.qr} alt="Codice QR da scansionare con l'app di autenticazione" className="size-40 rounded-xl bg-white p-2" />
            <div className="space-y-3 text-xs">
              <ol className="list-inside list-decimal space-y-1">
                <li>Apri l&apos;app di autenticazione e scansiona il QR.</li>
                <li>
                  Non puoi scansionare? Inserisci la chiave:{" "}
                  <code className="break-all rounded bg-muted px-1 py-0.5 font-mono text-[11px]">{enroll.secret}</code>
                </li>
                <li>Scrivi il codice a 6 cifre che compare.</li>
              </ol>
              <div className="flex gap-2">
                <Input
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="123456"
                  aria-label="Codice a 6 cifre"
                  className="h-10 w-32 rounded-lg text-center font-mono tracking-[0.3em]"
                />
                <Button className="rounded-lg" onClick={() => void confirmEnroll()} disabled={busy || code.length !== 6}>
                  {busy && <LoaderCircle className="size-4 animate-spin" />}
                  Conferma
                </Button>
                <Button variant="ghost" className="rounded-lg" onClick={() => setEnroll(null)}>
                  Annulla
                </Button>
              </div>
              <p className="text-muted-foreground">Esegui anche la migrazione 0006 per far rispettare la verifica direttamente dal database.</p>
            </div>
          </div>
        ) : (
          <div className="mt-3">
            {verified.length > 0 ? (
              <Button variant="outline" size="sm" className="rounded-lg" onClick={() => setConfirmOff(true)} disabled={busy}>
                <ShieldOff className="size-4" />
                Disattiva
              </Button>
            ) : (
              <Button size="sm" className="rounded-lg" onClick={() => void startEnroll()} disabled={busy || factors === null}>
                {busy ? <LoaderCircle className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
                Attiva
              </Button>
            )}
          </div>
        )}
      </div>

      <PasswordChange />

      {/* Preferenze */}
      <div className="mt-4 space-y-3">
        <Row icon={Timer} title="Disconnessione automatica" desc="Esce dopo un periodo di inattività (utile su PC condivisi).">
          <NativeSelect aria-label="Disconnessione automatica" value={String(idle)} onChange={(e) => setIdle(Number(e.target.value))} className="w-36">
            <option value="0">Mai</option>
            <option value="15">15 minuti</option>
            <option value="30">30 minuti</option>
            <option value="60">1 ora</option>
            <option value="240">4 ore</option>
          </NativeSelect>
        </Row>
        <Row icon={Volume2} title="Suoni" desc="Brevi suoni discreti quando completi un'azione.">
          <Toggle
            on={soundEnabled}
            label="Suoni"
            onChange={(v) => {
              setSoundEnabled(v)
              if (v) setTimeout(() => playSound("success"), 30)
            }}
          />
        </Row>
        <Row icon={ShieldCheck} title="Avvio istantaneo" desc="Copia temporanea dei dati su questo dispositivo (7 giorni): apertura immediata e uso offline, anche in palestra. Cancellata all'uscita.">
          <Toggle
            on={offlineCache}
            label="Avvio istantaneo"
            onChange={(v) => {
              setOfflineCache(v)
              if (!v) clearLocalData()
            }}
          />
        </Row>
      </div>

      <div className="mt-4 border-t pt-4">
        <Button variant="ghost" size="sm" className="rounded-lg text-danger hover:text-danger" onClick={() => setConfirmGlobal(true)}>
          <LogOut className="size-4" />
          Esci da tutti i dispositivi
        </Button>
      </div>

      <ConfirmDialog
        open={confirmOff}
        onOpenChange={setConfirmOff}
        title="Disattivare la verifica in due passaggi?"
        description="Per accedere basterà di nuovo la sola password."
        confirmLabel="Disattiva"
        pending={busy}
        onConfirm={disable}
      />
      <ConfirmDialog
        open={confirmGlobal}
        onOpenChange={setConfirmGlobal}
        title="Uscire da tutti i dispositivi?"
        description="Chiude le sessioni su telefono, tablet e PC, compreso questo. Usalo se hai perso un dispositivo o sospetti un accesso non tuo."
        confirmLabel="Esci ovunque"
        pending={busy}
        onConfirm={signOutEverywhere}
      />
    </GlassCard>
  )
}

function Row({ icon: Icon, title, desc, children }: { icon: typeof Timer; title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex min-w-0 gap-3">
        <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0">
          <p className="text-sm font-medium">{title}</p>
          <p className="text-xs text-muted-foreground">{desc}</p>
        </div>
      </div>
      {children}
    </div>
  )
}

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={cn(
        "relative h-6 w-11 shrink-0 rounded-full transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
        on ? "bg-neon" : "bg-muted",
      )}
    >
      <span className={cn("absolute top-0.5 size-5 rounded-full bg-background shadow transition-transform duration-200", on ? "translate-x-[22px]" : "translate-x-0.5")} />
    </button>
  )
}

/** Cambio password (utile al primo accesso con una password provvisoria). */
function PasswordChange() {
  const [open, setOpen] = useState(false)
  const [pwd, setPwd] = useState("")
  const [confirm, setConfirm] = useState("")
  const [busy, setBusy] = useState(false)
  const tooShort = pwd.length > 0 && pwd.length < 10
  const mismatch = confirm.length > 0 && pwd !== confirm
  const valid = pwd.length >= 10 && pwd === confirm

  async function save() {
    if (!valid) return
    setBusy(true)
    const { error } = await createClient().auth.updateUser({ password: pwd })
    setBusy(false)
    if (error) {
      playSound("error")
      toast.error("Password non aggiornata", { description: error.message })
      return
    }
    playSound("success")
    toast.success("Password aggiornata")
    setPwd("")
    setConfirm("")
    setOpen(false)
  }

  return (
    <div className="surface-inset mt-4 rounded-xl p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-3">
          <KeyRound className="mt-0.5 size-4 shrink-0 text-neon" />
          <div>
            <p className="text-sm font-medium">Password</p>
            <p className="text-xs text-muted-foreground">Cambiala al primo accesso se ti è stata data una password provvisoria.</p>
          </div>
        </div>
        {!open && (
          <Button variant="outline" size="sm" className="rounded-lg" onClick={() => setOpen(true)}>
            Cambia password
          </Button>
        )}
      </div>
      {open && (
        <form
          className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]"
          onSubmit={(e) => {
            e.preventDefault()
            void save()
          }}
        >
          <Input type="password" autoComplete="new-password" placeholder="Nuova password (min. 10 caratteri)" value={pwd} onChange={(e) => setPwd(e.target.value)} aria-invalid={tooShort} className="h-10 rounded-lg" />
          <Input type="password" autoComplete="new-password" placeholder="Ripeti la password" value={confirm} onChange={(e) => setConfirm(e.target.value)} aria-invalid={mismatch} className="h-10 rounded-lg" />
          <div className="flex gap-2">
            <Button type="submit" className="rounded-lg" disabled={!valid || busy}>
              {busy && <LoaderCircle className="size-4 animate-spin" />}
              Salva
            </Button>
            <Button type="button" variant="ghost" className="rounded-lg" onClick={() => setOpen(false)}>
              Annulla
            </Button>
          </div>
          {(tooShort || mismatch) && <p className="text-xs text-warn sm:col-span-3">{tooShort ? "Almeno 10 caratteri." : "Le due password non coincidono."}</p>}
        </form>
      )}
    </div>
  )
}
