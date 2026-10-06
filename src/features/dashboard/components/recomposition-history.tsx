"use client"

import { ArrowRight, ChartScatter } from "lucide-react"
import Link from "next/link"

import { GlassCard } from "@/components/shared/glass-card"
import { InfoTip } from "@/components/shared/info-tip"
import type { RecompResult } from "@/features/biometrics/engine/recomposition"
import { formatDate, formatSigned } from "@/lib/format"
import { cn } from "@/lib/utils"

const TONE = {
  good: "bg-gain/10 text-gain ring-gain/30",
  neutral: "bg-muted text-muted-foreground ring-border",
  warn: "bg-warn/10 text-warn ring-warn/30",
  bad: "bg-danger/10 text-danger ring-danger/30",
} as const

/** Storico leggibile degli intervalli tra visite (più recenti in alto). */
export function RecompositionHistory({ intervals }: { intervals: RecompResult[] }) {
  const recent = [...intervals].reverse().slice(0, 6)
  return (
    <GlassCard className="flex flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-1.5 text-sm font-semibold">
            Ricomposizione tra le visite <InfoTip term="recomposition" />
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">Ultimi intervalli con lo stesso strumento BIA</p>
        </div>
        <Link href="/trends#ricomposizione" className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ChartScatter className="size-3.5" /> Mappa
        </Link>
      </div>

      {recent.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">Servono almeno due visite BIA con lo stesso strumento.</p>
      ) : (
        <ol className="mt-4 space-y-2">
          {recent.map((r, i) => (
            <li key={r.to.id} className={cn("surface-inset rounded-xl px-3.5 py-3", i === 0 && "ring-1 ring-inset ring-neon/30")}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  {r.from ? formatDate(r.from.checkup_date, "medium") : "—"}
                  <ArrowRight className="size-3" />
                  <span className="text-foreground">{formatDate(r.to.checkup_date, "medium")}</span>
                  {r.days !== null && <span>· {r.days} gg</span>}
                </p>
                <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset", TONE[r.tone])}>{r.title}</span>
              </div>
              <p className="mt-1.5 text-xs tabular">
                <span className="text-muted-foreground">Grasso</span> {formatSigned(r.dFatKg, 1)} kg
                <span className="mx-2 text-muted-foreground/50">·</span>
                <span className="text-muted-foreground">Magra</span> {formatSigned(r.dFfmKg, 1)} kg
                {r.dWaist !== null && (
                  <>
                    <span className="mx-2 text-muted-foreground/50">·</span>
                    <span className="text-muted-foreground">Vita</span> {formatSigned(r.dWaist, 1)} cm
                  </>
                )}
              </p>
            </li>
          ))}
        </ol>
      )}
    </GlassCard>
  )
}
