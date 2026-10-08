"use client"

import { ArrowDown, ArrowUp, HeartPulse } from "lucide-react"
import Link from "next/link"
import { useMemo } from "react"

import { GlassCard } from "@/components/shared/glass-card"
import { relativeDay, todayISO } from "@/lib/format"
import { cn } from "@/lib/utils"

import { useHealthDays, useHealthLink } from "../api/health"
import { formatMetric, HEALTH_METRICS, hasRecentHealth, summarizeHealth, type HealthMetric, type MetricSummary } from "../engine/health"

const MAIN: HealthMetric[] = ["steps", "sleep_min", "resting_hr", "active_kcal"]

function Tile({ s }: { s: MetricSummary }) {
  const def = HEALTH_METRICS[s.metric]
  const delta = s.avg7 !== null && s.prev7 !== null && s.prev7 !== 0 ? ((s.avg7 - s.prev7) / s.prev7) * 100 : null
  const good = delta === null || def.higherIsBetter === null ? null : def.higherIsBetter ? delta > 0 : delta < 0
  const max = Math.max(1, ...s.series14.map((v) => v ?? 0))
  return (
    <div className="surface-inset flex min-w-0 flex-col rounded-xl p-3">
      <p className="truncate text-[11px] font-medium text-muted-foreground">
        <span aria-hidden className="mr-1">
          {def.emoji}
        </span>
        {def.label}
      </p>
      <p className="mt-1 font-display text-lg font-semibold tabular">{formatMetric(s.metric, s.latest)}</p>
      <p className="truncate text-[10px] text-muted-foreground">{s.latestDay ? relativeDay(s.latestDay) : "nessun dato"}</p>
      {/* ultimi 14 giorni */}
      <div className="mt-2 flex h-6 items-end gap-[2px]" aria-hidden>
        {s.series14.map((v, i) => (
          <span
            key={i}
            className={cn("flex-1 rounded-sm", v === null ? "bg-muted/40" : i === 13 ? "bg-neon" : "bg-neon/40")}
            style={{ height: v === null ? 3 : `${Math.max(12, (v / max) * 100)}%` }}
          />
        ))}
      </div>
      <p className="mt-1.5 flex items-center gap-1 text-[10px] text-muted-foreground">
        media 7 gg {formatMetric(s.metric, s.avg7)}
        {delta !== null && Math.abs(delta) >= 3 && (
          <span className={cn("ml-auto inline-flex items-center", good === null ? "" : good ? "text-gain" : "text-danger")}>
            {delta > 0 ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
            {Math.abs(Math.round(delta))}%
          </span>
        )}
      </p>
    </div>
  )
}

/** Attività quotidiana da Apple Salute / Mi Band (dashboard). */
export function ActivityCard({ className }: { className?: string }) {
  const daysQ = useHealthDays()
  const linkQ = useHealthLink()
  const summary = useMemo(() => summarizeHealth(daysQ.data ?? [], todayISO()), [daysQ.data])

  if (daysQ.isPending || linkQ.isPending) return null
  if (linkQ.data?.available === false) return null

  if (!hasRecentHealth(summary)) {
    return (
      <Link
        href="/settings#salute"
        className={cn("glass flex items-center gap-3 rounded-2xl border border-dashed p-4 transition-colors hover:border-neon/40", className)}
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-danger/10 text-danger">
          <HeartPulse className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">⌚ {linkQ.data ? "In attesa dei dati da Apple Salute" : "Collega Apple Salute o la Mi Band"}</span>
          <span className="block text-xs text-muted-foreground">
            {linkQ.data ? "Esegui il Comando Rapido una volta per vedere passi, sonno e battiti qui." : "Passi, sonno, battiti a riposo e calorie attive ogni giorno, in automatico."}
          </span>
        </span>
      </Link>
    )
  }

  return (
    <GlassCard className={cn("p-4 sm:p-5", className)}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">⌚ Attività e recupero</h2>
        <Link href="/settings#salute" className="text-[11px] text-muted-foreground hover:text-foreground">
          Apple Salute
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {MAIN.map((m) => (
          <Tile key={m} s={summary[m]} />
        ))}
      </div>
    </GlassCard>
  )
}
