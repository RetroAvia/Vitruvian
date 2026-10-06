import { ageAt } from "@/features/biometrics/engine/indices"
import type { Insight } from "@/features/biometrics/engine/insights"
import type { LabResult, Profile } from "@/types/domain"

import { computeDerived, type DerivedIndex } from "./derived"
import { buildLabInsights } from "./insights"
import { buildSeries, type AnalyteSeries } from "./series"

export interface LabReportSummary {
  series: AnalyteSeries[]
  derived: DerivedIndex[]
  insights: Insight[]
  latestDate: string | null
  reportDates: string[]
  outOfRange: number
}

export function analyzeLabs(results: LabResult[], profile: Profile | null): LabReportSummary {
  const series = buildSeries(results)
  const reportDates = [...new Set(results.map((r) => r.report_date))].sort()
  const latestDate = reportDates[reportDates.length - 1] ?? null
  const derived = computeDerived(series, {
    sex: profile?.sex ?? null,
    ageAt: (d) => ageAt(profile?.birth_date, d),
  })
  return {
    series,
    derived,
    insights: buildLabInsights(series, derived, latestDate),
    latestDate,
    reportDates,
    outOfRange: series.filter((s) => s.latest.date === latestDate && (s.latest.flag === "high" || s.latest.flag === "low")).length,
  }
}
