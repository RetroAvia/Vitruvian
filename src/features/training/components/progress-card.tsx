"use client"

import { Trophy } from "lucide-react"
import { useState } from "react"

import { GlassCard } from "@/components/shared/glass-card"
import { Button } from "@/components/ui/button"
import { Emoji } from "@/components/shared/emoji"
import { RangeSparkline } from "@/features/labs/components/range-sparkline"
import { formatDate, formatNumber, formatSigned, isNum } from "@/lib/format"
import { cn } from "@/lib/utils"

import { exerciseEmoji, type ExerciseProgress } from "../engine/analysis"

const STATUS = {
  progress: { label: "In crescita", cls: "bg-gain/10 text-gain ring-gain/25" },
  stall: { label: "Fermo", cls: "bg-warn/10 text-warn ring-warn/25" },
  regress: { label: "In calo", cls: "bg-danger/10 text-danger ring-danger/25" },
  new: { label: "Pochi dati", cls: "bg-muted text-muted-foreground ring-border" },
} as const

/** Progressione per esercizio: massimale stimato (Epley) o ripetizioni a corpo libero. */
export function ProgressCard({ progress, prCodes }: { progress: ExerciseProgress[]; prCodes: Set<string> }) {
  const [all, setAll] = useState(false)
  const list = all ? progress : progress.slice(0, 8)

  return (
    <GlassCard className="p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold">Progressione</h3>
        <p className="text-xs text-muted-foreground">Massimale stimato dalla serie migliore di ogni sessione · tendenza sulle ultime 8 settimane</p>
      </div>
      {list.length === 0 ? (
        <p className="surface-inset rounded-xl p-4 text-center text-sm text-muted-foreground">Registra o importa qualche sessione per vedere i progressi.</p>
      ) : (
        <div className="stagger grid gap-2 sm:grid-cols-2">
          {list.map((p) => (
            <div key={p.code} className="surface-inset rounded-xl p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 truncate text-sm font-medium">
                    <Emoji e={exerciseEmoji(p.code, p.name)} className="mr-0" />
                    {p.name}
                    {prCodes.has(p.code) && <Trophy className="size-3.5 shrink-0 text-warn" aria-label="Record recente" />}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {p.kind === "load"
                      ? `Record ${formatNumber(p.best.value, 1)} kg stimati (${formatNumber(p.best.best.weight, 1)} × ${p.best.best.reps}) · ${formatDate(p.best.date, "short")}`
                      : `Record ${formatNumber(p.best.value, 0)} ripetizioni · ${formatDate(p.best.date, "short")}`}
                  </p>
                </div>
                <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset", STATUS[p.status].cls)}>{STATUS[p.status].label}</span>
              </div>
              <div className="mt-2 flex items-end justify-between gap-3">
                <RangeSparkline className="h-9 w-full max-w-[180px]" values={p.points.slice(-12).map((x) => x.value)} refLow={null} refHigh={null} />
                <div className="text-right">
                  <p className="text-sm font-semibold tabular">
                    {formatNumber(p.last.value, p.kind === "load" ? 1 : 0)}
                    <span className="ml-0.5 text-[11px] font-normal text-muted-foreground">{p.kind === "load" ? "kg" : "rip."}</span>
                  </p>
                  {isNum(p.pctPerMonth) && (
                    <p className={cn("text-[11px] tabular", p.pctPerMonth >= 1 ? "text-gain" : p.pctPerMonth <= -2.5 ? "text-danger" : "text-muted-foreground")}>
                      {formatSigned(p.pctPerMonth, 1)}%/mese
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {progress.length > 8 && (
        <Button variant="ghost" size="sm" className="mt-3 w-full rounded-lg text-muted-foreground" onClick={() => setAll((v) => !v)}>
          {all ? "Mostra meno" : `Mostra tutti (${progress.length})`}
        </Button>
      )}
    </GlassCard>
  )
}
