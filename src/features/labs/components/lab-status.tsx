import { ArrowDown, ArrowUp, Check, Minus } from "lucide-react"

import { FLAG_LABELS } from "@/features/labs/engine/status"
import { cn } from "@/lib/utils"
import type { LabFlag } from "@/types/domain"

const STYLE: Record<LabFlag, string> = {
  low: "text-warn bg-warn/10 ring-warn/30",
  high: "text-danger bg-danger/10 ring-danger/30",
  normal: "text-gain bg-gain/10 ring-gain/25",
  unknown: "text-muted-foreground bg-muted ring-border",
}
const ICON = { low: ArrowDown, high: ArrowUp, normal: Check, unknown: Minus } as const

/** Stato sempre con icona + etichetta (mai solo colore). */
export function LabStatusBadge({ flag, className }: { flag: LabFlag; className?: string }) {
  const Icon = ICON[flag]
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset",
        STYLE[flag],
        className,
      )}
    >
      <Icon className="size-3" aria-hidden />
      {FLAG_LABELS[flag]}
    </span>
  )
}
