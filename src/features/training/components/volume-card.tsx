"use client"

import { useState } from "react"

import { Segmented } from "@/components/charts/chart-card"
import { GlassCard } from "@/components/shared/glass-card"
import { formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"

import type { LoggedVolume, PlanVolume } from "../engine/analysis"
import { MUSCLE_KEYS, MUSCLES, SMALL_MUSCLES, VOLUME_ZONES, type Muscle } from "../engine/catalog"

const MAX = 26

/**
 * Serie settimanali per muscolo. Fascia verde = 10–20 serie (zona più produttiva),
 * barre ambra sotto 8, rosse oltre 24.
 */
export function VolumeCard({ plan, logged }: { plan: PlanVolume | null; logged: LoggedVolume }) {
  const hasLogged = logged.sessions > 0
  const [source, setSource] = useState<"plan" | "logged">(plan ? "plan" : "logged")
  const data = source === "plan" && plan ? plan.perMuscle : logged.perMuscle
  const rows = MUSCLE_KEYS.map((m) => ({ m, v: data[m], other: source === "plan" ? (hasLogged ? logged.perMuscle[m] : null) : plan ? plan.perMuscle[m] : null })).filter(
    (r) => r.v > 0 || (r.other ?? 0) > 0 || !SMALL_MUSCLES.includes(r.m),
  )

  return (
    <GlassCard className="p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Volume settimanale per muscolo</h3>
          <p className="text-xs text-muted-foreground">Serie allenanti; i muscoli secondari contano mezza serie</p>
        </div>
        {plan && hasLogged && (
          <Segmented<"plan" | "logged">
            label="Origine dei dati"
            value={source}
            onChange={setSource}
            options={[
              { value: "plan", label: "Scheda" },
              { value: "logged", label: "Ultime 4 settimane" },
            ]}
          />
        )}
      </div>

      <div className="space-y-1.5">
        {rows.map(({ m, v, other }) => (
          <Bar key={m} muscle={m} value={v} other={other} otherLabel={source === "plan" ? "svolte" : "in scheda"} />
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-4 rounded-sm bg-gain/15 ring-1 ring-inset ring-gain/30" /> zona produttiva {VOLUME_ZONES.optimalMin}–{VOLUME_ZONES.optimalMax}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-0.5 rounded bg-foreground/60" /> {source === "plan" ? "serie realmente svolte" : "serie in scheda"}
        </span>
      </div>
    </GlassCard>
  )
}

function Bar({ muscle, value, other, otherLabel }: { muscle: Muscle; value: number; other: number | null; otherLabel: string }) {
  const pct = (x: number) => `${Math.min(x / MAX, 1) * 100}%`
  const tone = value < VOLUME_ZONES.low ? "bg-warn" : value > VOLUME_ZONES.high ? "bg-danger" : value >= VOLUME_ZONES.optimalMin ? "bg-gain" : "bg-neon"
  return (
    <div className="grid grid-cols-[120px_1fr_44px] items-center gap-3 text-xs sm:grid-cols-[150px_1fr_48px]">
      <span className="truncate text-muted-foreground">{MUSCLES[muscle]}</span>
      <div className="relative h-3 rounded-full bg-muted/60" title={other !== null ? `${formatNumber(other, 1)} ${otherLabel}` : undefined}>
        <div className="absolute inset-y-0 rounded-full bg-gain/15 ring-1 ring-inset ring-gain/25" style={{ left: pct(VOLUME_ZONES.optimalMin), width: `calc(${pct(VOLUME_ZONES.optimalMax)} - ${pct(VOLUME_ZONES.optimalMin)})` }} />
        <div className={cn("animate-grow-x absolute inset-y-0.5 left-0.5 rounded-full", tone)} style={{ width: `calc(${pct(value)} - 2px)` }} />
        {other !== null && other > 0 && <div className="absolute -inset-y-0.5 w-0.5 rounded bg-foreground/60" style={{ left: pct(other) }} />}
      </div>
      <span className="text-right font-medium tabular">{formatNumber(value, value % 1 ? 1 : 0)}</span>
    </div>
  )
}
