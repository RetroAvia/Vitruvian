"use client"

import { ArrowRight, LoaderCircle, Lock, Mail } from "lucide-react"
import { m } from "motion/react"
import { useRouter } from "next/navigation"
import { useState, type FormEvent } from "react"
import { toast } from "sonner"

import { Logo } from "@/components/brand/logo"
import { GlassCard } from "@/components/shared/glass-card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase/client"

export function LoginForm({ next }: { next: string }) {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

    router.replace(next)
    router.refresh()
  }

  return (
    <m.div
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="w-full max-w-sm"
    >
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
    </m.div>
  )
}
