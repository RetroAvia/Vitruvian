"use client"

import { Flame, PieChart } from "lucide-react"

import { LegendItem } from "@/components/charts/chart-card"
import { GlassCard } from "@/components/shared/glass-card"
import { formatNumber, formatSigned, isNum } from "@/lib/format"
import { cn } from "@/lib/utils"

import { BALANCE_LABELS, type EnergyBalance } from "../engine/balance"
import { macroSplit, type Macros } from "../engine/totals"

const P = "var(--series-1)"
const C = "var(--series-2)"
const F = "var(--series-3)"

/** Calorie del piano vs BMR vs TDEE su un'unica scala (kcal). */
export function EnergyBalanceCard({ balance, source }: { balance: EnergyBalance; source: "target" | "sum" }) {
  const rows = [
    { label: "Metabolismo basale", value: balance.bmr },
    { label: "TDEE stimato", value: balance.tdee },
    { label: source === "target" ? "Piano (obiettivo)" : "Piano (somma alimenti)", value: balance.planKcal, strong: true },
  ]
  const max = Math.max(...rows.map((r) => r.value ?? 0), 1)
  const good = balance.status === "maintenance" || balance.status === "deficit" || balance.status === "surplus"

  return (
    <GlassCard className="p-5">
      <div className="flex items-center gap-3">
        <span className="grid size-9 place-items-center rounded-xl bg-warn/10 text-warn ring-1 ring-inset ring-warn/25">
          <Flame className="size-4" />
        </span>
        <div>
          <h2 className="text-sm font-semibold">Bilancio energetico</h2>
          <p className="text-xs text-muted-foreground">Piano rispetto al fabbisogno stimato</p>
        </div>
      </div>
      <div className="mt-5 flex items-end justify-between gap-3">
        <p className="font-display text-3xl font-semibold tabular">
          {isNum(balance.delta) ? formatSigned(balance.delta, 0) : "—"}
          <span className="ml-1 text-sm font-medium text-muted-foreground">kcal/giorno</span>
        </p>
        <span
          className={cn(
            "rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset",
            balance.status === "unknown"
              ? "bg-muted text-muted-foreground ring-border"
              : good
                ? "bg-neon/10 text-neon ring-neon/25"
                : "bg-warn/10 text-warn ring-warn/25",
          )}
        >
          {BALANCE_LABELS[balance.status]}
          {isNum(balance.pct) && ` ${formatSigned(balance.pct, 0)}%`}
        </span>
      </div>
      <ul className="mt-5 space-y-3">
        {rows.map((r) => (
          <li key={r.label}>
            <div className="flex justify-between text-xs">
              <span className={r.strong ? "font-medium" : "text-muted-foreground"}>{r.label}</span>
              <span className="tabular">{formatNumber(r.value, 0)} kcal</span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full"
                style={{ width: `${((r.value ?? 0) / max) * 100}%`, background: r.strong ? "var(--series-1)" : "var(--chart-axis)" }}
              />
            </div>
          </li>
        ))}
      </ul>
      {balance.status === "unknown" && (
        <p className="mt-3 text-[11px] text-muted-foreground">Servono una visita con BMR e il livello di attività nel profilo.</p>
      )}
    </GlassCard>
  )
}

/** Ripartizione delle calorie (barra impilata al 100%) + grammi e g/kg. */
export function MacroCard({
  day,
  targets,
  weight,
}: {
  day: Macros
  targets: { protein_g: number | null; carbs_g: number | null; fat_g: number | null; fiber_g: number | null }
  weight: number | null
}) {
  const split = macroSplit(day)
  const rows = [
    { key: "protein", label: "Proteine", g: day.protein_g, t: targets.protein_g, pct: split.protein, color: P },
    { key: "carbs", label: "Carboidrati", g: day.carbs_g, t: targets.carbs_g, pct: split.carbs, color: C },
    { key: "fat", label: "Grassi", g: day.fat_g, t: targets.fat_g, pct: split.fat, color: F },
  ]
  return (
    <GlassCard className="p-5">
      <div className="flex items-center gap-3">
        <span className="grid size-9 place-items-center rounded-xl bg-neon/10 text-neon ring-1 ring-inset ring-neon/25">
          <PieChart className="size-4" />
        </span>
        <div>
          <h2 className="text-sm font-semibold">Macronutrienti</h2>
          <p className="text-xs text-muted-foreground">{formatNumber(day.kcal, 0)} kcal nel giorno selezionato</p>
        </div>
      </div>

      <div
        className="mt-5 flex h-3 overflow-hidden rounded-full bg-muted"
        role="img"
        aria-label={rows.map((r) => `${r.label} ${formatNumber(r.pct, 0)}%`).join(", ")}
      >
        {rows.map((r) => (
          <div key={r.key} style={{ width: `${r.pct}%`, background: r.color }} className="h-full border-r-2 border-[var(--chart-surface)] last:border-r-0" />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        {rows.map((r) => (
          <LegendItem key={r.key} color={r.color} label={`${r.label} ${formatNumber(r.pct, 0)}%`} />
        ))}
      </div>

      <table className="mt-4 w-full text-sm tabular">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
            <th className="py-1.5 font-medium">Macro</th>
            <th className="py-1.5 text-right font-medium">Grammi</th>
            <th className="py-1.5 text-right font-medium">Obiettivo</th>
            <th className="py-1.5 text-right font-medium">g/kg</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-t">
              <td className="py-2">{r.label}</td>
              <td className="py-2 text-right">{formatNumber(r.g, 0)}</td>
              <td className="py-2 text-right text-muted-foreground">{formatNumber(r.t, 0)}</td>
              <td className="py-2 text-right">{isNum(weight) && weight > 0 ? formatNumber(r.g / weight, 1) : "—"}</td>
            </tr>
          ))}
          <tr className="border-t">
            <td className="py-2">Fibre</td>
            <td className="py-2 text-right">{formatNumber(day.fiber_g, 0)}</td>
            <td className="py-2 text-right text-muted-foreground">{formatNumber(targets.fiber_g, 0)}</td>
            <td className="py-2 text-right">—</td>
          </tr>
        </tbody>
      </table>
    </GlassCard>
  )
}
