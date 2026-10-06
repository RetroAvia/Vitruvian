import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react"

import { formatSigned, isNum } from "@/lib/format"
import { cn } from "@/lib/utils"

/** Come leggere una variazione: più alto è meglio, più basso è meglio, o neutro. */
export type Polarity = "higher-better" | "lower-better" | "neutral"

interface DeltaPillProps {
  value: number | null | undefined
  digits?: number
  unit?: string
  polarity?: Polarity
  className?: string
}

export function DeltaPill({ value, digits = 1, unit, polarity = "neutral", className }: DeltaPillProps) {
  if (!isNum(value)) {
    return <span className={cn("text-xs text-muted-foreground", className)}>—</span>
  }

  const flat = Math.abs(value) < 0.5 / 10 ** digits
  const good = polarity === "higher-better" ? value > 0 : value < 0
  const tone = flat || polarity === "neutral" ? "neutral" : good ? "good" : "bad"
  const Icon = flat ? Minus : value > 0 ? ArrowUpRight : ArrowDownRight

  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-medium tabular",
        tone === "good" && "bg-gain/12 text-gain",
        tone === "bad" && "bg-warn/12 text-warn",
        tone === "neutral" && "bg-muted text-muted-foreground",
        className,
      )}
    >
      <Icon className="size-3.5" />
      {formatSigned(value, digits)}
      {unit && <span className="opacity-70">{unit}</span>}
    </span>
  )
}
