"use client"

import { Flame } from "lucide-react"
import Link from "next/link"

import { GlassCard } from "@/components/shared/glass-card"
import { InfoTip } from "@/components/shared/info-tip"
import { ACTIVITY_LEVELS } from "@/config/constants"
import type { BiometricReport } from "@/features/biometrics/engine/report"
import { formatNumber } from "@/lib/format"
import type { Profile } from "@/types/domain"

/** Fabbisogno: BMR del referto, TDEE stimato e stime di controllo, su una scala comune. */
export function EnergyCard({ report, profile }: { report: BiometricReport; profile: Profile | null }) {
  const { bmr, tdee, katchMcArdle, mifflin } = report.energy
  const activity = profile?.activity_level ? ACTIVITY_LEVELS[profile.activity_level] : null
  const rows = [
    { label: "BMR (referto)", value: bmr, hint: "Metabolismo a riposo misurato dalla BIA", strong: true },
    { label: "Katch-McArdle", value: katchMcArdle, hint: "Stima dalla massa magra" },
    { label: "Mifflin-St Jeor", value: mifflin, hint: "Stima da peso, altezza, età" },
  ]
  const scaleMax = Math.max(tdee ?? 0, ...rows.map((r) => r.value ?? 0), 1)

  return (
    <GlassCard className="flex flex-col p-5">
      <div className="flex items-center gap-3">
        <span className="grid size-9 place-items-center rounded-xl bg-warn/10 text-warn ring-1 ring-inset ring-warn/25">
          <Flame className="size-4" />
        </span>
        <div>
          <h3 className="text-sm font-semibold">Fabbisogno energetico</h3>
          <p className="text-xs text-muted-foreground">Stime per la giornata tipo</p>
        </div>
      </div>

      <div className="mt-5">
        <p className="flex items-center gap-1.5 text-xs uppercase tracking-[0.14em] text-muted-foreground">TDEE stimato <InfoTip term="tdee" /></p>
        <p className="mt-1 font-display text-4xl font-semibold">
          {formatNumber(tdee, 0)}
          <span className="ml-1 text-base font-medium text-muted-foreground">kcal</span>
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {activity ? (
            <>
              BMR × {activity.factor} ({activity.label.toLowerCase()}) ·{" "}
              <Link href="/settings" className="underline underline-offset-2">
                modifica
              </Link>
            </>
          ) : (
            "Imposta il livello di attività nel profilo"
          )}
        </p>
      </div>

      <ul className="mt-5 space-y-3">
        {rows.map((r) => (
          <li key={r.label}>
            <div className="flex items-baseline justify-between gap-3 text-xs">
              <span className={r.strong ? "font-medium text-foreground" : "text-muted-foreground"}>{r.label}</span>
              <span className="tabular text-foreground">{formatNumber(r.value, 0)} kcal</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${((r.value ?? 0) / scaleMax) * 100}%`,
                  background: r.strong ? "var(--series-1)" : "var(--chart-axis)",
                }}
              />
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground/80">{r.hint}</p>
          </li>
        ))}
      </ul>
    </GlassCard>
  )
}
