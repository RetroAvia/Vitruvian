import type { LucideIcon } from "lucide-react"

import type { GlossaryKey } from "@/config/glossary"

import { formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"

import { DeltaPill, type Polarity } from "./delta-pill"
import { GlassCard } from "./glass-card"
import { InfoTip } from "./info-tip"

export type Accent = "neon" | "gain" | "warn" | "bia" | "danger"

const ACCENT_CLASSES: Record<Accent, { icon: string; glow: string }> = {
  neon: { icon: "text-neon bg-neon/10 ring-neon/25", glow: "bg-neon/25" },
  gain: { icon: "text-gain bg-gain/10 ring-gain/25", glow: "bg-gain/25" },
  warn: { icon: "text-warn bg-warn/10 ring-warn/25", glow: "bg-warn/25" },
  bia: { icon: "text-bia bg-bia/10 ring-bia/25", glow: "bg-bia/25" },
  danger: { icon: "text-danger bg-danger/10 ring-danger/25", glow: "bg-danger/25" },
}

interface KpiCardProps {
  label: string
  value: number | null | undefined
  unit?: string
  digits?: number
  icon: LucideIcon
  accent?: Accent
  delta?: number | null
  deltaDigits?: number
  polarity?: Polarity
  /** Testo sotto il delta (es. "vs visita precedente") */
  caption?: string
  info?: GlossaryKey
  className?: string
}

export function KpiCard({
  label,
  value,
  unit,
  digits = 1,
  icon: Icon,
  accent = "neon",
  delta,
  deltaDigits,
  polarity = "neutral",
  caption,
  info,
  className,
}: KpiCardProps) {
  const a = ACCENT_CLASSES[accent]

  return (
    <GlassCard className={cn("group relative overflow-hidden p-5", className)}>
      <div
        aria-hidden
        className={cn(
          "absolute -right-10 -top-10 size-32 rounded-full opacity-40 blur-3xl transition-opacity group-hover:opacity-70",
          a.glow,
        )}
      />
      <div className="relative flex items-center justify-between gap-3">
        <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
          {label}
          {info && <InfoTip term={info} />}
        </p>
        <span className={cn("grid size-8 place-items-center rounded-lg ring-1 ring-inset", a.icon)}>
          <Icon className="size-4" />
        </span>
      </div>
      <p className="relative mt-4 font-display text-3xl font-semibold tabular">
        {formatNumber(value, digits)}
        {unit && <span className="ml-1 text-base font-medium text-muted-foreground">{unit}</span>}
      </p>
      <div className="relative mt-2 flex flex-wrap items-center gap-2">
        <DeltaPill value={delta} digits={deltaDigits ?? digits} polarity={polarity} />
        {caption && <span className="text-xs text-muted-foreground">{caption}</span>}
      </div>
    </GlassCard>
  )
}
