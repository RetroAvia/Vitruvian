"use client"

import { useId, useMemo } from "react"
import { Area, AreaChart, CartesianGrid, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

import { AXIS_PROPS, formatMonthTick, GRID_PROPS, monthTicks, paddedDomain, toTime } from "@/components/charts/chart-utils"
import { ChartTooltip } from "@/components/charts/chart-tooltip"
import { GlassCard } from "@/components/shared/glass-card"
import type { MetricDef } from "@/features/biometrics/engine/metrics"
import type { Segment } from "@/features/biometrics/engine/segments"
import { formatNumber, isNum } from "@/lib/format"
import type { Checkup } from "@/types/domain"

interface Props {
  metric: MetricDef
  checkups: Checkup[]
  segments: Segment[]
  color: string
  /** Fascia di riferimento evidenziata (es. 0–0,5 per vita/altezza) */
  band?: { from: number; to: number; label: string }
  note?: string
  step?: number
}

/**
 * Piccolo multiplo: una metrica, una scala. Per le metriche BIA la linea
 * si interrompe al cambio di strumento (i valori non sono confrontabili).
 */
export function MetricSparklineCard({ metric, checkups, segments, color, band, note, step = 1 }: Props) {
  const gid = useId().replace(/:/g, "")
  const rows = useMemo(() => {
    const out: Array<Record<string, number | string | null>> = []
    for (const c of checkups) {
      const v = metric.get(c)
      if (!isNum(v)) continue
      const segIdx = segments.findIndex((s) => s.checkups.some((x) => x.id === c.id))
      const row: Record<string, number | string | null> = {
        t: toTime(c.checkup_date),
        date: c.checkup_date,
        protocol: c.protocol_name,
        v,
      }
      // Una colonna per segmento → linee spezzate al cambio strumento
      if (metric.bia) segments.forEach((_, i) => (row[`s${i}`] = i === segIdx ? v : null))
      else row.s0 = v
      out.push(row)
    }
    return out
  }, [checkups, segments, metric])

  const keys = metric.bia ? segments.map((_, i) => `s${i}`) : ["s0"]
  const last = rows[rows.length - 1]
  const min = (rows[0]?.t as number) ?? 0
  const max = (last?.t as number) ?? 1

  return (
    <GlassCard className="flex flex-col p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">{metric.label}</h3>
        <p className="font-display text-xl font-semibold tabular">
          {formatNumber(last?.v as number | null, metric.digits)}
          {metric.unit && <span className="ml-0.5 text-xs font-normal text-muted-foreground">{metric.unit}</span>}
        </p>
      </div>
      <div className="mt-3 h-36">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={rows} margin={{ top: 6, right: 6, bottom: 0, left: -18 }}>
            <defs>
              <linearGradient id={`m-${gid}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.25} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid {...GRID_PROPS} />
            {band && (
              <ReferenceArea y1={band.from} y2={band.to} fill="var(--gain)" fillOpacity={0.06} stroke="none" ifOverflow="hidden" />
            )}
            <XAxis
              dataKey="t"
              type="number"
              scale="time"
              domain={[min, max]}
              ticks={monthTicks(min, max, 4)}
              tickFormatter={formatMonthTick}
              {...AXIS_PROPS}
            />
            <YAxis {...AXIS_PROPS} domain={paddedDomain(rows.map((r) => r.v as number), 0.15, step)} width={48} />
            <Tooltip
              cursor={{ stroke: "var(--chart-axis)", strokeWidth: 1 }}
              content={({ active, payload }) => {
                const r = payload?.[0]?.payload as Record<string, number | string | null> | undefined
                if (!r) return null
                return (
                  <ChartTooltip
                    active={active}
                    date={r.date as string}
                    subtitle={metric.bia ? (r.protocol as string | null) : null}
                    items={[{ label: metric.label, value: r.v as number, unit: metric.unit, digits: metric.digits, color }]}
                  />
                )
              }}
            />
            {keys.map((k) => (
              <Area
                key={k}
                type="monotone"
                dataKey={k}
                stroke={color}
                strokeWidth={2}
                fill={`url(#m-${gid})`}
                connectNulls={false}
                dot={{ r: 3, fill: color, stroke: "var(--chart-surface)", strokeWidth: 2 }}
                activeDot={{ r: 5, fill: color, stroke: "var(--chart-surface)", strokeWidth: 2 }}
                isAnimationActive={false}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
      {(note || band) && <p className="mt-2 text-[11px] text-muted-foreground">{note ?? band?.label}</p>}
    </GlassCard>
  )
}
