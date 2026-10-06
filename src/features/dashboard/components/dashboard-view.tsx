"use client"

import { Activity, CalendarClock, Gauge, LayoutDashboard, ScanLine, Stethoscope, TriangleAlert } from "lucide-react"
import Link from "next/link"

import { TimeRangeControl } from "@/components/charts/time-range-control"
import { useSessionUser } from "@/components/layout/session-user-context"
import { EmptyState } from "@/components/shared/empty-state"
import { PageHeader } from "@/components/shared/page-header"
import { SectionHeader } from "@/components/shared/section-header"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useBiometricReport } from "@/features/biometrics/hooks/use-biometric-report"
import { formatDate } from "@/lib/format"

import { CompositionChart } from "./composition-chart"
import { EnergyCard } from "./energy-card"
import { HealthStatusCard } from "./health-status-card"
import { HeroCard } from "./hero-card"
import { KpiSection } from "./kpi-section"
import { RecompositionHistory } from "./recomposition-history"
import { WeightChart } from "./weight-chart"

const STALE_DAYS = 120

export function DashboardView() {
  const user = useSessionUser()
  const { report, profile, isPending, error } = useBiometricReport()

  const header = (
    <PageHeader
      icon={LayoutDashboard}
      title="Dashboard"
      description={
        report?.latest
          ? `${report.chronological.length} controlli dal ${formatDate(report.chronological[0]?.checkup_date, "medium")} al ${formatDate(report.latest.checkup_date, "medium")}`
          : "Il punto della situazione sulla tua composizione corporea."
      }
    />
  )

  if (isPending) {
    return (
      <>
        {header}
        <div className="space-y-6">
          <Skeleton className="h-64 rounded-2xl" />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-36 rounded-2xl" />
            ))}
          </div>
        </div>
      </>
    )
  }

  if (error) {
    return (
      <>
        {header}
        <EmptyState icon={TriangleAlert} title="Impossibile caricare i dati" description={error.message} />
      </>
    )
  }

  if (!report?.latest) {
    return (
      <>
        {header}
        <EmptyState
          icon={ScanLine}
          title="Nessuna visita registrata"
          description="Inserisci il primo controllo o importalo con l'AI Bridge: il motore biometrico si attiva dalla seconda visita."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button asChild className="rounded-xl">
                <Link href="/checkups?new=1">Aggiungi la prima visita</Link>
              </Button>
              <Button asChild variant="outline" className="rounded-xl">
                <Link href="/bridge">Importa con AI</Link>
              </Button>
            </div>
          }
        />
      </>
    )
  }

  const stale = report.daysSinceLatest !== null && report.daysSinceLatest > STALE_DAYS
  // Il banner copre già l'avviso "dati vecchi": niente doppioni nella lista
  const insights = stale ? report.insights.filter((i) => i.id !== "stale") : report.insights

  return (
    <>
      {header}
      <div className="space-y-10">
        <div className="space-y-4">
          {stale && (
            <div
              role="status"
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-warn/30 bg-warn/[0.08] px-4 py-3 text-sm shadow-[var(--shadow-card)]"
            >
              <span className="flex items-center gap-2">
                <CalendarClock className="size-4 shrink-0 text-warn" />
                Ultimo controllo {report.daysSinceLatest} giorni fa: i dati potrebbero non riflettere la situazione attuale.
              </span>
              <Button asChild size="sm" variant="outline" className="rounded-lg">
                <Link href="/checkups?new=1">Aggiungi visita</Link>
              </Button>
            </div>
          )}
          <HeroCard report={report} profile={profile} user={user} />
        </div>

        <section aria-labelledby="sec-kpi">
          <SectionHeader
            id="sec-kpi"
            icon={Gauge}
            title="Indicatori"
            description="Valori dell'ultima misura. Passa sul simbolo ⓘ per la spiegazione di ogni termine."
          />
          <KpiSection report={report} />
        </section>

        <section aria-labelledby="sec-trend">
          <SectionHeader
            id="sec-trend"
            icon={Activity}
            title="Andamento"
            description="Come sono cambiati peso e composizione nel periodo selezionato."
            actions={<TimeRangeControl />}
          />
          <div className="space-y-4">
            <CompositionChart report={report} />
            <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
              <WeightChart report={report} />
              <EnergyCard report={report} profile={profile} />
            </div>
          </div>
        </section>

        <section aria-labelledby="sec-analysis">
          <SectionHeader
            id="sec-analysis"
            icon={Stethoscope}
            title="Analisi"
            description="Osservazioni automatiche del motore biometrico e storico della ricomposizione."
          />
          <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
            <HealthStatusCard insights={insights} notes={report.notes} />
            <RecompositionHistory intervals={report.intervals} />
          </div>
        </section>
      </div>
    </>
  )
}
