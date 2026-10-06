"use client"

import { useId, useMemo } from "react"
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

import { ChartCard } from "@/components/charts/chart-card"
import {
  AXIS_PROPS,
  filterByRange,
  formatMonthTick,
  GRID_PROPS,
  monthTicks,
  paddedDomain,
  toTime,
} from "@/components/charts/chart-utils"
import { ChartTooltip } from "@/components/charts/chart-tooltip"
import type { BiometricReport } from "@/features/biometrics/engine/report"
import { formatNumber, formatSigned, isNum } from "@/lib/format"
import { useUiStore } from "@/stores/ui-store"

const COLOR = "var(--series-1)"

interface Row {
  t: number
  date: string
  weight: number
  delta: number | null
}

export function WeightChart({ report }: { report: BiometricReport }) {
  const range = useUiStore((s) => s.timeRange)
  const gid = useId().replace(/:/g, "")

  const rows = useMemo<Row[]>(() => {
    const all = report.chronological.filter((c) => isNum(c.weight_kg))
    const filtered = filterByRange(all, range)
    return filtered.map((c) => {
      const i = all.findIndex((x) => x.id === c.id)
      const prev = all[i - 1]
      return {
        t: toTime(c.checkup_date),
        date: c.checkup_date,
        weight: c.weight_kg as number,
        delta: prev && isNum(prev.weight_kg) ? (c.weight_kg as number) - prev.weight_kg : null,
      }
    })
  }, [report.chronological, range])

  const min = rows[0]?.t ?? 0
  const max = rows[rows.length - 1]?.t ?? 1
  const first = rows[0]
  const last = rows[rows.length - 1]

  return (
    <ChartCard
      title="Peso corporeo"
      description={
        first && last && first !== last
          ? `${formatNumber(first.weight, 1)} → ${formatNumber(last.weight, 1)} kg (${formatSigned(last.weight - first.weight, 1)} kg nel periodo)`
          : "Andamento del peso alle visite"
      }
    >
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
            <defs>
              <linearGradient id={`w-${gid}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={COLOR} stopOpacity={0.35} />
                <stop offset="100%" stopColor={COLOR} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid {...GRID_PROPS} />
            <XAxis
              dataKey="t"
              type="number"
              scale="time"
              domain={[min, max]}
              ticks={monthTicks(min, max)}
              tickFormatter={formatMonthTick}
              {...AXIS_PROPS}
            />
            <YAxis {...AXIS_PROPS} domain={paddedDomain(rows.map((r) => r.weight), 0.15, 1)} unit=" kg" width={56} />
            {first && <ReferenceLine y={first.weight} stroke="var(--chart-axis)" strokeDasharray="3 4" strokeOpacity={0.6} />}
            <Tooltip
              cursor={{ stroke: "var(--chart-axis)", strokeWidth: 1 }}
              content={({ active, payload }) => {
                const r = payload?.[0]?.payload as Row | undefined
                if (!r) return null
                return (
                  <ChartTooltip
                    active={active}
                    date={r.date}
                    items={[
                      { label: "Peso", value: r.weight, unit: "kg", color: COLOR, emphasis: true },
                      { label: "vs precedente", value: r.delta, unit: "kg" },
                    ]}
                  />
                )
              }}
            />
            <Area
              type="monotone"
              dataKey="weight"
              stroke={COLOR}
              strokeWidth={2}
              fill={`url(#w-${gid})`}
              dot={{ r: 4, fill: COLOR, stroke: "var(--chart-surface)", strokeWidth: 2 }}
              activeDot={{ r: 6, fill: COLOR, stroke: "var(--chart-surface)", strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  )
}
