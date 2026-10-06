"use client"

import { RotateCcw, TriangleAlert } from "lucide-react"
import { useEffect } from "react"

import { EmptyState } from "@/components/shared/empty-state"
import { Button } from "@/components/ui/button"

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <EmptyState
      icon={TriangleAlert}
      title="Qualcosa è andato storto"
      description={error.message || "Errore imprevisto durante il caricamento della pagina."}
      action={
        <Button onClick={reset} variant="outline" className="rounded-xl">
          <RotateCcw className="size-4" /> Riprova
        </Button>
      }
    />
  )
}
