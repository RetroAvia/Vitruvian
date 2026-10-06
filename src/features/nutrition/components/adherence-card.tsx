import { CalendarCheck } from "lucide-react"

import { GlassCard } from "@/components/shared/glass-card"
import { formatDate, formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"

import type { DayAdherence } from "../engine/adherence"

/** Ultimi 14 giorni: un quadrato per giorno, intensità = % pasti completati. */
export function AdherenceCard({ series, score, tracked }: { series: DayAdherence[]; score: number | null; tracked: number }) {
  return (
    <GlassCard className="p-5">
      <div className="flex items-center gap-3">
        <span className="grid size-9 place-items-center rounded-xl bg-gain/10 text-gain ring-1 ring-inset ring-gain/25">
          <CalendarCheck className="size-4" />
        </span>
        <div>
          <h2 className="text-sm font-semibold">Aderenza</h2>
          <p className="text-xs text-muted-foreground">Ultimi {series.length} giorni · {tracked} registrati</p>
        </div>
        <p className="ml-auto font-display text-2xl font-semibold tabular">
          {score === null ? "—" : `${formatNumber(score * 100, 0)}%`}
        </p>
      </div>
      <ol className="mt-4 grid grid-cols-7 gap-1.5">
        {series.map((d) => (
          <li
            key={d.date}
            title={`${formatDate(d.date, "medium")}: ${d.ratio === null ? "non registrato" : `${d.done} fatti, ${d.swapped} sostituiti, ${d.skipped} saltati su ${d.expected}`}`}
            className={cn(
              "flex aspect-square items-center justify-center rounded-md text-[10px] tabular ring-1 ring-inset ring-border",
              d.ratio === null && "bg-muted/40 text-muted-foreground/60",
            )}
            style={d.ratio === null ? undefined : { background: `color-mix(in oklab, var(--gain) ${Math.round(15 + d.ratio * 70)}%, transparent)` }}
          >
            {Number(d.date.slice(8))}
          </li>
        ))}
      </ol>
      <p className="mt-3 text-[11px] text-muted-foreground">Più intenso = più pasti completati. I giorni non registrati non contano nel punteggio.</p>
    </GlassCard>
  )
}
