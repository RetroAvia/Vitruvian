import { Compass } from "lucide-react"
import Link from "next/link"

import { LogoMark } from "@/components/brand/logo"
import { Button } from "@/components/ui/button"

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <div className="glass-raised w-full max-w-md rounded-2xl p-8 text-center">
        <LogoMark className="mx-auto size-12" />
        <p className="mt-6 font-display text-5xl font-semibold text-gradient">404</p>
        <h1 className="mt-2 text-lg font-semibold">Pagina non trovata</h1>
        <p className="mt-1 text-sm text-muted-foreground">L&apos;indirizzo non esiste o è stato spostato.</p>
        <Button asChild className="mt-6 rounded-xl">
          <Link href="/dashboard">
            <Compass className="size-4" /> Torna alla dashboard
          </Link>
        </Button>
      </div>
    </main>
  )
}
