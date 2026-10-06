"use client"

import dynamic from "next/dynamic"
import { Activity, Gauge, Layers, Ruler, ScanLine, TriangleAlert } from "lucide-react"
import { useMemo } from "react"

import { filterByRange } from "@/components/charts/chart-utils"
import { TimeRangeControl } from "@/components/charts/time-range-control"
import { EmptyState } from "@/components/shared/empty-state"
import { PageHeader } from "@/components/shared/page-header"
import { SectionHeader } from "@/components/shared/section-header"
import { Skeleton } from "@/components/ui/skeleton"
import { METRICS } from "@/features/biometrics/engine/metrics"
import { useBiometricReport } from "@/features/biometrics/hooks/use-biometric-report"
import { useUiStore } from "@/stores/ui-store"

import { SegmentsTable } from "./segments-table"

// Grafici caricati su richiesta: Recharts non pesa sul primo caricamento
const CircumferenceChart = dynamic(() => import("./circumference-chart").then((m) => m.CircumferenceChart), { ssr: false, loading: () => <Skeleton className="h-[420px] rounded-2xl" /> })
const MetricSparklineCard = dynamic(() => import("./metric-sparkline-card").then((m) => m.MetricSparklineCard), { ssr: false, loading: () => <Skeleton className="h-40 rounded-2xl" /> })
const RecompositionMap = dynamic(() => import("./recomposition-map").then((m) => m.RecompositionMap), { ssr: false, loading: () => <Skeleton className="h-[380px] rounded-2xl" /> })

export function TrendsView() {
  const { report, isPending, error } = useBiometricReport()
  const range = useUiStore((s) => s.timeRange)
  const rows = useMemo(() => (report ? filterByRange(report.chronological, range) : []), [report, range])

  const header = (
    <PageHeader
      icon={Activity}
      title="Trend"
      description="Circonferenze, indici e ricomposizione nel tempo. Le linee dei valori BIA si interrompono al cambio di strumento perché i valori non sono confrontabili."
      actions={<TimeRangeControl />}
    />
  )

  if (isPending) {
    return (
      <>
        {header}
        <Skeleton className="h-96 rounded-2xl" />
      </>
    )
  }
  if (error || !report) {
    return (
      <>
        {header}
        <EmptyState icon={TriangleAlert} title="Impossibile caricare i dati" description={error?.message} />
      </>
    )
  }

  return (
    <>
      {header}
      <div className="space-y-10">
        <section aria-labelledby="t-circ">
          <SectionHeader id="t-circ" icon={Ruler} title="Circonferenze" description="Misure indipendenti dallo strumento BIA: confrontabili su tutto lo storico." />
          <CircumferenceChart checkups={report.chronological} />
        </section>

        <section aria-labelledby="t-recomp">
          <SectionHeader id="t-recomp" icon={ScanLine} title="Ricomposizione" description="Come si sono mosse insieme massa grassa e massa magra a ogni intervallo." />
          <RecompositionMap last={report.lastRecomp} intervals={report.intervals} segments={report.segments} />
        </section>

        <section aria-labelledby="t-index">
          <SectionHeader id="t-index" icon={Gauge} title="Indici" description="Una metrica per grafico, ciascuna sulla sua scala." />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <MetricSparklineCard
            metric={METRICS.fat_pct}
            checkups={rows}
            segments={report.segments}
            color="var(--series-2)"
          />
          <MetricSparklineCard
            metric={METRICS.ffm}
            checkups={rows}
            segments={report.segments}
            color="var(--series-1)"
          />
          <MetricSparklineCard
            metric={METRICS.ffmi}
            checkups={rows}
            segments={report.segments}
            color="var(--series-3)"
            note="FFMI = massa magra / altezza²"
          />
          <MetricSparklineCard
            metric={METRICS.whtr}
            checkups={rows}
            segments={report.segments}
            color="var(--series-1)"
            band={{ from: 0, to: 0.5, label: "Area verde: sotto la soglia di rischio 0,50" }}
            step={0.01}
          />
          <MetricSparklineCard metric={METRICS.bmr} checkups={rows} segments={report.segments} color="var(--series-5)" step={50} />
          <MetricSparklineCard metric={METRICS.visceral} checkups={rows} segments={report.segments} color="var(--series-4)" />
          </div>
        </section>

        <section aria-labelledby="t-seg">
          <SectionHeader id="t-seg" icon={Layers} title="Bilancio per strumento" description="Prima e ultima visita di ogni strumento BIA: qui i confronti sono sempre validi." />
          <SegmentsTable segments={report.segments} />
        </section>
      </div>
    </>
  )
}
