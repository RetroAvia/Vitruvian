"use client"

import { CheckCircle2, LoaderCircle, Upload } from "lucide-react"
import Link from "next/link"
import { useMemo, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { NativeSelect } from "@/components/ui/native-select"
import { Skeleton } from "@/components/ui/skeleton"
import { useImportCheckups } from "@/features/checkups/api/mutations"
import { useBiaProtocols, useCheckups, useMeasurementSites } from "@/features/checkups/api/queries"
import { checkPlausibility, findPreviousCheckup } from "@/features/checkups/lib/plausibility"
import { toInputValue, type CheckupFormInput } from "@/features/checkups/schemas/checkup-form"
import { formatDate, formatNumber } from "@/lib/format"
import { playSound } from "@/lib/sound"
import { cn } from "@/lib/utils"
import type { Json } from "@/types/database.types"

import { useParsedImport } from "../lib/use-parsed-import"
import { buildCheckupPrompt } from "../prompts/checkup-prompt"
import { checkupImportSchema, normalizeCheckupInput, type CheckupImportItem } from "../schemas/checkup-import"
import { PasteStep, PromptStep, StepCard } from "./bridge-steps"

const LABELS = { checkups: "Visita", circumferences: "Circonferenza" }

function toFormInput(i: CheckupImportItem, protocolId: string): CheckupFormInput {
  const b = i.bia ?? {}
  return {
    checkup_date: i.checkup_date,
    weight_kg: toInputValue(i.weight_kg),
    protocol_id: protocolId,
    professional: "",
    notes: "",
    fat_mass_pct: toInputValue(b.fat_mass_pct),
    lean_mass_kg: toInputValue(b.lean_mass_kg),
    bmr_kcal: toInputValue(b.bmr_kcal),
    total_body_water_pct: toInputValue(b.total_body_water_pct),
    visceral_fat: toInputValue(b.visceral_fat),
    muscle_mass_kg: toInputValue(b.muscle_mass_kg),
    bone_mass_kg: toInputValue(b.bone_mass_kg),
    phase_angle_deg: toInputValue(b.phase_angle_deg),
    metabolic_age: toInputValue(b.metabolic_age),
    circumferences: Object.fromEntries(
      i.circumferences.map((c) => [c.side === "none" ? c.site : `${c.site}_${c.side}`, toInputValue(c.value_cm)]),
    ),
  }
}

export function CheckupBridge() {
  const sitesQ = useMeasurementSites()
  const protocolsQ = useBiaProtocols()
  const checkupsQ = useCheckups()
  const importM = useImportCheckups()

  const [text, setText] = useState("")
  const [protocolChoice, setProtocolChoice] = useState<string | null>(null)
  const [done, setDone] = useState<number | null>(null)

  const sites = useMemo(() => sitesQ.data ?? [], [sitesQ.data])
  const checkups = useMemo(() => checkupsQ.data ?? [], [checkupsQ.data])
  const prompt = useMemo(() => buildCheckupPrompt(sites), [sites])
  const parsed = useParsedImport(text, checkupImportSchema, normalizeCheckupInput, LABELS)

  const defaultProtocol = checkups[checkups.length - 1]?.protocol_id ?? protocolsQ.data?.[0]?.id ?? ""
  const protocolId = protocolChoice ?? defaultProtocol

  // Controlli semantici (oltre allo schema)
  const analysis = useMemo(() => {
    if (parsed.kind !== "ok") return null
    const codes = new Set(sites.map((s) => s.code))
    const errors: string[] = []
    const dates = new Set<string>()
    parsed.data.checkups.forEach((c, idx) => {
      if (dates.has(c.checkup_date)) errors.push(`Visita ${idx + 1}: data ${formatDate(c.checkup_date)} duplicata`)
      dates.add(c.checkup_date)
      c.circumferences.forEach((x) => {
        if (!codes.has(x.site)) errors.push(`Visita ${idx + 1}: sito "${x.site}" sconosciuto`)
      })
    })
    const rows = [...parsed.data.checkups]
      .sort((a, b) => a.checkup_date.localeCompare(b.checkup_date))
      .map((c) => {
        const existing = checkups.find((x) => x.checkup_date === c.checkup_date)
        const prev = findPreviousCheckup(checkups, c.checkup_date)
        const warnings = checkPlausibility(toFormInput(c, protocolId), prev).map((w) => w.message)
        return { c, existing, warnings }
      })
    return { errors, rows }
  }, [parsed, sites, checkups, protocolId])

  async function runImport() {
    if (parsed.kind !== "ok") return
    const payload = {
      schema: "vitruvian.checkups.v1",
      checkups: parsed.data.checkups.map((c) => ({
        ...c,
        source: "ai_import",
        bia: c.bia ? { ...c.bia, protocol_id: protocolId || null } : null,
      })),
    }
    try {
      const ids = await importM.mutateAsync(payload as unknown as Json)
      setDone(ids.length)
      setText("")
      playSound("success")
      toast.success(`${ids.length} ${ids.length === 1 ? "visita importata" : "visite importate"}`)
    } catch (e) {
      playSound("error")
      toast.error("Import non riuscito", { description: e instanceof Error ? e.message : undefined })
    }
  }

  if (sitesQ.isPending) return <Skeleton className="h-96 rounded-2xl" />

  const status =
    parsed.kind === "empty"
      ? null
      : parsed.kind === "error"
        ? { ok: false, message: parsed.message, issues: parsed.issues }
        : analysis && analysis.errors.length > 0
          ? { ok: false, message: "Ci sono dati da correggere", issues: analysis.errors }
          : {
              ok: true,
              message: `${parsed.data.checkups.length} ${parsed.data.checkups.length === 1 ? "visita riconosciuta" : "visite riconosciute"}`,
            }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <PromptStep
          prompt={prompt}
          hint={
            <ol className="list-inside list-decimal space-y-0.5">
              <li>Apri Gemini, ChatGPT o Claude e incolla il prompt.</li>
              <li>Allega il PDF o la foto del referto BIA o della scheda misure (anche più visite insieme).</li>
              <li>Copia tutta la risposta e incollala qui accanto.</li>
            </ol>
          }
        />
        <PasteStep
          value={text}
          onChange={(v) => {
            setText(v)
            setDone(null)
          }}
          status={status}
        />
      </div>

      {done !== null && (
        <StepCard n={4} title="Import completato" done>
          <p className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="size-4 text-gain" />
            {done} {done === 1 ? "visita salvata" : "visite salvate"}. Dashboard e trend sono già aggiornati.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button asChild className="rounded-xl">
              <Link href="/checkups">Vai alle visite</Link>
            </Button>
            <Button asChild variant="outline" className="rounded-xl">
              <Link href="/dashboard">Dashboard</Link>
            </Button>
          </div>
        </StepCard>
      )}

      {analysis && analysis.errors.length === 0 && (
        <StepCard n={3} title="Verifica e importa" description="Controlla i valori prima di salvarli">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
            <label htmlFor="bridge-protocol" className="text-xs text-muted-foreground">
              Strumento BIA delle visite importate
            </label>
            <NativeSelect
              id="bridge-protocol"
              value={protocolId}
              onChange={(e) => setProtocolChoice(e.target.value)}
              className="h-9 rounded-lg sm:w-64"
            >
              <option value="">Non specificato</option>
              {(protocolsQ.data ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </NativeSelect>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm tabular">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">Data</th>
                  <th className="py-2 pr-3 font-medium">Azione</th>
                  <th className="py-2 pr-3 text-right font-medium">Peso</th>
                  <th className="py-2 pr-3 text-right font-medium">MG %</th>
                  <th className="py-2 pr-3 text-right font-medium">Magra</th>
                  <th className="py-2 pr-3 text-right font-medium">BMR</th>
                  <th className="py-2 pr-3 text-right font-medium">Acqua</th>
                  <th className="py-2 pr-3 text-right font-medium">Visc.</th>
                  <th className="py-2 pr-3 text-right font-medium">Misure</th>
                </tr>
              </thead>
              <tbody>
                {analysis.rows.map(({ c, existing, warnings }) => (
                  <tr key={c.checkup_date} className="border-t align-top">
                    <td className="whitespace-nowrap py-2.5 pr-3 font-medium">{formatDate(c.checkup_date)}</td>
                    <td className="py-2.5 pr-3">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset",
                          existing ? "bg-bia/10 text-bia ring-bia/25" : "bg-gain/10 text-gain ring-gain/25",
                        )}
                      >
                        {existing ? "Aggiorna" : "Nuova"}
                      </span>
                      {warnings.map((w) => (
                        <p key={w} className="mt-1 max-w-56 text-[11px] text-warn">
                          ⚠ {w}
                        </p>
                      ))}
                    </td>
                    <td className="py-2.5 pr-3 text-right">{formatNumber(c.weight_kg, 1)}</td>
                    <td className="py-2.5 pr-3 text-right">{formatNumber(c.bia?.fat_mass_pct, 1)}</td>
                    <td className="py-2.5 pr-3 text-right">{formatNumber(c.bia?.lean_mass_kg, 1)}</td>
                    <td className="py-2.5 pr-3 text-right">{formatNumber(c.bia?.bmr_kcal, 0)}</td>
                    <td className="py-2.5 pr-3 text-right">{formatNumber(c.bia?.total_body_water_pct, 1)}</td>
                    <td className="py-2.5 pr-3 text-right">{formatNumber(c.bia?.visceral_fat, 1)}</td>
                    <td className="py-2.5 pr-3 text-right" title={c.circumferences.map((x) => `${x.site}: ${x.value_cm}`).join(", ")}>
                      {c.circumferences.length}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground">
            &ldquo;Aggiorna&rdquo; unisce i dati: i valori nuovi sostituiscono quelli esistenti, quelli assenti restano invariati.
          </p>

          <div className="mt-4 flex justify-end">
            <Button className="rounded-xl" onClick={() => void runImport()} disabled={importM.isPending}>
              {importM.isPending ? <LoaderCircle className="size-4 animate-spin" /> : <Upload className="size-4" />}
              Importa {analysis.rows.length} {analysis.rows.length === 1 ? "visita" : "visite"}
            </Button>
          </div>
        </StepCard>
      )}
    </div>
  )
}
