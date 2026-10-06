"use client"

import { useMemo } from "react"
import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

import { ChartCard, LegendItem } from "@/components/charts/chart-card"
import { AXIS_PROPS, filterByRange, formatMonthTick, GRID_PROPS, monthTicks, toTime } from "@/components/charts/chart-utils"
import { ChartTooltip } from "@/components/charts/chart-tooltip"
import type { BiometricReport } from "@/features/biometrics/engine/report"
import { isNum } from "@/lib/format"
import { useUiStore } from "@/stores/ui-store"

const FFM = "var(--series-1)"
const FAT = "var(--series-2)"

interface Row {
  t: number
  date: string
  ffm: number
  fat: number
  weight: number | null
  fatPct: number | null
  protocol: string | null
}

/** Barre impilate: massa magra + massa grassa = peso. Una sola scala (kg). */
export function CompositionChart({ report }: { report: BiometricReport }) {
  const range = useUiStore((s) => s.timeRange)

  const rows = useMemo<Row[]>(
    () =>
      filterByRange(report.chronological, range)
        .filter((c) => isNum(c.ffm_kg) && isNum(c.fat_mass_kg))
        .map((c) => ({
          t: toTime(c.checkup_date),
          date: c.checkup_date,
          ffm: c.ffm_kg as number,
          fat: c.fat_mass_kg as number,
          weight: c.weight_kg,
          fatPct: c.fat_mass_pct,
          protocol: c.protocol_name,
        })),
    [report.chronological, range],
  )

  const changes = report.segments.slice(1).map((s) => ({ t: toTime(s.start), name: s.protocolName }))
  const min = rows[0]?.t ?? 0
  const max = rows[rows.length - 1]?.t ?? 1
  const pad = Math.max((max - min) * 0.04, 20 * 86_400_000)
  const maxWeight = Math.max(...rows.map((r) => r.ffm + r.fat), 10)

  return (
    <ChartCard
      title="Composizione corporea"
      info="ffm"
      description="Massa magra (FFM) e massa grassa in kg: l'altezza della barra è il peso."
      legend={
        <>
          <LegendItem color={FFM} label="Massa magra (FFM)" />
          <LegendItem color={FAT} label="Massa grassa" />
          {changes.length > 0 && <LegendItem color="var(--bia)" label="Cambio strumento" dashed />}
        </>
      }
      footer="FFM = peso × (1 − massa grassa %): confrontabile anche se lo strumento cambia definizione di “massa magra”."
    >
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -12 }} barCategoryGap={2}>
            <CartesianGrid {...GRID_PROPS} />
            <XAxis
              dataKey="t"
              type="number"
              scale="time"
              domain={[min - pad, max + pad]}
              ticks={monthTicks(min, max)}
              tickFormatter={formatMonthTick}
              {...AXIS_PROPS}
            />
            <YAxis {...AXIS_PROPS} domain={[0, Math.ceil(maxWeight / 10) * 10]} unit=" kg" width={56} />
            <Tooltip
              cursor={{ fill: "var(--foreground)", fillOpacity: 0.04 }}
              content={({ active, payload }) => {
                const r = payload?.[0]?.payload as Row | undefined
                if (!r) return null
                return (
                  <ChartTooltip
                    active={active}
                    date={r.date}
                    subtitle={r.protocol}
                    items={[
                      { label: "Peso", value: r.weight, unit: "kg", emphasis: true },
                      { label: "Massa magra", value: r.ffm, unit: "kg", color: FFM },
                      { label: "Massa grassa", value: r.fat, unit: "kg", color: FAT, note: r.fatPct != null ? `${String(r.fatPct).replace(".", ",")}%` : undefined },
                    ]}
                  />
                )
              }}
            />
            {changes.map((c) => (
              <ReferenceLine
                key={c.t}
                x={c.t - 15 * 86_400_000}
                stroke="var(--bia)"
                strokeDasharray="4 4"
                strokeWidth={1.5}
              />
            ))}
            <Bar dataKey="ffm" stackId="kg" fill={FFM} stroke="var(--chart-surface)" strokeWidth={2} barSize={16} isAnimationActive={false} />
            <Bar
              dataKey="fat"
              stackId="kg"
              fill={FAT}
              stroke="var(--chart-surface)"
              strokeWidth={2}
              radius={[4, 4, 0, 0]}
              barSize={16}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  )
}
