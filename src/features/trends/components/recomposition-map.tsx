"use client"

import { useMemo } from "react"
import {
  CartesianGrid,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { LegendItem } from "@/components/charts/chart-card"
import { AXIS_PROPS, SERIES } from "@/components/charts/chart-utils"
import { ChartTooltip } from "@/components/charts/chart-tooltip"
import { GlassCard } from "@/components/shared/glass-card"
import { InfoTip } from "@/components/shared/info-tip"
import { NOISE, type RecompResult } from "@/features/biometrics/engine/recomposition"
import type { Segment } from "@/features/biometrics/engine/segments"
import { formatDate } from "@/lib/format"

interface Point {
  x: number
  y: number
  r: RecompResult
  latest: boolean
}

/** Mappa della ricomposizione: ogni punto è un intervallo tra due visite (ΔFFM × ΔMG). */
export function RecompositionMap({
  last,
  intervals,
  segments,
}: {
  last: RecompResult | null
  intervals: RecompResult[]
  segments: Segment[]
}) {
  // Colore = strumento (identità), non esito: l'esito è nel testo e nel tooltip
  const recent = segments.slice(-3)
  const colorOf = (r: RecompResult) => {
    const idx = recent.findIndex((s) => s.checkups.some((c) => c.id === r.to.id))
    return idx >= 0 ? SERIES[[0, 2, 3][idx] ?? 0] : "var(--chart-axis)"
  }

  const series = useMemo(() => {
    const pts = intervals
      .filter((r) => r.dFatKg !== null && r.dFfmKg !== null)
      .map((r) => ({ x: r.dFfmKg as number, y: r.dFatKg as number, r, latest: r.to.id === last?.to.id }))
    return recent.map((s) => ({ segment: s, points: pts.filter((p) => s.checkups.some((c) => c.id === p.r.to.id)) }))
  }, [intervals, recent, last])

  const extent = Math.max(
    3,
    ...intervals.flatMap((r) => [Math.abs(r.dFatKg ?? 0), Math.abs(r.dFfmKg ?? 0)]),
  )
  const lim = Math.ceil(extent + 0.5)

  return (
    <GlassCard id="ricomposizione" className="flex scroll-mt-24 flex-col p-5 sm:p-6">
      <h3 className="flex items-center gap-1.5 text-sm font-semibold">
        Mappa della ricomposizione <InfoTip term="recomposition" />
      </h3>
      <p className="mt-0.5 max-w-3xl text-xs leading-relaxed text-muted-foreground">
        Ogni punto è il passaggio tra due visite con lo stesso strumento: a destra cresce la massa magra, in alto cresce il grasso.
        L&apos;area in basso a destra è la ricomposizione ideale; l&apos;area grigia centrale è entro l&apos;errore di misura.
      </p>

      {intervals.length > 0 && (
        <>
          <div className="relative mt-5 h-80" role="img" aria-label="Mappa degli intervalli: variazione massa magra sull'asse orizzontale, variazione massa grassa su quello verticale">
            {/* Etichette dei quadranti */}
            <span className="pointer-events-none absolute right-4 top-3 rounded bg-card/80 px-1.5 text-[11px] text-muted-foreground">↗ Massa</span>
            <span className="pointer-events-none absolute left-16 top-3 rounded bg-card/80 px-1.5 text-[11px] text-danger/90">↖ Peggioramento</span>
            <span className="pointer-events-none absolute bottom-12 right-4 rounded bg-card/80 px-1.5 text-[11px] text-gain">↘ Ricomposizione</span>
            <span className="pointer-events-none absolute bottom-12 left-16 rounded bg-card/80 px-1.5 text-[11px] text-muted-foreground">↙ Perdita</span>
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 12, right: 12, bottom: 24, left: 4 }}>
                <CartesianGrid stroke="var(--chart-grid)" />
                <ReferenceArea
                  x1={-NOISE.ffmKg}
                  x2={NOISE.ffmKg}
                  y1={-NOISE.fatKg}
                  y2={NOISE.fatKg}
                  fill="var(--chart-axis)"
                  fillOpacity={0.12}
                  stroke="none"
                />
                <ReferenceLine x={0} stroke="var(--chart-axis)" strokeOpacity={0.6} />
                <ReferenceLine y={0} stroke="var(--chart-axis)" strokeOpacity={0.6} />
                <XAxis
                  type="number"
                  dataKey="x"
                  domain={[-lim, lim]}
                  name="Δ massa magra"
                  unit=" kg"
                  {...AXIS_PROPS}
                  tickCount={7}
                  label={{ value: "Δ massa magra (kg)", position: "insideBottom", offset: -16, fill: "var(--chart-axis)", fontSize: 11 }}
                />
                <YAxis
                  type="number"
                  dataKey="y"
                  domain={[-lim, lim]}
                  name="Δ grasso"
                  {...AXIS_PROPS}
                  tickCount={7}
                  width={44}
                  label={{ value: "Δ grasso (kg)", angle: -90, position: "insideLeft", offset: 8, fill: "var(--chart-axis)", fontSize: 11 }}
                />
                <Tooltip
                  cursor={false}
                  content={({ active, payload }) => {
                    const p = payload?.[0]?.payload as Point | undefined
                    if (!p) return null
                    return (
                      <ChartTooltip
                        active={active}
                        date={p.r.to.checkup_date}
                        subtitle={`dal ${formatDate(p.r.from?.checkup_date)} · ${p.r.title}`}
                        items={[
                          { label: "Δ Massa grassa", value: p.r.dFatKg, unit: "kg" },
                          { label: "Δ Massa magra", value: p.r.dFfmKg, unit: "kg" },
                          { label: "Δ Peso", value: p.r.dWeight, unit: "kg" },
                        ]}
                      />
                    )
                  }}
                />
                {series.map(({ segment, points }) => (
                  <Scatter
                    key={segment.index}
                    data={points}
                    fill={colorOf(points[0]?.r ?? intervals[0]!)}
                    stroke="var(--chart-surface)"
                    strokeWidth={2}
                    shape={(props: { cx?: number; cy?: number; payload?: Point; fill?: string }) => (
                      <circle
                        cx={props.cx}
                        cy={props.cy}
                        r={props.payload?.latest ? 7 : 4.5}
                        fill={props.fill}
                        stroke={props.payload?.latest ? "var(--foreground)" : "var(--chart-surface)"}
                        strokeWidth={2}
                      />
                    )}
                    isAnimationActive={false}
                  />
                ))}
              </ScatterChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            {series.map(({ segment, points }) =>
              points.length ? (
                <LegendItem key={segment.index} color={colorOf(points[0]!.r)} label={segment.protocolName ?? "Senza strumento"} />
              ) : null,
            )}
            <span className="text-[11px] text-muted-foreground">Cerchio grande bordato = ultimo intervallo</span>
          </div>
        </>
      )}
    </GlassCard>
  )
}
