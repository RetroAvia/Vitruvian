"use client"

import { CheckCircle2, LoaderCircle, Upload } from "lucide-react"
import Link from "next/link"
import { useMemo, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { MEDICAL_KIND_LABELS } from "@/config/constants"
import { LabStatusBadge } from "@/features/labs/components/lab-status"
import { useImportMedicalReports, useMedicalReports } from "@/features/medical/api/medical"
import { OutcomeBadge } from "@/features/medical/components/outcome-badge"
import { MEASURE_BY_CODE } from "@/features/medical/engine/catalog"
import { measureDigits, measureFlag, measureRange } from "@/features/medical/engine/analysis"
import { useProfile } from "@/features/profile/api/profile"
import { useSound } from "@/lib/sound"
import { formatDate, formatNumber, isNum } from "@/lib/format"
import { cn } from "@/lib/utils"

import { useParsedImport } from "../lib/use-parsed-import"
import { buildMedicalPrompt } from "../prompts/medical-prompt"
import { medicalImportSchema, normalizeMedicalInput } from "../schemas/medical-import"
import { normalizeCode } from "../schemas/lab-import"
import { PasteStep, PromptStep, StepCard } from "./bridge-steps"

const LABELS = { reports: "Referto", measurements: "Misura" }

export function MedicalBridge() {
  const reportsQ = useMedicalReports()
  const profileQ = useProfile()
  const importM = useImportMedicalReports()
  const play = useSound()

  const [text, setText] = useState("")
  const [done, setDone] = useState<number | null>(null)

  const prompt = useMemo(() => buildMedicalPrompt(), [])
  const parsed = useParsedImport(text, medicalImportSchema, normalizeMedicalInput, LABELS)
  const sex = profileQ.data?.sex ?? null

  const preview = useMemo(() => {
    if (parsed.kind !== "ok") return null
    return parsed.data.reports.map((r) => {
      const existing = (reportsQ.data ?? []).find(
        (x) => x.report_date === r.report_date && x.kind === r.kind && x.title.toLowerCase() === r.title.toLowerCase(),
      )
      const rows = (r.measurements ?? []).map((m) => {
        const code = normalizeCode(m.code)
        const mm = { ...m, value: m.value ?? null, code, label: m.label ?? MEASURE_BY_CODE.get(code)?.label ?? code }
        const range = measureRange(mm, sex)
        return { ...mm, known: MEASURE_BY_CODE.has(code), flag: measureFlag(mm, sex), range, digits: measureDigits(code) }
      })
      return { r, existing, rows }
    })
  }, [parsed, reportsQ.data, sex])

  async function runImport() {
    if (parsed.kind !== "ok") return
    try {
      const payload = {
        ...parsed.data,
        schema: "vitruvian.medical.v1",
        reports: parsed.data.reports.map((r) => ({
          ...r,
          measurements: (r.measurements ?? []).map((m) => ({ ...m, code: normalizeCode(m.code) })),
        })),
      }
      const ids = await importM.mutateAsync(payload)
      setDone(ids.length)
      setText("")
      play("success")
      toast.success(`${ids.length} ${ids.length === 1 ? "referto importato" : "referti importati"}`)
    } catch (e) {
      play("error")
      toast.error("Import non riuscito", { description: e instanceof Error ? e.message : undefined })
    }
  }

  const status =
    parsed.kind === "empty"
      ? null
      : parsed.kind === "error"
        ? { ok: false, message: parsed.message, issues: parsed.issues }
        : {
            ok: true,
            message: `${parsed.data.reports.length} ${parsed.data.reports.length === 1 ? "referto riconosciuto" : "referti riconosciuti"}`,
          }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <PromptStep
          prompt={prompt}
          hint={
            <ol className="list-inside list-decimal space-y-0.5">
              <li>Apri Gemini, ChatGPT o Claude e incolla il prompt.</li>
              <li>Allega il referto: ECG, visita sportiva, pressione, spirometria, ecocardiogramma, DEXA…</li>
              <li>Copia la risposta e incollala qui: misure e conclusioni vengono controllate prima del salvataggio.</li>
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
            {done} {done === 1 ? "referto salvato" : "referti salvati"}: trovi tutto nella sezione Referti.
          </p>
          <Button asChild className="mt-4 rounded-xl">
            <Link href="/reports">Vai ai referti</Link>
          </Button>
        </StepCard>
      )}

      {preview && (
        <StepCard n={3} title="Verifica e importa" description="Controlla data, tipo, esito e misure prima di salvare">
          <div className="space-y-6">
            {preview.map(({ r, existing, rows }) => (
              <div key={`${r.report_date}-${r.kind}-${r.title}`} className="surface-inset rounded-xl p-4">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold">{r.title}</p>
                  <span className="text-xs text-muted-foreground">
                    {MEDICAL_KIND_LABELS[r.kind]} · {formatDate(r.report_date, "long")}
                    {r.facility && ` · ${r.facility}`}
                  </span>
                  <OutcomeBadge outcome={r.outcome} />
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset",
                      existing ? "bg-bia/10 text-bia ring-bia/25" : "bg-gain/10 text-gain ring-gain/25",
                    )}
                  >
                    {existing ? "Aggiorna referto esistente" : "Nuovo referto"}
                  </span>
                </div>
                {r.conclusion && <p className="text-sm text-foreground/90">{r.conclusion}</p>}
                {rows.length > 0 && (
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full min-w-[520px] text-sm tabular">
                      <thead>
                        <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                          <th className="py-2 pr-3 font-medium">Misura</th>
                          <th className="py-2 pr-3 text-right font-medium">Valore</th>
                          <th className="py-2 pr-3 text-right font-medium">Riferimento</th>
                          <th className="py-2 pr-3 font-medium">Stato</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((x) => (
                          <tr key={x.code} className="border-t">
                            <td className="py-2 pr-3">
                              <p className="font-medium">{x.label}</p>
                              {!x.known && <p className="text-[11px] text-muted-foreground">codice personalizzato: {x.code}</p>}
                            </td>
                            <td className="whitespace-nowrap py-2 pr-3 text-right">
                              {isNum(x.value) ? formatNumber(x.value, x.digits) : x.value_text}
                              {x.unit && isNum(x.value) && <span className="ml-1 text-xs text-muted-foreground">{x.unit}</span>}
                            </td>
                            <td className="whitespace-nowrap py-2 pr-3 text-right text-muted-foreground">
                              {isNum(x.range.low) && isNum(x.range.high)
                                ? `${formatNumber(x.range.low, x.digits)}–${formatNumber(x.range.high, x.digits)}`
                                : isNum(x.range.high)
                                  ? `≤ ${formatNumber(x.range.high, x.digits)}`
                                  : isNum(x.range.low)
                                    ? `≥ ${formatNumber(x.range.low, x.digits)}`
                                    : "—"}
                            </td>
                            <td className="py-2 pr-3">
                              {isNum(x.value) ? <LabStatusBadge flag={x.flag} /> : <span className="text-xs text-muted-foreground">descrittivo</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {(r.findings?.length ?? 0) + (r.recommendations?.length ?? 0) > 0 && (
                  <div className="mt-3 grid gap-3 text-xs sm:grid-cols-2">
                    {r.findings && r.findings.length > 0 && (
                      <div>
                        <p className="mb-1 font-semibold uppercase tracking-wider text-muted-foreground">Reperti</p>
                        <ul className="list-inside list-disc space-y-0.5">{r.findings.map((f) => <li key={f}>{f}</li>)}</ul>
                      </div>
                    )}
                    {r.recommendations && r.recommendations.length > 0 && (
                      <div>
                        <p className="mb-1 font-semibold uppercase tracking-wider text-muted-foreground">Indicazioni</p>
                        <ul className="list-inside list-disc space-y-0.5">{r.recommendations.map((f) => <li key={f}>{f}</li>)}</ul>
                      </div>
                    )}
                  </div>
                )}
                {r.next_check_date && (
                  <p className="mt-2 text-xs text-muted-foreground">Prossimo controllo: {formatDate(r.next_check_date, "long")}</p>
                )}
              </div>
            ))}
          </div>
          <div className="mt-4 flex justify-end">
            <Button className="rounded-xl" onClick={() => void runImport()} disabled={importM.isPending}>
              {importM.isPending ? <LoaderCircle className="size-4 animate-spin" /> : <Upload className="size-4" />}
              Importa {preview.length} {preview.length === 1 ? "referto" : "referti"}
            </Button>
          </div>
        </StepCard>
      )}
    </div>
  )
}
