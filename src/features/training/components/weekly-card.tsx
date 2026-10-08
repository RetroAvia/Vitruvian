"use client"

import { ArrowDown, ArrowUp, CalendarDays } from "lucide-react"
import { useMemo } from "react"

import { GlassCard } from "@/components/shared/glass-card"
import { useHealthDays } from "@/features/health/api/health"
import { formatMetric, metricValue } from "@/features/health/engine/health"
import { formatNumber, isNum, todayISO } from "@/lib/format"
import { cn } from "@/lib/utils"

import { weeklySummary } from "../engine/weekly"
import { useTraining } from "../hooks/use-training"

const DAYS = ["L", "M", "M", "G", "V", "S", "D"]

function Delta({ now, before, digits = 0 }: { now: number; before: number; digits?: number }) {
  if (before <= 0 || now === before) return null
  const up = now > before
  return (
    <span className={cn("inline-flex items-center text-[10px]", up ? "text-gain" : "text-muted-foreground")}>
      {up ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
      {formatNumber(Math.abs(now - before), digits)}
    </span>
  )
}

/** Riepilogo settimanale: allenamenti, volume, record e (se collegata) Apple Salute. */
export function WeeklySummaryCard({ className }: { className?: string }) {
  const { workouts, report, isPending } = useTraining()
  const healthQ = useHealthDays()
  const today = todayISO()
  const w = useMemo(() => weeklySummary(workouts, today), [workouts, today])

  const health = useMemo(() => {
    const rows = (healthQ.data ?? []).filter((r) => r.day >= w.current.from && r.day <= w.current.to)
    const avg = (vals: Array<number | null>) => {
      const v = vals.filter(isNum)
      return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null
    }
    return { steps: avg(rows.map((r) => metricValue(r, "steps"))), sleep: avg(rows.map((r) => metricValue(r, "sleep_min"))) }
  }, [healthQ.data, w.current.from, w.current.to])

  if (isPending) return null
  if (workouts.length === 0 && health.steps === null) return null

  const target = report?.tree?.plan.days_per_week ?? report?.tree?.days.length ?? null
  const tiles = [
    { label: "Sessioni", value: `${w.current.sessions}${target ? `/${target}` : ""}`, delta: <Delta now={w.current.sessions} before={w.previous.sessions} /> },
    { label: "Serie", value: String(w.current.sets), delta: <Delta now={w.current.sets} before={w.previous.sets} /> },
    {
      label: "Sollevate",
      value: w.current.volume > 0 ? `${formatNumber(w.current.volume / 1000, 1)} t` : "—",
      delta: <Delta now={w.current.volume / 1000} before={w.previous.volume / 1000} digits={1} />,
    },
    { label: "Minuti", value: w.current.minutes ? String(w.current.minutes) : "—", delta: <Delta now={w.current.minutes} before={w.previous.minutes} /> },
  ]

  return (
    <GlassCard className={cn("p-4 sm:p-5", className)}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <CalendarDays className="size-4 text-neon" /> La tua settimana
        </h2>
        <span className="text-[11px] text-muted-foreground">vs settimana scorsa</span>
      </div>

      {/* giorni */}
      <div className="mb-3 flex gap-1.5" aria-label={`Allenamenti questa settimana: ${w.current.sessions}`}>
        {DAYS.map((d, i) => {
          const done = w.trainedDays.includes(i + 1)
          const isToday = i + 1 === w.elapsed
          return (
            <span
              key={i}
              className={cn(
                "grid h-8 flex-1 place-items-center rounded-lg text-[11px] font-semibold",
                done ? "bg-gain/20 text-gain" : i + 1 < w.elapsed ? "bg-muted/40 text-muted-foreground" : "bg-accent/30 text-muted-foreground/70",
                isToday && "ring-1 ring-neon/60",
              )}
            >
              {done ? "💪" : d}
            </span>
          )
        })}
      </div>

      <div className="grid grid-cols-4 gap-2">
        {tiles.map((t) => (
          <div key={t.label} className="surface-inset rounded-xl px-2 py-2 text-center">
            <p className="font-display text-base font-semibold tabular">{t.value}</p>
            <p className="text-[10px] text-muted-foreground">{t.label}</p>
            <div className="h-3.5">{t.delta}</div>
          </div>
        ))}
      </div>

      <ul className="mt-3 space-y-1.5 text-xs">
        {w.prs.slice(0, 3).map((p) => (
          <li key={p.name} className="flex items-center justify-between gap-2 rounded-lg bg-warn/10 px-2.5 py-1.5 text-warn">
            <span className="truncate">🏆 Record: {p.name}</span>
            <span className="shrink-0 tabular">
              {formatNumber(p.previous, 1)} → {formatNumber(p.e1rm, 1)} kg
            </span>
          </li>
        ))}
        {w.topMuscles.length > 0 && (
          <li className="text-muted-foreground">
            🎯 Più allenati: {w.topMuscles.map((m) => `${m.label} ${m.sets}`).join(" · ")} serie
          </li>
        )}
        {(health.steps !== null || health.sleep !== null) && (
          <li className="text-muted-foreground">
            {health.steps !== null && `👟 ${formatMetric("steps", health.steps)} passi/giorno`}
            {health.steps !== null && health.sleep !== null && " · "}
            {health.sleep !== null && `😴 ${formatMetric("sleep_min", health.sleep)} di sonno`}
          </li>
        )}
        {w.current.sessions === 0 && w.elapsed <= 2 && <li className="text-muted-foreground">Nuova settimana: il primo allenamento è quello che conta di più.</li>}
      </ul>
    </GlassCard>
  )
}
