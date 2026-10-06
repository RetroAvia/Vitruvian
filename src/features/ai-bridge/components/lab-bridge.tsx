"use client"

import { CheckCircle2, LoaderCircle, Upload } from "lucide-react"
import Link from "next/link"
import { useMemo, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useImportLabReports, useLabAnalytes, useLabReports } from "@/features/labs/api/labs"
import { LabStatusBadge } from "@/features/labs/components/lab-status"
import { flagOf } from "@/features/labs/engine/status"
import { useProfile } from "@/features/profile/api/profile"
import { formatDate, formatNumber, isNum } from "@/lib/format"
import { playSound } from "@/lib/sound"
import { cn } from "@/lib/utils"

import { useParsedImport } from "../lib/use-parsed-import"
import { buildLabPrompt } from "../prompts/lab-prompt"
import { labImportSchema, normalizeCode, normalizeLabInput, sameUnit } from "../schemas/lab-import"
import { PasteStep, PromptStep, StepCard } from "./bridge-steps"

const LABELS = { reports: "Referto", results: "Esame" }

export function LabBridge() {
  const analytesQ = useLabAnalytes()
  const reportsQ = useLabReports()
  const profileQ = useProfile()
  const importM = useImportLabReports()

  const [text, setText] = useState("")
  const [done, setDone] = useState<number | null>(null)

  const analytes = useMemo(() => analytesQ.data ?? [], [analytesQ.data])
  const prompt = useMemo(() => buildLabPrompt(analytes), [analytes])
  const parsed = useParsedImport(text, labImportSchema, normalizeLabInput, LABELS)
  const female = profileQ.data?.sex === "female"

  const preview = useMemo(() => {
    if (parsed.kind !== "ok") return null
    const byCode = new Map(analytes.map((a) => [a.code, a]))
    return parsed.data.reports.map((r) => {
      const existing = (reportsQ.data ?? []).find(
        (x) => x.report_date === r.report_date && (x.lab_name ?? "") === (r.lab_name ?? ""),
      )
      const rows = r.results.map((res) => {
        const code = normalizeCode(res.code)
        const a = byCode.get(code)
        // Il range del laboratorio ha precedenza su quello generico del catalogo
        const labRange = res.ref_low != null || res.ref_high != null
        const low = labRange ? (res.ref_low ?? null) : a ? (female ? a.ref_low_f : a.ref_low_m) : null
        const high = labRange ? (res.ref_high ?? null) : a ? (female ? a.ref_high_f : a.ref_high_m) : null
        const warnings: string[] = []
        if (a && !sameUnit(res.unit, a.unit)) warnings.push(`unità ${res.unit} diversa da ${a.unit}: verifica la conversione`)
        const ref = isNum(high) ? high : isNum(low) ? low : null
        if (isNum(res.value) && isNum(ref) && ref > 0 && (res.value > ref * 10 || res.value < ref / 10)) {
          warnings.push("valore molto distante dal range: possibile unità errata")
        }
        return {
          key: `${code}-${res.value ?? res.value_text}`,
          code,
          name: a?.name ?? res.name ?? code,
          isNew: !a,
          value: res.value ?? null,
          valueText: res.value_text ?? null,
          unit: res.unit ?? a?.unit ?? null,
          low: low ?? null,
          high: high ?? null,
          digits: a?.digits ?? 2,
          flag: flagOf(res.value, low, high),
          warnings,
        }
      })
      return { r, existing, rows }
    })
  }, [parsed, analytes, reportsQ.data, female])

  async function runImport() {
    if (parsed.kind !== "ok") return
    try {
      const ids = await importM.mutateAsync({ ...parsed.data, schema: "vitruvian.labs.v1" })
      setDone(ids.length)
      setText("")
      playSound("success")
      toast.success(`${ids.length} ${ids.length === 1 ? "referto importato" : "referti importati"}`)
    } catch (e) {
      playSound("error")
      toast.error("Import non riuscito", { description: e instanceof Error ? e.message : undefined })
    }
  }

  if (analytesQ.isPending) return <Skeleton className="h-96 rounded-2xl" />

  const totalResults = parsed.kind === "ok" ? parsed.data.reports.reduce((n, r) => n + r.results.length, 0) : 0
  const status =
    parsed.kind === "empty"
      ? null
      : parsed.kind === "error"
        ? { ok: false, message: parsed.message, issues: parsed.issues }
        : {
            ok: true,
            message: `${parsed.data.reports.length} ${parsed.data.reports.length === 1 ? "referto" : "referti"} · ${totalResults} esami riconosciuti`,
          }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <PromptStep
          prompt={prompt}
          hint={
            <ol className="list-inside list-decimal space-y-0.5">
              <li>Apri Gemini, ChatGPT o Claude e incolla il prompt.</li>
              <li>Allega il PDF del laboratorio o le foto di tutte le pagine del referto.</li>
              <li>Copia la risposta e incollala qui. I valori arrivano già convertiti nelle unità dell&apos;app.</li>
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
            {done} {done === 1 ? "referto salvato" : "referti salvati"}: statistiche e tendenze sono aggiornate.
          </p>
          <Button asChild className="mt-4 rounded-xl">
            <Link href="/labs">Vai alle analisi</Link>
          </Button>
        </StepCard>
      )}

      {preview && (
        <StepCard n={3} title="Verifica e importa" description="Controlla nomi, valori e unità prima di salvare">
          <div className="space-y-6">
            {preview.map(({ r, existing, rows }) => (
              <div key={`${r.report_date}-${r.lab_name}`}>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold">{formatDate(r.report_date, "long")}</p>
                  <span className="text-xs text-muted-foreground">
                    {r.lab_name ?? "Laboratorio non indicato"}
                    {r.fasting === true && " · a digiuno"} · {rows.length} esami
                  </span>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset",
                      existing ? "bg-bia/10 text-bia ring-bia/25" : "bg-gain/10 text-gain ring-gain/25",
                    )}
                  >
                    {existing ? "Aggiorna referto esistente" : "Nuovo referto"}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[620px] text-sm tabular">
                    <thead>
                      <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                        <th className="py-2 pr-3 font-medium">Esame</th>
                        <th className="py-2 pr-3 text-right font-medium">Valore</th>
                        <th className="py-2 pr-3 text-right font-medium">Range</th>
                        <th className="py-2 pr-3 font-medium">Stato</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((x) => (
                        <tr key={x.key} className="border-t align-top">
                          <td className="py-2 pr-3">
                            <p className="font-medium">{x.name}</p>
                            {x.isNew && <p className="text-[11px] text-bia">Nuovo esame ({x.code}): verrà aggiunto al catalogo</p>}
                            {x.warnings.map((w) => (
                              <p key={w} className="text-[11px] text-warn">
                                ⚠ {w}
                              </p>
                            ))}
                          </td>
                          <td className="whitespace-nowrap py-2 pr-3 text-right">
                            {isNum(x.value) ? formatNumber(x.value, x.digits) : x.valueText}
                            {x.unit && isNum(x.value) && <span className="ml-1 text-xs text-muted-foreground">{x.unit}</span>}
                          </td>
                          <td className="whitespace-nowrap py-2 pr-3 text-right text-muted-foreground">
                            {isNum(x.low) && isNum(x.high)
                              ? `${formatNumber(x.low, x.digits)}–${formatNumber(x.high, x.digits)}`
                              : isNum(x.high)
                                ? `< ${formatNumber(x.high, x.digits)}`
                                : isNum(x.low)
                                  ? `> ${formatNumber(x.low, x.digits)}`
                                  : "—"}
                          </td>
                          <td className="py-2 pr-3">
                            <LabStatusBadge flag={x.flag} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 flex justify-end">
            <Button className="rounded-xl" onClick={() => void runImport()} disabled={importM.isPending}>
              {importM.isPending ? <LoaderCircle className="size-4 animate-spin" /> : <Upload className="size-4" />}
              Importa {totalResults} esami
            </Button>
          </div>
        </StepCard>
      )}
    </div>
  )
}
