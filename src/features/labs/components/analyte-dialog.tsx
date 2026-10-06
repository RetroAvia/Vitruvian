"use client"

import { useMemo } from "react"
import { CartesianGrid, Line, LineChart, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

import { AXIS_PROPS, formatMonthTick, GRID_PROPS, monthTicks, paddedDomain, toTime } from "@/components/charts/chart-utils"
import { ChartTooltip } from "@/components/charts/chart-tooltip"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { LAB_CATEGORY_LABELS } from "@/config/constants"
import type { AnalyteSeries, LabPoint } from "@/features/labs/engine/series"
import { formatDate, formatNumber, formatSigned, isNum } from "@/lib/format"

import { LabStatusBadge } from "./lab-status"

function rangeText(p: LabPoint, digits: number) {
  if (isNum(p.refLow) && isNum(p.refHigh)) return `${formatNumber(p.refLow, digits)}–${formatNumber(p.refHigh, digits)}`
  if (isNum(p.refHigh)) return `< ${formatNumber(p.refHigh, digits)}`
  if (isNum(p.refLow)) return `> ${formatNumber(p.refLow, digits)}`
  return "—"
}

export function AnalyteDialog({ series, onOpenChange }: { series: AnalyteSeries | null; onOpenChange: (o: boolean) => void }) {
  const rows = useMemo(
    () => (series?.points ?? []).filter((p) => isNum(p.value)).map((p) => ({ ...p, t: toTime(p.date) })),
    [series],
  )
  if (!series) return <Dialog open={false} onOpenChange={onOpenChange} />

  const min = rows[0]?.t ?? 0
  const max = rows[rows.length - 1]?.t ?? 1
  const refLow = series.latest.refLow
  const refHigh = series.latest.refHigh
  const domain = paddedDomain(
    [...rows.map((r) => r.value), refLow, refHigh],
    0.15,
    series.digits >= 2 ? 0.1 : 1,
  )

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neon">{LAB_CATEGORY_LABELS[series.category]}</p>
          <DialogTitle>{series.name}</DialogTitle>
          <DialogDescription>
            {series.points.length} {series.points.length === 1 ? "misurazione" : "misurazioni"}
            {series.slopePerYear !== null &&
              ` · tendenza ${formatSigned(series.slopePerYear, series.digits)}${series.unit ? ` ${series.unit}` : ""} all'anno`}
          </DialogDescription>
        </DialogHeader>

        {rows.length > 1 && (
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
                <CartesianGrid {...GRID_PROPS} />
                {(isNum(refLow) || isNum(refHigh)) && (
                  <ReferenceArea
                    y1={isNum(refLow) ? refLow : domain[0]}
                    y2={isNum(refHigh) ? refHigh : domain[1]}
                    fill="var(--gain)"
                    fillOpacity={0.08}
                    stroke="none"
                    ifOverflow="hidden"
                  />
                )}
                <XAxis
                  dataKey="t"
                  type="number"
                  scale="time"
                  domain={[min, max]}
                  ticks={monthTicks(min, max, 5)}
                  tickFormatter={formatMonthTick}
                  {...AXIS_PROPS}
                />
                <YAxis {...AXIS_PROPS} domain={domain} width={52} />
                <Tooltip
                  cursor={{ stroke: "var(--chart-axis)", strokeWidth: 1 }}
                  content={({ active, payload }) => {
                    const p = payload?.[0]?.payload as (LabPoint & { t: number }) | undefined
                    if (!p) return null
                    return (
                      <ChartTooltip
                        active={active}
                        date={p.date}
                        subtitle={p.lab}
                        items={[{ label: series.name, value: p.value, unit: p.unit ?? undefined, digits: series.digits, color: "var(--series-1)" }]}
                        footer={`Range ${rangeText(p, series.digits)}`}
                      />
                    )
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="var(--series-1)"
                  strokeWidth={2}
                  dot={{ r: 4, fill: "var(--series-1)", stroke: "var(--chart-surface)", strokeWidth: 2 }}
                  activeDot={{ r: 6 }}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm tabular">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="py-2 pr-3 font-medium">Data</th>
                <th className="py-2 pr-3 text-right font-medium">Valore</th>
                <th className="py-2 pr-3 text-right font-medium">Range</th>
                <th className="py-2 pr-3 font-medium">Stato</th>
                <th className="py-2 font-medium">Laboratorio</th>
              </tr>
            </thead>
            <tbody>
              {[...series.points].reverse().map((p, i, arr) => {
                const prev = arr[i + 1]
                const d = isNum(p.value) && prev && isNum(prev.value) ? p.value - prev.value : null
                return (
                  <tr key={p.id} className="border-t">
                    <td className="whitespace-nowrap py-2 pr-3">{formatDate(p.date)}</td>
                    <td className="whitespace-nowrap py-2 pr-3 text-right">
                      {isNum(p.value) ? formatNumber(p.value, series.digits) : p.valueText}
                      {p.unit && isNum(p.value) && <span className="ml-1 text-xs text-muted-foreground">{p.unit}</span>}
                      {d !== null && <span className="ml-2 text-[11px] text-muted-foreground">{formatSigned(d, series.digits)}</span>}
                    </td>
                    <td className="whitespace-nowrap py-2 pr-3 text-right text-muted-foreground">
                      {rangeText(p, series.digits)}
                      {!p.refFromLab && (isNum(p.refLow) || isNum(p.refHigh)) && <sup title="Range generico">*</sup>}
                    </td>
                    <td className="py-2 pr-3">
                      <LabStatusBadge flag={p.flag} />
                    </td>
                    <td className="py-2 text-xs text-muted-foreground">{p.lab ?? "—"}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <p className="mt-2 text-[11px] text-muted-foreground">* range generico per sesso: il referto non riportava quello del laboratorio.</p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
