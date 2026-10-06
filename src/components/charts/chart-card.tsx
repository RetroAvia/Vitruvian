import type { ReactNode } from "react"

import { GlassCard } from "@/components/shared/glass-card"
import { InfoTip } from "@/components/shared/info-tip"
import type { GlossaryKey } from "@/config/glossary"
import { cn } from "@/lib/utils"

interface ChartCardProps {
  title: string
  description?: string
  actions?: ReactNode
  legend?: ReactNode
  footer?: ReactNode
  className?: string
  info?: GlossaryKey
  id?: string
  children: ReactNode
}

export function ChartCard({ title, description, actions, legend, footer, className, info, id, children }: ChartCardProps) {
  return (
    <GlassCard id={id} className={cn("flex flex-col scroll-mt-24 p-5 sm:p-6", className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold">
            {title}
            {info && <InfoTip term={info} />}
          </h3>
          {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-1.5">{actions}</div>}
      </div>
      {legend && <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">{legend}</div>}
      <div className="mt-4 min-h-0 flex-1">{children}</div>
      {footer && <div className="mt-3 text-[11px] text-muted-foreground">{footer}</div>}
    </GlassCard>
  )
}

/** Voce di legenda: quadratino colore + etichetta in inchiostro neutro. */
export function LegendItem({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      {dashed ? (
        <span className="h-0 w-4 border-t-2 border-dashed" style={{ borderColor: color }} aria-hidden />
      ) : (
        <span className="size-2.5 rounded-[3px]" style={{ background: color }} aria-hidden />
      )}
      {label}
    </span>
  )
}

/** Controllo segmentato (scelta singola) per filtri dei grafici. */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T
  options: Array<{ value: T; label: string }>
  onChange: (v: T) => void
  label: string
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-lg border bg-background/40 p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "h-7 rounded-md px-2.5 text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
            value === o.value ? "bg-accent text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
