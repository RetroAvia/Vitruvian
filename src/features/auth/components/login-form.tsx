"use client"

import { ArrowRight, LoaderCircle, Lock, Mail, Smartphone } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, type FormEvent } from "react"
import { toast } from "sonner"

import { Logo } from "@/components/brand/logo"
import { GlassCard } from "@/components/shared/glass-card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase/client"

export function LoginForm({ next, mfa = false }: { next: string; mfa?: boolean }) {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [code, setCode] = useState("")
  const [step, setStep] = useState<"password" | "mfa">(mfa ? "mfa" : "password")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /** Secondo passaggio: codice TOTP dell'app di autenticazione. */
  async function onVerify(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setPending(true)
    setError(null)
    const client = createClient()
    const { data: factors, error: fe } = await client.auth.mfa.listFactors()
    const factor = factors?.totp.find((f) => f.status === "verified")
    if (fe || !factor) {
      setPending(false)
      setError(fe?.message ?? "Nessun dispositivo di verifica trovato.")
      return
    }
    const { error } = await client.auth.mfa.challengeAndVerify({ factorId: factor.id, code: code.trim() })
    if (error) {
      setPending(false)
      setCode("")
      setError("Codice non valido o scaduto. Usa il codice attuale dell'app.")
      return
    }
    router.replace(next)
    router.refresh()
  }

  async function cancelMfa() {
    await createClient().auth.signOut()
    setStep("password")
    setCode("")
    setError(null)
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setPending(true)
    setError(null)

    const { error } = await createClient().auth.signInWithPassword({ email: email.trim(), password })

    if (error) {
      setPending(false)
      const message =
        error.message === "Invalid login credentials" ? "Email o password non corretti." : error.message
      setError(message)
      toast.error("Accesso non riuscito", { description: message })
      return
    }

    // Verifica in due passaggi attiva → serve il codice prima di entrare
    const { data: aal } = await createClient().auth.mfa.getAuthenticatorAssuranceLevel()
    if (aal && aal.nextLevel === "aal2" && aal.currentLevel !== "aal2") {
      setPending(false)
      setStep("mfa")
      return
    }

    router.replace(next)
    router.refresh()
  }

  if (step === "mfa") {
    return (
      <div className="animate-page-in w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        <GlassCard className="relative overflow-hidden p-6 sm:p-7">
          <div aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-neon/70 to-transparent" />
          <span className="mb-4 grid size-11 place-items-center rounded-xl bg-neon/10 text-neon ring-1 ring-inset ring-neon/25">
            <Smartphone className="size-5" />
          </span>
          <h1 className="text-xl font-semibold">Verifica in due passaggi</h1>
          <p className="mt-1 text-sm text-muted-foreground">Inserisci il codice a 6 cifre dell&apos;app di autenticazione.</p>
          <form onSubmit={onVerify} className="mt-6 space-y-4" noValidate>
            <Input
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              aria-label="Codice di verifica"
              aria-invalid={Boolean(error) || undefined}
              className="h-12 rounded-xl text-center font-mono text-xl tracking-[0.5em]"
              placeholder="••••••"
            />
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <Button type="submit" disabled={pending || code.length !== 6} className="h-11 w-full rounded-xl font-semibold">
              {pending ? <LoaderCircle className="size-4 animate-spin" /> : "Verifica"}
            </Button>
            <button type="button" onClick={() => void cancelMfa()} className="w-full text-center text-xs text-muted-foreground hover:text-foreground">
              Usa un altro account
            </button>
          </form>
        </GlassCard>
      </div>
    )
  }

  return (
    <div className="animate-page-in w-full max-w-sm">
      <div className="mb-8 flex justify-center">
        <Logo />
      </div>

      <GlassCard className="relative overflow-hidden p-6 sm:p-7">
        <div aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-neon/70 to-transparent" />

        <h1 className="text-xl font-semibold">Bentornato</h1>
        <p className="mt-1 text-sm text-muted-foreground">Accedi per vedere i tuoi progressi.</p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11 rounded-xl pl-9"
                aria-invalid={Boolean(error) || undefined}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11 rounded-xl pl-9"
                aria-invalid={Boolean(error) || undefined}
                aria-describedby={error ? "login-error" : undefined}
              />
            </div>
          </div>

          {error && (
            <p id="login-error" role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <Button
            type="submit"
            disabled={pending || !email || !password}
            className="h-11 w-full rounded-xl font-semibold shadow-[0_0_28px_-8px_var(--neon)]"
          >
            {pending ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <>
                Accedi <ArrowRight className="size-4" />
              </>
            )}
          </Button>
        </form>
      </GlassCard>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        Accesso riservato · i tuoi dati sono visibili solo a te
      </p>
    </div>
  )
}
