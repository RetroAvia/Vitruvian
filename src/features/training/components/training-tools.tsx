"use client"

import { Calculator, Disc3 } from "lucide-react"
import { useState } from "react"

import { GlassCard } from "@/components/shared/glass-card"
import { Input } from "@/components/ui/input"
import { parseDecimal } from "@/features/checkups/schemas/checkup-form"
import { formatNumber, isNum } from "@/lib/format"
import { cn } from "@/lib/utils"

import { e1rm } from "../engine/analysis"
import { platesPerSide, roundLoad } from "../engine/techniques"

const PCTS = [100, 95, 90, 85, 80, 75, 70, 65, 60]
const BARS = [20, 15, 10]

const kg = (x: number) => formatNumber(x, x % 1 ? 1 : 0)

/** Calcolatori da palestra: massimale stimato con tabella delle percentuali e dischi per lato. */
export function TrainingTools() {
  const [weight, setWeight] = useState("80")
  const [reps, setReps] = useState("8")
  const [target, setTarget] = useState("100")
  const [bar, setBar] = useState(20)

  const w = parseDecimal(weight)
  const r = parseDecimal(reps)
  const max = isNum(w) && isNum(r) && r >= 1 && r <= 30 ? e1rm(w, Math.round(r)) : null
  const t = parseDecimal(target)
  const plates = isNum(t) ? platesPerSide(t, bar) : null

  return (
    <section className="grid gap-4 lg:grid-cols-2">
      <GlassCard className="p-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Calculator className="size-4 text-neon" /> Massimale stimato
        </h3>
        <p className="mt-0.5 text-xs text-muted-foreground">Da una serie qualsiasi (formula di Epley, affidabile fino a ~12 ripetizioni).</p>
        <div className="mt-3 flex items-end gap-2">
          <label className="flex-1 space-y-1 text-xs text-muted-foreground">
            Carico (kg)
            <Input inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} className="h-11 rounded-xl text-center text-base tabular" />
          </label>
          <span className="pb-3 text-muted-foreground">×</span>
          <label className="flex-1 space-y-1 text-xs text-muted-foreground">
            Ripetizioni
            <Input inputMode="numeric" value={reps} onChange={(e) => setReps(e.target.value.replace(/[^\d]/g, ""))} className="h-11 rounded-xl text-center text-base tabular" />
          </label>
          <div className="flex-1 rounded-xl bg-neon/10 px-3 py-2 text-center ring-1 ring-inset ring-neon/25">
            <p className="text-[10px] uppercase tracking-wider text-neon">1RM</p>
            <p className="font-display text-xl font-semibold tabular">{max ? kg(Math.round(max * 2) / 2) : "—"}</p>
          </div>
        </div>
        {max && (
          <div className="mt-3 grid grid-cols-3 gap-1.5 sm:grid-cols-9">
            {PCTS.map((p) => {
              const load = p === 100 ? Math.round(max * 2) / 2 : roundLoad((max * p) / 100)
              const estReps = p === 100 ? 1 : Math.max(1, Math.round(30 * (100 / p - 1)))
              return (
                <div key={p} className={cn("rounded-lg px-1 py-1.5 text-center surface-inset", p === 100 && "ring-1 ring-inset ring-neon/30")}>
                  <p className="text-[10px] text-muted-foreground">{p}%</p>
                  <p className="text-sm font-semibold tabular">{kg(load)}</p>
                  <p className="text-[10px] text-muted-foreground tabular">~{estReps} rip.</p>
                </div>
              )
            })}
          </div>
        )}
      </GlassCard>

      <GlassCard className="p-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Disc3 className="size-4 text-neon" /> Dischi per lato
        </h3>
        <p className="mt-0.5 text-xs text-muted-foreground">Cosa caricare su ciascun lato del bilanciere.</p>
        <div className="mt-3 flex items-end gap-2">
          <label className="flex-1 space-y-1 text-xs text-muted-foreground">
            Carico totale (kg)
            <Input inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} className="h-11 rounded-xl text-center text-base tabular" />
          </label>
          <div className="flex gap-1" role="group" aria-label="Peso del bilanciere">
            {BARS.map((b) => (
              <button
                key={b}
                type="button"
                onClick={() => setBar(b)}
                aria-pressed={bar === b}
                className={cn("h-11 rounded-xl px-3 text-xs font-medium ring-1 ring-inset", bar === b ? "bg-neon/10 text-neon ring-neon/40" : "text-muted-foreground ring-border")}
              >
                {b} kg
              </button>
            ))}
          </div>
        </div>
        <div className="mt-4 flex min-h-20 items-center justify-center gap-1 rounded-xl surface-inset p-3">
          {!plates ? (
            <p className="text-xs text-muted-foreground">Il carico deve essere almeno quello del bilanciere ({bar} kg).</p>
          ) : plates.plates.length === 0 ? (
            <p className="text-xs text-muted-foreground">Solo bilanciere.</p>
          ) : (
            <>
              <span className="h-2 w-10 rounded-l bg-muted-foreground/40" aria-hidden />
              {plates.plates.map((p, i) => (
                <span
                  key={i}
                  className="grid w-7 place-items-center rounded-md bg-neon/20 text-[10px] font-semibold text-neon ring-1 ring-inset ring-neon/40 tabular"
                  style={{ height: `${28 + Math.min(p, 25) * 1.8}px` }}
                >
                  {formatNumber(p, p % 1 ? 2 : 0)}
                </span>
              ))}
            </>
          )}
        </div>
        {plates && plates.remainder > 0 && <p className="mt-2 text-xs text-warn">Non raggiungibile esattamente: mancano {formatNumber(plates.remainder, 2)} kg.</p>}
      </GlassCard>
    </section>
  )
}
