"use client"

import { useQueryClient } from "@tanstack/react-query"
import { CloudCheck, DatabaseBackup, FileDown, FileUp, LoaderCircle, ShieldCheck } from "lucide-react"
import { useRef, useState } from "react"
import { toast } from "sonner"

import { useSessionUser } from "@/components/layout/session-user-context"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { GlassCard } from "@/components/shared/glass-card"
import { Button } from "@/components/ui/button"
import { useProfile, useUpdateProfile } from "@/features/profile/api/profile"
import { daysBetween, formatDate, localDateISO, todayISO } from "@/lib/format"
import { useSound } from "@/lib/sound"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

import { createBackup, downloadJson, parseBackup, restoreBackup, type BackupFile } from "../lib/backup"

const LABELS: Record<string, string> = {
  checkups: "visite",
  lab_reports: "referti di laboratorio",
  medical_reports: "referti medici",
  supplements: "integratori",
  diet_plans: "piani alimentari",
  supplement_logs: "giorni di checklist integratori",
  meal_logs: "giorni di checklist pasti",
  training_plans: "schede di allenamento",
  workouts: "sessioni di allenamento",
}

export function BackupCard() {
  const user = useSessionUser()
  const profileQ = useProfile()
  const updateProfile = useUpdateProfile()
  const qc = useQueryClient()
  const play = useSound()
  const fileRef = useRef<HTMLInputElement>(null)

  const [exporting, setExporting] = useState<number | null>(null)
  const [pending, setPending] = useState<BackupFile | null>(null)
  const [restoring, setRestoring] = useState<string | null>(null)

  const last = profileQ.data?.last_backup_at ?? null
  const lastDays = last ? daysBetween(localDateISO(last), todayISO()) : null

  async function onExport() {
    setExporting(0)
    try {
      const b = await createBackup(createClient(), user.email, setExporting)
      downloadJson(b, `vitruvian-backup-${todayISO()}.json`)
      await updateProfile.mutateAsync({ last_backup_at: new Date().toISOString() }).catch(() => undefined)
      play("success")
      const total = Object.values(b.counts).reduce((a, n) => a + (n ?? 0), 0)
      toast.success("Backup scaricato", { description: `${total} record salvati nel file. Conservalo in un posto sicuro (es. Google Drive).` })
    } catch (e) {
      play("error")
      toast.error("Backup non riuscito", { description: e instanceof Error ? e.message : undefined })
    } finally {
      setExporting(null)
    }
  }

  async function onFile(file: File) {
    try {
      setPending(parseBackup(await file.text()))
    } catch (e) {
      play("error")
      toast.error("File non valido", { description: e instanceof Error ? e.message : undefined })
    } finally {
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  async function onRestore() {
    if (!pending) return
    try {
      const r = await restoreBackup(createClient(), pending, setRestoring)
      await qc.invalidateQueries()
      play("success")
      toast.success("Ripristino completato", {
        description: `${r.checkups} visite, ${r.labs} analisi, ${r.medical} referti, ${r.supplements} integratori, ${r.diets} diete, ${r.trainingPlans} schede, ${r.workouts} allenamenti${r.skippedDiets.length ? ` (${r.skippedDiets.length} già presenti)` : ""}.`,
      })
      setPending(null)
    } catch (e) {
      play("error")
      toast.error("Ripristino interrotto", { description: e instanceof Error ? e.message : undefined })
    } finally {
      setRestoring(null)
    }
  }

  return (
    <GlassCard id="backup" className="scroll-mt-24 p-5">
      <div className="mb-4 flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-neon/10 text-neon ring-1 ring-inset ring-neon/25">
          <DatabaseBackup className="size-4" />
        </span>
        <div>
          <h2 className="text-sm font-semibold">Salvataggio e backup</h2>
          <p className="text-xs text-muted-foreground">I tuoi dati sono nel cloud e sincronizzati su ogni dispositivo. Il backup è una copia in più, solo tua.</p>
        </div>
      </div>

      <ul className="mb-4 space-y-2 text-xs">
        <li className="flex gap-2">
          <CloudCheck className="mt-0.5 size-3.5 shrink-0 text-gain" />
          <span>
            <span className="font-medium">Salvataggio automatico:</span> ogni modifica va subito nel database (Supabase, UE – Francoforte): apri l&apos;app da telefono o PC e trovi gli stessi dati.
          </span>
        </li>
        <li className="flex gap-2">
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-gain" />
          <span>
            <span className="font-medium">Protezione:</span> connessione cifrata (HTTPS), dati cifrati a riposo, accesso consentito solo al tuo account da regole del database (RLS).
          </span>
        </li>
      </ul>

      <div
        className={cn(
          "mb-4 rounded-xl p-3 text-xs ring-1 ring-inset",
          lastDays === null || lastDays > 30 ? "bg-warn/[0.08] text-warn ring-warn/25" : "bg-gain/[0.07] text-gain ring-gain/20",
        )}
      >
        {last
          ? `Ultimo backup: ${formatDate(localDateISO(last), "long")}${lastDays && lastDays > 30 ? ` (${lastDays} giorni fa: è ora di farne uno nuovo)` : ""}`
          : "Non hai ancora scaricato un backup. Consigliato una volta al mese."}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button className="rounded-xl" onClick={() => void onExport()} disabled={exporting !== null}>
          {exporting !== null ? <LoaderCircle className="size-4 animate-spin" /> : <FileDown className="size-4" />}
          {exporting !== null ? `Preparazione… ${Math.round(exporting * 100)}%` : "Scarica backup completo"}
        </Button>
        <Button variant="outline" className="rounded-xl" onClick={() => fileRef.current?.click()} disabled={restoring !== null}>
          {restoring !== null ? <LoaderCircle className="size-4 animate-spin" /> : <FileUp className="size-4" />}
          {restoring !== null ? `Ripristino: ${restoring}…` : "Ripristina da file"}
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void onFile(f)
          }}
        />
      </div>
      <p className="mt-3 text-[11px] text-muted-foreground">
        Il file contiene dati sanitari: non condividerlo e conservalo in una cartella personale protetta.
      </p>

      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(o) => !o && restoring === null && setPending(null)}
        title="Ripristinare questo backup?"
        destructive={false}
        confirmLabel="Ripristina"
        pending={restoring !== null}
        onConfirm={onRestore}
        description={
          pending && (
            <div className="space-y-2 text-sm">
              <p>
                Backup del {formatDate(pending.exported_at.slice(0, 10), "long")}
                {pending.account && pending.account !== user.email ? ` (account ${pending.account})` : ""}:
              </p>
              <ul className="list-inside list-disc text-xs">
                {Object.entries(LABELS)
                  .filter(([k]) => (pending.counts[k as keyof typeof pending.counts] ?? 0) > 0)
                  .map(([k, label]) => (
                    <li key={k}>
                      {pending.counts[k as keyof typeof pending.counts]} {label}
                    </li>
                  ))}
              </ul>
              <p className="text-xs">
                Il ripristino <strong>aggiunge o aggiorna</strong> i dati, non cancella nulla di ciò che hai già. Le visite con la stessa data vengono
                aggiornate con i valori del backup.
              </p>
            </div>
          )
        }
      />
    </GlassCard>
  )
}
