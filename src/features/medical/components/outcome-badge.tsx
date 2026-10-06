import { CircleCheck, CircleHelp, CircleAlert, TriangleAlert } from "lucide-react"

import { MEDICAL_OUTCOME_LABELS } from "@/config/constants"
import { cn } from "@/lib/utils"
import type { MedicalOutcome } from "@/types/domain"

const STYLE: Record<MedicalOutcome, string> = {
  normal: "text-gain bg-gain/10 ring-gain/25",
  borderline: "text-warn bg-warn/10 ring-warn/30",
  abnormal: "text-danger bg-danger/10 ring-danger/30",
  unknown: "text-muted-foreground bg-muted ring-border",
}
const ICON = { normal: CircleCheck, borderline: CircleAlert, abnormal: TriangleAlert, unknown: CircleHelp } as const

export function OutcomeBadge({ outcome, className }: { outcome: MedicalOutcome; className?: string }) {
  const Icon = ICON[outcome]
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset",
        STYLE[outcome],
        className,
      )}
    >
      <Icon className="size-3" aria-hidden />
      {MEDICAL_OUTCOME_LABELS[outcome]}
    </span>
  )
}
