"use client"

import { LoaderCircle, Trash2 } from "lucide-react"
import { toast } from "sonner"

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
import { formatDate, formatNumber } from "@/lib/format"
import type { Checkup } from "@/types/domain"

import { useDeleteCheckup, useSaveCheckup } from "../api/mutations"
import { checkupToPayload } from "../schemas/checkup-form"

function safePayload(c: Checkup) {
  try {
    return checkupToPayload(c)
  } catch {
    return null
  }
}

interface Props {
  checkup: Checkup | null
  onOpenChange: (open: boolean) => void
}

export function DeleteCheckupDialog({ checkup, onOpenChange }: Props) {
  const del = useDeleteCheckup()
  const save = useSaveCheckup()

  const sitesCount =
    checkup?.all_sites && typeof checkup.all_sites === "object" && !Array.isArray(checkup.all_sites)
      ? Object.keys(checkup.all_sites).length
      : 0
  const hasBia = checkup ? checkup.fat_mass_pct !== null || checkup.bmr_kcal !== null : false

  async function confirm() {
    if (!checkup) return
    // Prepara il ripristino PRIMA di eliminare
    const restore = safePayload(checkup)

    try {
      await del.mutateAsync(checkup.id)
      onOpenChange(false)
      toast.success("Visita eliminata", {
        description: formatDate(checkup.checkup_date, "long"),
        duration: 8000,
        action: restore
          ? {
              label: "Annulla",
              onClick: () => {
                save.mutate(restore, {
                  onSuccess: () => toast.success("Visita ripristinata"),
                  onError: (e) => toast.error("Ripristino non riuscito", { description: e.message }),
                })
              },
            }
          : undefined,
      })
    } catch (e) {
      toast.error("Eliminazione non riuscita", { description: e instanceof Error ? e.message : undefined })
    }
  }

  return (
    <AlertDialog open={checkup !== null} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="mb-1 grid size-11 place-items-center rounded-xl bg-destructive/10 text-destructive ring-1 ring-inset ring-destructive/25">
            <Trash2 className="size-5" />
          </div>
          <AlertDialogTitle>Eliminare questa visita?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                Stai per eliminare il controllo del{" "}
                <strong className="text-foreground">{checkup ? formatDate(checkup.checkup_date, "long") : ""}</strong>
                {checkup?.weight_kg != null && ` (${formatNumber(checkup.weight_kg, 1)} kg)`}.
              </p>
              <ul className="list-inside list-disc text-xs">
                {hasBia && <li>lettura BIA completa</li>}
                {sitesCount > 0 && <li>{sitesCount === 1 ? "1 circonferenza" : `${sitesCount} circonferenze`}</li>}
              </ul>
              <p className="text-xs">Potrai annullare per qualche secondo dalla notifica.</p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="rounded-xl">Annulla</AlertDialogCancel>
          <Button variant="destructive" className="rounded-xl" onClick={() => void confirm()} disabled={del.isPending}>
            {del.isPending && <LoaderCircle className="size-4 animate-spin" />}
            Elimina
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
