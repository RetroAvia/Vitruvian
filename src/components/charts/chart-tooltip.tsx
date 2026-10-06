import { formatDate, formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"

export interface TooltipItem {
  label: string
  value: number | null | undefined
  unit?: string
  digits?: number
  color?: string
  /** Riga secondaria (es. variazione) */
  note?: string
  emphasis?: boolean
}

interface ChartTooltipProps {
  active?: boolean
  date?: string
  subtitle?: string | null
  items: TooltipItem[]
  footer?: string
}

/** Tooltip in vetro: data, strumento, valori allineati. Il testo usa sempre l'inchiostro neutro. */
export function ChartTooltip({ active, date, subtitle, items, footer }: ChartTooltipProps) {
  if (!active || items.length === 0) return null
  return (
    <div className="glass min-w-48 rounded-xl px-3.5 py-3 text-xs shadow-xl">
      {date && <p className="font-semibold text-foreground">{formatDate(date, "long")}</p>}
      {subtitle && <p className="mt-0.5 text-[11px] text-muted-foreground">{subtitle}</p>}
      <dl className="mt-2.5 space-y-1.5">
        {items.map((it) => (
          <div key={it.label} className="flex items-center justify-between gap-6">
            <dt className="flex items-center gap-2 text-muted-foreground">
              {it.color && <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: it.color }} aria-hidden />}
              {it.label}
            </dt>
            <dd className={cn("text-right tabular text-foreground", it.emphasis && "font-semibold")}>
              {formatNumber(it.value, it.digits ?? 1)}
              {it.unit && it.value != null && <span className="ml-0.5 text-muted-foreground">{it.unit}</span>}
              {it.note && <span className="ml-1.5 text-[10px] text-muted-foreground">{it.note}</span>}
            </dd>
          </div>
        ))}
      </dl>
      {footer && <p className="mt-2.5 border-t pt-2 text-[10px] text-muted-foreground">{footer}</p>}
    </div>
  )
}
