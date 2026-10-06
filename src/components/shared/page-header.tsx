import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

interface PageHeaderProps {
  eyebrow?: string
  title: string
  description?: string
  icon?: LucideIcon
  actions?: ReactNode
  className?: string
}

export function PageHeader({ eyebrow, title, description, icon: Icon, actions, className }: PageHeaderProps) {
  return (
    <div className={cn("mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between", className)}>
      <div className="flex min-w-0 items-start gap-4">
        {Icon && (
          <span className="hidden size-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-neon/20 to-bia/20 text-neon ring-1 ring-inset ring-neon/25 shadow-[0_8px_24px_-12px_var(--neon)] sm:grid">
            <Icon className="size-6" />
          </span>
        )}
        <div className="min-w-0">
          {eyebrow && (
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-neon/90">{eyebrow}</p>
          )}
          <h1 className="text-2xl font-semibold leading-tight sm:text-[28px]">{title}</h1>
          {description && <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
