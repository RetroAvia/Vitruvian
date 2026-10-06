"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Activity, CalendarDays, ChevronDown, LoaderCircle, Ruler, ScanLine, TriangleAlert } from "lucide-react"
import Link from "next/link"
import { useMemo, useState, type KeyboardEvent } from "react"
import { useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"

import { FormField, FormSection, NumberInput } from "@/components/shared/form-field"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { NativeSelect } from "@/components/ui/native-select"
import { Textarea } from "@/components/ui/textarea"
import { CORE_SITES } from "@/config/constants"
import { bmi, fatFreeMassKg, fatMassKg, ffmi, ratio } from "@/features/biometrics/engine/indices"
import { formatDate, formatNumber } from "@/lib/format"
import { playSound } from "@/lib/sound"
import { cn } from "@/lib/utils"
import type { BiaProtocol, Checkup, MeasurementSite } from "@/types/domain"

import { useSaveCheckup } from "../api/mutations"
import { checkPlausibility, findPreviousCheckup } from "../lib/plausibility"
import {
  BIA_PRIMARY_FIELDS,
  BIA_SECONDARY_FIELDS,
  checkupFormSchema,
  checkupToFormInput,
  formValuesToPayload,
  parseDecimal,
  parseSiteKey,
  type CheckupFormInput,
  type CheckupFormValues,
} from "../schemas/checkup-form"

interface CheckupFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Visita da modificare; assente = nuova visita */
  checkup?: Checkup
  checkups: Checkup[]
  sites: MeasurementSite[]
  protocols: BiaProtocol[]
  heightCm: number | null
}

