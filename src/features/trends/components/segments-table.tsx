"use client"

import { ChartCard } from "@/components/charts/chart-card"
import { classifyRecomposition } from "@/features/biometrics/engine/recomposition"
import type { Segment } from "@/features/biometrics/engine/segments"
import { formatDate, formatSigned, isNum } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { Checkup } from "@/types/domain"

const TONE = { good: "text-gain", neutral: "text-muted-foreground", warn: "text-warn", bad: "text-danger" } as const

function delta(a: Checkup | undefined, b: Checkup | undefined, get: (c: Checkup) => number | null) {
  if (!a || !b) return null
  const x = get(a)
  const y = get(b)
  return isNum(x) && isNum(y) ? y - x : null
}

/** Bilancio per strumento: confronti BIA validi solo all'interno di ogni riga. */
export function SegmentsTable({ segments }: { segments: Segment[] }) {
  return (
    <ChartCard title="Variazioni per strumento" description="Peso e vita sono confrontabili tra strumenti, grasso e massa magra solo all'interno della riga" info="protocol">
      <div className="-mx-1 overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm tabular">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
              <th className="px-2 py-2 font-medium">Strumento</th>
              <th className="px-2 py-2 font-medium">Periodo</th>
              <th className="px-2 py-2 text-right font-medium">Visite</th>
              <th className="px-2 py-2 text-right font-medium">Δ Peso</th>
              <th className="px-2 py-2 text-right font-medium">Δ Grasso</th>
              <th className="px-2 py-2 text-right font-medium">Δ FFM</th>
              <th className="px-2 py-2 text-right font-medium">Δ Vita</th>
              <th className="px-2 py-2 font-medium">Esito</th>
            </tr>
          </thead>
          <tbody>
            {segments.map((s) => {
              const bia = s.checkups.filter((c) => isNum(c.fat_mass_kg) && isNum(c.ffm_kg))
              const first = s.checkups[0]
              const lastC = s.checkups[s.checkups.length - 1]
              const r = bia.length >= 2 ? classifyRecomposition(bia[0], bia[bia.length - 1] as Checkup) : null
              return (
                <tr key={s.index} className="border-t">
                  <td className="px-2 py-2.5 font-medium">{s.protocolName ?? "Non specificato"}</td>
                  <td className="whitespace-nowrap px-2 py-2.5 text-muted-foreground">
                    {formatDate(s.start, "monthYear")} → {formatDate(s.end, "monthYear")}
                  </td>
                  <td className="px-2 py-2.5 text-right">{s.checkups.length}</td>
                  <td className="px-2 py-2.5 text-right">{formatSigned(delta(first, lastC, (c) => c.weight_kg), 1)}</td>
                  <td className="px-2 py-2.5 text-right">{formatSigned(r?.dFatKg, 1)}</td>
                  <td className="px-2 py-2.5 text-right">{formatSigned(r?.dFfmKg, 1)}</td>
                  <td className="px-2 py-2.5 text-right">{formatSigned(delta(first, lastC, (c) => c.waist_cm), 1)}</td>
                  <td className={cn("px-2 py-2.5 text-xs font-medium", r ? TONE[r.tone] : "text-muted-foreground")}>
                    {r?.title ?? "—"}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </ChartCard>
  )
}
