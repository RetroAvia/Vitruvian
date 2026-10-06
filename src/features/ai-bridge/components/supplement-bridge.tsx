"use client"

import { CheckCircle2, LoaderCircle, Upload } from "lucide-react"
import Link from "next/link"
import { useMemo, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { SUPPLEMENT_FORM_LABELS, SUPPLEMENT_FREQUENCY_LABELS, SUPPLEMENT_TIMINGS, type SupplementTiming } from "@/config/constants"
import { useImportSupplements, useSupplements } from "@/features/supplements/api/supplements"
import { resolveNutrient, toCanonical } from "@/features/supplements/engine/nutrients"
import { formatNumber, isNum } from "@/lib/format"
import { useSound } from "@/lib/sound"
import { cn } from "@/lib/utils"

import { useParsedImport } from "../lib/use-parsed-import"
import { buildSupplementPrompt } from "../prompts/supplement-prompt"
import { normalizeSupplementInput, supplementsImportSchema } from "../schemas/supplement-import"
import { PasteStep, PromptStep, StepCard } from "./bridge-steps"

const LABELS = { supplements: "Integratore", ingredients: "Ingrediente" }

export function SupplementBridge() {
  const existingQ = useSupplements()
  const importM = useImportSupplements()
  const play = useSound()
  const [text, setText] = useState("")
  const [done, setDone] = useState<number | null>(null)

  const prompt = useMemo(() => buildSupplementPrompt(), [])
  const parsed = useParsedImport(text, supplementsImportSchema, normalizeSupplementInput, LABELS)

  const preview = useMemo(() => {
    if (parsed.kind !== "ok") return null
    const existing = existingQ.data ?? []
    const rows = parsed.data.supplements.map((s) => {
      const match = existing.find(
        (e) => e.name.toLowerCase() === s.name.toLowerCase() && (e.brand ?? "").toLowerCase() === (s.brand ?? "").toLowerCase(),
      )
      const ingredients = s.ingredients.map((i) => {
        const def = resolveNutrient(i.code) ?? resolveNutrient(i.name)
        const canon = def && isNum(i.amount) ? toCanonical(i.amount, i.unit, def) : null
        return { ...i, def, canon, warn: def && isNum(i.amount) && !isNum(canon) ? `unità "${i.unit}" non convertibile in ${def.unit}` : null }
      })
      return { s, match, ingredients }
    })
    const names = new Set(parsed.data.supplements.map((s) => s.name.toLowerCase()))
    const toDeactivate = parsed.data.deactivate_missing
      ? existing.filter((e) => e.is_active && !names.has(e.name.toLowerCase()))
      : []
    return { rows, toDeactivate }
  }, [parsed, existingQ.data])

  async function runImport() {
    if (parsed.kind !== "ok") return
    try {
      const ids = await importM.mutateAsync({ ...parsed.data, schema: "vitruvian.supplements.v1" })
      setDone(ids.length)
      setText("")
      play("success")
      toast.success(`${ids.length} ${ids.length === 1 ? "integratore salvato" : "integratori salvati"}`)
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
            message: `${parsed.data.supplements.length} ${parsed.data.supplements.length === 1 ? "integratore riconosciuto" : "integratori riconosciuti"}`,
          }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <PromptStep
          prompt={prompt}
          hint={
            <ol className="list-inside list-decimal space-y-0.5">
              <li>Incolla il prompt in Gemini, ChatGPT o Claude.</li>
              <li>Allega le foto delle etichette (tabella nutrizionale) e scrivi quanto e quando prendi ciascun prodotto.</li>
              <li>Incolla qui la risposta: l&apos;app somma le dosi e le confronta con i limiti di sicurezza EFSA.</li>
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
            {done} {done === 1 ? "integratore salvato" : "integratori salvati"}: trovi la checklist di oggi nella sezione Integratori.
          </p>
          <Button asChild className="mt-4 rounded-xl">
            <Link href="/supplements">Vai agli integratori</Link>
          </Button>
        </StepCard>
      )}

      {preview && (
        <StepCard n={3} title="Verifica e importa" description="Dose per singola assunzione: il totale giornaliero lo calcola l'app">
          <div className="grid gap-3 md:grid-cols-2">
            {preview.rows.map(({ s, match, ingredients }) => (
              <div key={`${s.name}-${s.brand}`} className="surface-inset rounded-xl p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold">{s.name}</p>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset",
                      match ? "bg-bia/10 text-bia ring-bia/25" : "bg-gain/10 text-gain ring-gain/25",
                    )}
                  >
                    {match ? "Aggiorna" : "Nuovo"}
                  </span>
                  {!s.is_active && <span className="text-[11px] text-muted-foreground">sospeso</span>}
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {[s.brand, SUPPLEMENT_FORM_LABELS[s.form], s.dose_label, `${formatNumber(s.servings_per_day, s.servings_per_day % 1 ? 1 : 0)}×/giorno`, SUPPLEMENT_FREQUENCY_LABELS[s.frequency]]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                {s.timing.length > 0 && (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {s.timing.map((t) => SUPPLEMENT_TIMINGS[t as SupplementTiming]).join(", ")}
                  </p>
                )}
                {ingredients.length > 0 ? (
                  <ul className="mt-2 space-y-1 text-xs">
                    {ingredients.map((i) => (
                      <li key={`${i.code}-${i.name}`} className="flex justify-between gap-3 border-t pt-1">
                        <span>
                          {i.def?.name ?? i.name}
                          {!i.def && <span className="ml-1 text-muted-foreground">(non in catalogo)</span>}
                          {i.warn && <span className="block text-warn">⚠ {i.warn}</span>}
                        </span>
                        <span className="whitespace-nowrap tabular text-muted-foreground">
                          {isNum(i.amount) ? `${formatNumber(i.amount, i.amount % 1 ? 2 : 0)} ${i.unit ?? ""}` : "—"}
                          {i.def && isNum(i.canon) && i.unit !== i.def.unit && ` → ${formatNumber(i.canon, 1)} ${i.def.unit}`}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-xs text-warn">Nessun ingrediente: non sarà incluso nei controlli di dose.</p>
                )}
              </div>
            ))}
          </div>
          {preview.toDeactivate.length > 0 && (
            <p className="mt-3 rounded-xl bg-warn/10 p-3 text-xs text-warn ring-1 ring-inset ring-warn/25">
              Lista completa: verranno segnati come sospesi {preview.toDeactivate.map((e) => e.name).join(", ")}.
            </p>
          )}
          <div className="mt-4 flex justify-end">
            <Button className="rounded-xl" onClick={() => void runImport()} disabled={importM.isPending}>
              {importM.isPending ? <LoaderCircle className="size-4 animate-spin" /> : <Upload className="size-4" />}
              Importa {preview.rows.length} {preview.rows.length === 1 ? "integratore" : "integratori"}
            </Button>
          </div>
        </StepCard>
      )}
    </div>
  )
}
