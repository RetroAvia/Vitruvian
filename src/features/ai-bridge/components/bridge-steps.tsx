"use client"

import { Check, ClipboardCopy, ClipboardPaste, Eraser, FileWarning, Sparkles } from "lucide-react"
import { useState, type ReactNode } from "react"
import { toast } from "sonner"

import { GlassCard } from "@/components/shared/glass-card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

export function StepCard({
  n,
  title,
  description,
  done,
  children,
  className,
}: {
  /** numero del passo; omesso quando la scheda è dentro un'altra procedura (Coach AI) */
  n?: number
  title: string
  description?: string
  done?: boolean
  children: ReactNode
  className?: string
}) {
  return (
    <GlassCard className={cn("p-5", className)}>
      <div className="mb-4 flex items-start gap-3">
        <span
          className={cn(
            "grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold ring-1 ring-inset",
            done ? "bg-gain/15 text-gain ring-gain/30" : "bg-neon/10 text-neon ring-neon/30",
          )}
          aria-hidden
        >
          {done ? <Check className="size-3.5" /> : (n ?? "›")}
        </span>
        <div>
          <h2 className="text-sm font-semibold">
            {n !== undefined && <span className="sr-only">Passo {n}: </span>}
            {title}
          </h2>
          {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
        </div>
      </div>
      {children}
    </GlassCard>
  )
}

export function PromptStep({ prompt, hint }: { prompt: string; hint: ReactNode }) {
  const [copied, setCopied] = useState(false)
  const [show, setShow] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(prompt)
      setCopied(true)
      toast.success("Prompt copiato", { description: "Incollalo nell'IA insieme al referto." })
      setTimeout(() => setCopied(false), 2500)
    } catch {
      toast.error("Copia non riuscita: seleziona il testo manualmente")
      setShow(true)
    }
  }

  return (
    <StepCard n={1} title="Copia il prompt" description="Istruzioni che obbligano l'IA a rispondere con dati strutturati" done={copied}>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => void copy()} className="rounded-xl">
          {copied ? <Check className="size-4" /> : <ClipboardCopy className="size-4" />}
          {copied ? "Copiato" : "Copia prompt"}
        </Button>
        <Button variant="ghost" className="rounded-xl text-xs" onClick={() => setShow((s) => !s)} aria-expanded={show}>
          {show ? "Nascondi" : "Mostra"} testo
        </Button>
      </div>
      <div className="mt-4 rounded-xl border border-neon/20 bg-neon/[0.04] p-3 text-xs leading-relaxed text-muted-foreground">
        <p className="mb-1 flex items-center gap-1.5 font-medium text-foreground">
          <Sparkles className="size-3.5 text-neon" /> Come fare
        </p>
        {hint}
      </div>
      {show && (
        <pre className="mt-4 max-h-80 overflow-auto whitespace-pre-wrap rounded-xl border bg-background/50 p-3 font-mono text-[11px] leading-relaxed">
          {prompt}
        </pre>
      )}
    </StepCard>
  )
}

export function PasteStep({
  value,
  onChange,
  status,
}: {
  value: string
  onChange: (v: string) => void
  status: { ok: boolean; message: string; issues?: string[] } | null
}) {
  async function paste() {
    try {
      onChange(await navigator.clipboard.readText())
    } catch {
      toast.error("Il browser non permette di leggere gli appunti: incolla con Ctrl+V")
    }
  }

  return (
    <StepCard n={2} title="Incolla la risposta" description="Copia tutta la risposta dell'IA e incollala qui" done={status?.ok}>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder='{ "schema": "vitruvian…", … }'
        spellCheck={false}
        aria-label="Risposta JSON dell'IA"
        aria-invalid={status ? !status.ok : undefined}
        className="h-56 resize-y rounded-xl font-mono text-xs leading-relaxed"
      />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" className="rounded-lg" onClick={() => void paste()}>
          <ClipboardPaste className="size-3.5" /> Incolla dagli appunti
        </Button>
        {value && (
          <Button variant="ghost" size="sm" className="rounded-lg text-muted-foreground" onClick={() => onChange("")}>
            <Eraser className="size-3.5" /> Svuota
          </Button>
        )}
      </div>
      {status && (
        <div
          role={status.ok ? "status" : "alert"}
          className={cn(
            "mt-4 rounded-xl border p-3 text-xs",
            status.ok ? "border-gain/30 bg-gain/[0.07] text-gain" : "border-destructive/30 bg-destructive/[0.07] text-destructive",
          )}
        >
          <p className="flex items-center gap-1.5 font-medium">
            {status.ok ? <Check className="size-3.5" /> : <FileWarning className="size-3.5" />}
            {status.message}
          </p>
          {status.issues && status.issues.length > 0 && (
            <ul className="mt-2 max-h-40 list-inside list-disc space-y-0.5 overflow-auto text-foreground/80">
              {status.issues.map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </StepCard>
  )
}
