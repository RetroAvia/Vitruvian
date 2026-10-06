"use client"

import { useId, useMemo, useState } from "react"
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

import { ChartCard, Segmented } from "@/components/charts/chart-card"
import {
  AXIS_PROPS,
  filterByRange,
  formatMonthTick,
  GRID_PROPS,
  monthTicks,
  paddedDomain,
  SERIES,
  toTime,
} from "@/components/charts/chart-utils"
import { ChartTooltip } from "@/components/charts/chart-tooltip"
import { METRICS, type MetricKey } from "@/features/biometrics/engine/metrics"
import { formatSigned, isNum } from "@/lib/format"
import { cn } from "@/lib/utils"
import { useUiStore } from "@/stores/ui-store"
import type { Checkup } from "@/types/domain"

const SITES: MetricKey[] = ["waist", "abdomen", "chest", "arm", "thigh"]
/** Colore fisso per sito (segue l'entità, non la posizione) */
const COLOR: Record<string, string> = Object.fromEntries(SITES.map((s, i) => [s, SERIES[i] as string]))

type Mode = "abs" | "delta"

export function CircumferenceChart({ checkups }: { checkups: Checkup[] }) {
  const range = useUiStore((s) => s.timeRange)
  const gid = useId().replace(/:/g, "")
  const [visible, setVisible] = useState<MetricKey[]>(SITES)
  const [mode, setMode] = useState<Mode>("abs")

  const all = useMemo(() => checkups.filter((c) => SITES.some((s) => isNum(METRICS[s].get(c)))), [checkups])
  const rows = useMemo(() => {
    const filtered = filterByRange(all, range)
    // Valori di partenza del periodo per la modalità "variazione"
    const base: Partial<Record<MetricKey, number>> = {}
    for (const s of SITES) {
      const firstWith = filtered.find((c) => isNum(METRICS[s].get(c)))
      if (firstWith) base[s] = METRICS[s].get(firstWith) as number
    }
    return filtered.map((c) => {
      const row: Record<string, number | string | null> = { t: toTime(c.checkup_date), date: c.checkup_date }
      for (const s of SITES) {
        const v = METRICS[s].get(c)
        row[s] = isNum(v) ? (mode === "delta" && base[s] !== undefined ? v - (base[s] as number) : v) : null
        row[`${s}_abs`] = v
      }
      return row
    })
  }, [all, range, mode])

  const isolated = visible.length === 1
  const min = (rows[0]?.t as number) ?? 0
  const max = (rows[rows.length - 1]?.t as number) ?? 1
  const domain = paddedDomain(
    rows.flatMap((r) => visible.map((s) => r[s] as number | null)),
    0.12,
    mode === "delta" ? 1 : isolated ? 1 : 5,
  )

  function toggle(site: MetricKey) {
    setVisible((v) => (v.includes(site) ? (v.length === 1 ? v : v.filter((x) => x !== site)) : [...v, site]))
  }

  return (
    <ChartCard
      title="Andamento delle circonferenze"
      description={
        mode === "delta"
          ? "Variazione in cm dall'inizio del periodo: confronta i siti sulla stessa scala."
          : "Clicca un sito per mostrarlo o nasconderlo; doppio clic per isolarlo."
      }
      actions={
        <Segmented<Mode>
          label="Modalità"
          value={mode}
          onChange={setMode}
          options={[
            { value: "abs", label: "Valori" },
            { value: "delta", label: "Variazione" },
          ]}
        />
      }
      legend={
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Siti visibili">
          {SITES.map((s) => {
            const on = visible.includes(s)
            return (
              <button
                key={s}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(s)}
                onDoubleClick={() => setVisible([s])}
                className={cn(
                  "inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  on ? "border-border bg-accent/60 text-foreground" : "border-dashed text-muted-foreground opacity-60",
                )}
              >
                <span className="size-2.5 rounded-[3px]" style={{ background: COLOR[s] }} aria-hidden />
                {METRICS[s].label}
              </button>
            )
          })}
          {visible.length < SITES.length && (
            <button
              type="button"
              onClick={() => setVisible(SITES)}
              className="h-7 rounded-full px-2.5 text-xs text-muted-foreground underline-offset-2 hover:underline"
            >
              Tutti
            </button>
          )}
        </div>
      }
    >
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
            <defs>
              {SITES.map((s) => (
                <linearGradient key={s} id={`c-${gid}-${s}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={COLOR[s]} stopOpacity={isolated ? 0.35 : 0.08} />
                  <stop offset="100%" stopColor={COLOR[s]} stopOpacity={0} />
                </linearGradient>
              ))}
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
            <YAxis {...AXIS_PROPS} domain={domain} unit=" cm" width={60} allowDataOverflow />
            {mode === "delta" && <ReferenceLine y={0} stroke="var(--chart-axis)" strokeOpacity={0.7} />}
            <Tooltip
              cursor={{ stroke: "var(--chart-axis)", strokeWidth: 1 }}
              content={({ active, payload }) => {
                const r = payload?.[0]?.payload as Record<string, number | string | null> | undefined
                if (!r) return null
                return (
                  <ChartTooltip
                    active={active}
                    date={r.date as string}
                    items={visible.map((s) => ({
                      label: METRICS[s].label,
                      value: r[`${s}_abs`] as number | null,
                      unit: "cm",
                      color: COLOR[s],
                      note: mode === "delta" && isNum(r[s]) ? `${formatSigned(r[s] as number, 1)}` : undefined,
                    }))}
                  />
                )
              }}
            />
            {visible.map((s) => (
              <Area
                key={s}
                type="monotone"
                dataKey={s}
                name={METRICS[s].label}
                stroke={COLOR[s]}
                strokeWidth={2}
                fill={`url(#c-${gid}-${s})`}
                connectNulls
                dot={{ r: isolated ? 4 : 3, fill: COLOR[s], stroke: "var(--chart-surface)", strokeWidth: 2 }}
                activeDot={{ r: 5.5, fill: COLOR[s], stroke: "var(--chart-surface)", strokeWidth: 2 }}
                isAnimationActive={false}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  )
}