export function CheckupFormDialog({ open, onOpenChange, checkup, ...rest }: CheckupFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[92dvh] max-w-3xl flex-col gap-0 overflow-hidden p-0"
        // evita di perdere i dati con un click fuori dalla finestra
        onInteractOutside={(e) => e.preventDefault()}
      >
        {open && (
          <CheckupForm
            key={checkup?.id ?? "new"}
            checkup={checkup}
            onDone={() => onOpenChange(false)}
            onCancel={() => onOpenChange(false)}
            {...rest}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

interface CheckupFormProps extends Omit<CheckupFormDialogProps, "open" | "onOpenChange"> {
  onDone: () => void
  onCancel: () => void
}

function CheckupForm({ checkup, checkups, sites, protocols, heightCm, onDone, onCancel }: CheckupFormProps) {
  const isEdit = Boolean(checkup)
  const save = useSaveCheckup()

  const defaultValues = useMemo(() => {
    const latest = checkups[checkups.length - 1]
    return checkupToFormInput(checkup, { protocolId: latest?.protocol_id ?? protocols[0]?.id ?? null })
  }, [checkup, checkups, protocols])

  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CheckupFormInput, unknown, CheckupFormValues>({
    resolver: zodResolver(checkupFormSchema),
    defaultValues,
    mode: "onTouched",
  })

  const values = useWatch({ control }) as CheckupFormInput

  /* ---------- Siti di misura da mostrare ---------- */
  const siteLabel = useMemo(() => new Map(sites.map((s) => [s.code, s.label])), [sites])
  const siteRows = useMemo(() => {
    const existing = Object.keys(defaultValues.circumferences)
    const rows = sites.map((s) => ({
      key: s.code,
      label: s.label,
      primary: (CORE_SITES as readonly string[]).includes(s.code) || existing.includes(s.code),
    }))
    for (const key of existing) {
      const { site, side } = parseSiteKey(key)
      if (side === "none") continue
      rows.push({ key, label: `${siteLabel.get(site) ?? site} (${side === "left" ? "sx" : "dx"})`, primary: true })
    }
    return rows
  }, [sites, siteLabel, defaultValues.circumferences])

  const hasSecondaryBia = BIA_SECONDARY_FIELDS.some((f) => defaultValues[f.name] !== "")
  const [showMoreBia, setShowMoreBia] = useState(hasSecondaryBia)
  const [showAllSites, setShowAllSites] = useState(false)
  const visibleSites = siteRows.filter((r) => r.primary || showAllSites)
  const hiddenSitesCount = siteRows.length - siteRows.filter((r) => r.primary).length

  /* ---------- Plausibilità e anteprima calcoli (in tempo reale) ---------- */
  const prev = useMemo(
    () => findPreviousCheckup(checkups, values.checkup_date || "9999-12-31", checkup?.id),
    [checkups, values.checkup_date, checkup?.id],
  )
  const warnings = useMemo(() => checkPlausibility(values, prev), [values, prev])
  const warningFor = (field: string) => warnings.find((w) => w.field === field)?.message

  const weight = parseDecimal(values.weight_kg)
  const fatPct = parseDecimal(values.fat_mass_pct)
  const waist = parseDecimal(values.circumferences?.waist)
  const abdomen = parseDecimal(values.circumferences?.abdomen)
  const ffm = fatFreeMassKg(weight, fatPct)
  const preview = [
    { label: "Massa grassa", value: fatMassKg(weight, fatPct), unit: "kg", digits: 1 },
    { label: "FFM", value: ffm, unit: "kg", digits: 1 },
    { label: "FFMI", value: ffmi(ffm, heightCm), unit: "", digits: 1 },
    { label: "BMI", value: bmi(weight, heightCm), unit: "", digits: 1 },
    { label: "Vita/altezza", value: ratio(waist, heightCm), unit: "", digits: 3 },
    { label: "Vita/addome", value: ratio(waist, abdomen), unit: "", digits: 3 },
  ]

  /* ---------- Salvataggio ---------- */
  const onSubmit = handleSubmit(
    async (v) => {
      try {
        await save.mutateAsync(formValuesToPayload(v, checkup?.id ?? null))
        playSound("success")
        toast.success(isEdit ? "Visita aggiornata" : "Visita salvata", {
          description: formatDate(v.checkup_date, "long"),
        })
        onDone()
      } catch (e) {
        const message = e instanceof Error ? e.message : "Errore sconosciuto"
        if (message.startsWith("Esiste già")) setError("checkup_date", { message })
        playSound("error")
        toast.error("Salvataggio non riuscito", { description: message })
      }
    },
    () => toast.error("Controlla i campi evidenziati"),
  )

  function onKeyDown(e: KeyboardEvent<HTMLFormElement>) {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      void onSubmit()
    }
  }

  const err = (name: string) => {
    const path = name.split(".")
    let node: unknown = errors
    for (const p of path) node = (node as Record<string, unknown> | undefined)?.[p]
    return (node as { message?: string } | undefined)?.message
  }

  const numberField = (name: string, label: string, unit?: string) => {
    const id = `f-${name.replace(".", "-")}`
    const error = err(name)
    const warning = warningFor(name)
    return (
      <FormField key={name} id={id} label={label} error={error} warning={warning}>
        <NumberInput
          id={id}
          unit={unit}
          invalid={Boolean(error)}
          warned={Boolean(warning)}
          placeholder="—"
          {...register(name as `circumferences.${string}`)}
        />
      </FormField>
    )
  }

  return (
    <form onSubmit={onSubmit} onKeyDown={onKeyDown} noValidate className="flex min-h-0 flex-1 flex-col">
      {/* Header */}
      <DialogHeader className="border-b px-6 pb-4 pt-6">
        <DialogTitle>{isEdit ? "Modifica visita" : "Nuova visita"}</DialogTitle>
        <DialogDescription>
          {isEdit && checkup
            ? `Controllo del ${formatDate(checkup.checkup_date, "long")}`
            : "Compila solo i campi presenti nel referto: tutto il resto è facoltativo."}
        </DialogDescription>
      </DialogHeader>

      {/* Corpo scrollabile */}
      <div className="min-h-0 flex-1 space-y-8 overflow-y-auto px-6 py-6">
        <FormSection title="Visita" icon={<CalendarDays />}>
          <div className="grid gap-4 sm:grid-cols-3">
            <FormField id="f-date" label="Data" error={err("checkup_date")}>
              <Input
                id="f-date"
                type="date"
                className="h-10 rounded-lg"
                aria-invalid={Boolean(err("checkup_date")) || undefined}
                {...register("checkup_date")}
              />
            </FormField>
            {numberField("weight_kg", "Peso", "kg")}
            <FormField
              id="f-protocol"
              label="Strumento BIA"
              hint={
                protocols.length === 0 ? (
                  <Link href="/settings" className="underline underline-offset-2">
                    Crea un protocollo
                  </Link>
                ) : undefined
              }
            >
              <NativeSelect id="f-protocol" className="h-10 rounded-lg" {...register("protocol_id")}>
                <option value="">Non specificato</option>
                {protocols.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
          </div>
          {prev && (
            <p className="text-xs text-muted-foreground">
              Visita precedente: {formatDate(prev.checkup_date, "long")}
              {prev.weight_kg !== null && ` · ${formatNumber(prev.weight_kg, 1)} kg`}
            </p>
          )}
        </FormSection>

        <FormSection
          title="Composizione corporea"
          description="Valori del referto BIA"
          icon={<ScanLine />}
          action={
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground"
              onClick={() => setShowMoreBia((s) => !s)}
              aria-expanded={showMoreBia}
            >
              {showMoreBia ? "Meno parametri" : "Altri parametri"}
              <ChevronDown className={cn("size-3.5 transition-transform", showMoreBia && "rotate-180")} />
            </Button>
          }
        >
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {BIA_PRIMARY_FIELDS.map((f) => numberField(f.name, f.label, f.unit || undefined))}
          </div>
          {/* Apertura animata solo con CSS (grid-template-rows 0fr → 1fr) */}
          <div
            className={cn(
              "grid transition-[grid-template-rows,opacity] duration-300 ease-out",
              showMoreBia ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
            )}
            aria-hidden={!showMoreBia}
            inert={!showMoreBia}
          >
            <div className="overflow-hidden">
              <div className="grid grid-cols-2 gap-4 pt-1 sm:grid-cols-4">
                {BIA_SECONDARY_FIELDS.map((f) => numberField(f.name, f.label, f.unit || undefined))}
              </div>
            </div>
          </div>
        </FormSection>

        <FormSection
          title="Circonferenze"
          description="Centimetri"
          icon={<Ruler />}
          action={
            hiddenSitesCount > 0 ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground"
                onClick={() => setShowAllSites((s) => !s)}
                aria-expanded={showAllSites}
              >
                {showAllSites ? "Solo principali" : `Altri siti (${hiddenSitesCount})`}
                <ChevronDown className={cn("size-3.5 transition-transform", showAllSites && "rotate-180")} />
              </Button>
            ) : undefined
          }
        >
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {visibleSites.map((r) => numberField(`circumferences.${r.key}`, r.label, "cm"))}
          </div>
        </FormSection>

        {/* Anteprima calcoli */}
        <section className="rounded-xl border border-neon/20 bg-neon/[0.04] p-4">
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-neon">
            <Activity className="size-3.5" /> Calcolo in tempo reale
          </div>
          <dl className="grid grid-cols-3 gap-x-4 gap-y-3 sm:grid-cols-6">
            {preview.map((p) => (
              <div key={p.label}>
                <dt className="text-[11px] text-muted-foreground">{p.label}</dt>
                <dd className="font-display text-base font-semibold tabular">
                  {formatNumber(p.value, p.digits)}
                  {p.unit && p.value !== null && <span className="ml-0.5 text-xs text-muted-foreground">{p.unit}</span>}
                </dd>
              </div>
            ))}
          </dl>
          {heightCm === null && (
            <p className="mt-3 text-xs text-muted-foreground">
              Imposta l&apos;altezza in{" "}
              <Link href="/settings" className="underline underline-offset-2">
                Impostazioni
              </Link>{" "}
              per calcolare BMI, FFMI e rapporto vita/altezza.
            </p>
          )}
        </section>

        <FormSection title="Note">
          <div className="grid gap-4 sm:grid-cols-3">
            <FormField id="f-professional" label="Professionista" error={err("professional")}>
              <Input id="f-professional" className="h-10 rounded-lg" placeholder="Es. Dott. Rossi" {...register("professional")} />
            </FormField>
            <FormField id="f-notes" label="Note" error={err("notes")} className="sm:col-span-2">
              <Textarea id="f-notes" rows={2} className="rounded-lg" placeholder="Allenamento, condizioni, osservazioni…" {...register("notes")} />
            </FormField>
          </div>
        </FormSection>
      </div>

      {/* Footer */}
      <div className="flex flex-col gap-3 border-t bg-popover/80 px-6 py-4 backdrop-blur sm:flex-row sm:items-center">
        <div className="min-h-5 flex-1 text-xs">
          {warnings.length > 0 ? (
            <span className="flex items-center gap-1.5 text-warn">
              <TriangleAlert className="size-3.5" />
              {warnings.length === 1 ? "1 valore insolito" : `${warnings.length} valori insoliti`}: verifica prima di salvare
            </span>
          ) : (
            <span className="hidden text-muted-foreground sm:inline">Ctrl + Invio per salvare</span>
          )}
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <Button type="button" variant="outline" className="rounded-xl" onClick={onCancel}>
            Annulla
          </Button>
          <Button type="submit" className="rounded-xl" disabled={isSubmitting}>
            {isSubmitting && <LoaderCircle className="size-4 animate-spin" />}
            {isEdit ? "Salva modifiche" : "Salva visita"}
          </Button>
        </div>
      </div>
    </form>
  )
}
