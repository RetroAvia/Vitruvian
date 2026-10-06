"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { LoaderCircle, MoreHorizontal, Pencil, Plus, ScanLine, Trash2 } from "lucide-react"
import { useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { FormField } from "@/components/shared/form-field"
import { GlassCard } from "@/components/shared/glass-card"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { useBiaProtocols, useCheckups } from "@/features/checkups/api/queries"
import { formatDate } from "@/lib/format"
import { playSound } from "@/lib/sound"
import type { BiaProtocol } from "@/types/domain"

import { useDeleteProtocol, useSaveProtocol } from "../api/protocols"

const protocolSchema = z
  .object({
    name: z.string().trim().min(1, "Il nome è obbligatorio").max(80, "Massimo 80 caratteri"),
    device: z.string().trim().max(120),
    location: z.string().trim().max(120),
    lean_mass_definition: z.string().trim().max(160),
    active_from: z.string(),
    active_to: z.string(),
    notes: z.string().trim().max(1000),
  })
  .refine((v) => !v.active_from || !v.active_to || v.active_to >= v.active_from, {
    path: ["active_to"],
    message: "La fine deve essere successiva all'inizio",
  })

type ProtocolFormValues = z.infer<typeof protocolSchema>

function toForm(p?: BiaProtocol): ProtocolFormValues {
  return {
    name: p?.name ?? "",
    device: p?.device ?? "",
    location: p?.location ?? "",
    lean_mass_definition: p?.lean_mass_definition ?? "",
    active_from: p?.active_from ?? "",
    active_to: p?.active_to ?? "",
    notes: p?.notes ?? "",
  }
}

export function ProtocolsCard() {
  const protocolsQ = useBiaProtocols()
  const checkupsQ = useCheckups()
  const del = useDeleteProtocol()

  const [editing, setEditing] = useState<BiaProtocol | "new" | null>(null)
  const [deleting, setDeleting] = useState<BiaProtocol | null>(null)

  // Statistiche d'uso per protocollo
  const usage = useMemo(() => {
    const map = new Map<string, { count: number; first: string; last: string }>()
    for (const c of checkupsQ.data ?? []) {
      if (!c.protocol_id) continue
      const u = map.get(c.protocol_id)
      if (!u) map.set(c.protocol_id, { count: 1, first: c.checkup_date, last: c.checkup_date })
      else {
        u.count += 1
        if (c.checkup_date < u.first) u.first = c.checkup_date
        if (c.checkup_date > u.last) u.last = c.checkup_date
      }
    }
    return map
  }, [checkupsQ.data])

  async function confirmDelete() {
    if (!deleting) return
    try {
      await del.mutateAsync(deleting.id)
      playSound("success")
      toast.success("Protocollo eliminato")
      setDeleting(null)
    } catch (e) {
      playSound("error")
      toast.error("Eliminazione non riuscita", { description: e instanceof Error ? e.message : undefined })
    }
  }

  return (
    <GlassCard className="p-5 sm:p-6">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-xl bg-bia/10 text-bia ring-1 ring-inset ring-bia/25">
            <ScanLine className="size-4" />
          </span>
          <div>
            <h2 className="text-base font-semibold">Strumenti BIA</h2>
            <p className="text-xs text-muted-foreground">
              Ogni strumento ha la sua scala: i trend BIA si confrontano solo all&apos;interno dello stesso.
            </p>
          </div>
        </div>
        <Button size="sm" variant="outline" className="rounded-xl" onClick={() => setEditing("new")}>
          <Plus className="size-4" /> Nuovo
        </Button>
      </div>

      {protocolsQ.isPending ? (
        <Skeleton className="h-32 rounded-xl" />
      ) : (protocolsQ.data ?? []).length === 0 ? (
        <p className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
          Nessuno strumento registrato.
        </p>
      ) : (
        <ul className="space-y-2">
          {(protocolsQ.data ?? []).map((p) => {
            const u = usage.get(p.id)
            return (
              <li key={p.id} className="flex items-start gap-3 rounded-xl surface-inset px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{p.name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {u
                      ? `${u.count} ${u.count === 1 ? "visita" : "visite"} · ${formatDate(u.first)} → ${formatDate(u.last)}`
                      : "Nessuna visita collegata"}
                    {p.device && ` · ${p.device}`}
                  </p>
                  {p.lean_mass_definition && (
                    <p className="mt-1 text-xs text-muted-foreground/80">
                      &ldquo;Massa magra&rdquo; = {p.lean_mass_definition}
                    </p>
                  )}
                </div>
                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="size-8 rounded-lg" aria-label={`Azioni ${p.name}`}>
                      <MoreHorizontal className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => setEditing(p)}>
                      <Pencil /> Modifica
                    </DropdownMenuItem>
                    <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(p)}>
                      <Trash2 /> Elimina
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </li>
            )
          })}
        </ul>
      )}

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg">
          {editing !== null && (
            <ProtocolForm
              key={editing === "new" ? "new" : editing.id}
              protocol={editing === "new" ? undefined : editing}
              onDone={() => setEditing(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleting !== null} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare &ldquo;{deleting?.name}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting && usage.get(deleting.id)
                ? `Le ${usage.get(deleting.id)?.count} visite collegate non verranno eliminate, ma resteranno senza strumento: i loro delta BIA non saranno più separati.`
                : "Nessuna visita è collegata a questo strumento."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Annulla</AlertDialogCancel>
            <Button variant="destructive" className="rounded-xl" onClick={() => void confirmDelete()} disabled={del.isPending}>
              {del.isPending && <LoaderCircle className="size-4 animate-spin" />}
              Elimina
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </GlassCard>
  )
}

function ProtocolForm({ protocol, onDone }: { protocol?: BiaProtocol; onDone: () => void }) {
  const save = useSaveProtocol()
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ProtocolFormValues>({ resolver: zodResolver(protocolSchema), defaultValues: toForm(protocol), mode: "onTouched" })

  const onSubmit = handleSubmit(async (v) => {
    try {
      await save.mutateAsync({
        id: protocol?.id,
        values: {
          name: v.name,
          device: v.device || null,
          location: v.location || null,
          lean_mass_definition: v.lean_mass_definition || null,
          active_from: v.active_from || null,
          active_to: v.active_to || null,
          notes: v.notes || null,
        },
      })
      playSound("success")
      toast.success(protocol ? "Strumento aggiornato" : "Strumento creato")
      onDone()
    } catch (e) {
      playSound("error")
      toast.error("Salvataggio non riuscito", { description: e instanceof Error ? e.message : undefined })
    }
  })

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <DialogHeader>
        <DialogTitle>{protocol ? "Modifica strumento" : "Nuovo strumento BIA"}</DialogTitle>
        <DialogDescription>Bilancia o impedenziometro usato durante le visite.</DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="pr-name" label="Nome" error={errors.name?.message} className="sm:col-span-2">
          <Input id="pr-name" className="h-10 rounded-lg" autoFocus {...register("name")} />
        </FormField>
        <FormField id="pr-device" label="Modello" error={errors.device?.message}>
          <Input id="pr-device" className="h-10 rounded-lg" placeholder="Es. Tanita MC-780" {...register("device")} />
        </FormField>
        <FormField id="pr-location" label="Studio" error={errors.location?.message}>
          <Input id="pr-location" className="h-10 rounded-lg" {...register("location")} />
        </FormField>
        <FormField
          id="pr-lean"
          label="Cosa indica &ldquo;massa magra&rdquo; sul referto"
          error={errors.lean_mass_definition?.message}
          className="sm:col-span-2"
        >
          <Input
            id="pr-lean"
            className="h-10 rounded-lg"
            placeholder="Es. Massa muscolare scheletrica / Fat-Free Mass"
            {...register("lean_mass_definition")}
          />
        </FormField>
        <FormField id="pr-from" label="In uso dal" error={errors.active_from?.message}>
          <Input id="pr-from" type="date" className="h-10 rounded-lg" {...register("active_from")} />
        </FormField>
        <FormField id="pr-to" label="Fino al" error={errors.active_to?.message}>
          <Input id="pr-to" type="date" className="h-10 rounded-lg" {...register("active_to")} />
        </FormField>
        <FormField id="pr-notes" label="Note" error={errors.notes?.message} className="sm:col-span-2">
          <Textarea id="pr-notes" rows={2} className="rounded-lg" {...register("notes")} />
        </FormField>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" className="rounded-xl" onClick={onDone}>
          Annulla
        </Button>
        <Button type="submit" className="rounded-xl" disabled={isSubmitting}>
          {isSubmitting && <LoaderCircle className="size-4 animate-spin" />}
          Salva
        </Button>
      </DialogFooter>
    </form>
  )
}
