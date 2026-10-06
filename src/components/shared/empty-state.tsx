import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

import { GlassCard } from "./glass-card"

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  badge?: string
  action?: ReactNode
  className?: string
}

export function EmptyState({ icon: Icon, title, description, badge, action, className }: EmptyStateProps) {
  return (
    <GlassCard className={cn("flex flex-col items-center px-6 py-14 text-center", className)}>
      <div className="relative mb-5">
        <div className="absolute inset-0 rounded-2xl bg-neon/30 blur-xl" />
        <div className="relative grid size-14 place-items-center rounded-2xl border border-neon/30 bg-neon/10">
          <Icon className="size-6 text-neon" />
        </div>
      </div>
      {badge && (
        <span className="mb-3 rounded-full border border-bia/30 bg-bia/10 px-2.5 py-0.5 text-[11px] font-medium text-bia">
          {badge}
        </span>
      )}
      <h2 className="text-lg font-semibold">{title}</h2>
      {description && <p className="mt-1.5 max-w-md text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </GlassCard>
  )
}
