import { CircleCheck, Info, ShieldAlert, TriangleAlert, type LucideIcon } from "lucide-react"

import type { Insight, InsightKind } from "@/features/biometrics/engine/insights"
import { cn } from "@/lib/utils"

export const INSIGHT_KIND: Record<InsightKind, { icon: LucideIcon; label: string; className: string }> = {
  alert: { icon: ShieldAlert, label: "Da segnalare", className: "text-danger bg-danger/10 ring-danger/25" },
  watch: { icon: TriangleAlert, label: "Da monitorare", className: "text-warn bg-warn/10 ring-warn/25" },
  strength: { icon: CircleCheck, label: "Punto di forza", className: "text-gain bg-gain/10 ring-gain/25" },
  info: { icon: Info, label: "Info", className: "text-muted-foreground bg-muted ring-border" },
}

export function InsightList({ insights, className }: { insights: Insight[]; className?: string }) {
  if (insights.length === 0) {
    return <p className="py-6 text-center text-xs text-muted-foreground">Nessuna osservazione.</p>
  }
  return (
    <ul className={cn("space-y-2", className)}>
      {insights.map((i) => {
        const k = INSIGHT_KIND[i.kind]
        const Icon = k.icon
        return (
          <li key={i.id} className="flex gap-3 rounded-xl surface-inset p-3">
            <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg ring-1 ring-inset", k.className)}>
              <Icon className="size-4" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium leading-snug">
                <span className="sr-only">{k.label}: </span>
                {i.title}
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{i.detail}</p>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
