import type { Metadata } from "next"

import { LoginForm } from "@/features/auth/components/login-form"

export const metadata: Metadata = { title: "Accedi" }

/** Accetta solo percorsi interni per il redirect post-login (niente open redirect). */
function safeNext(next: string | undefined) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard"
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; mfa?: string }>
}) {
  const { next, mfa } = await searchParams

  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <LoginForm next={safeNext(next)} mfa={mfa === "1"} />
    </main>
  )
}
