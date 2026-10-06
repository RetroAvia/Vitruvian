"use client"

import { Activity, Droplets, Dumbbell, Flame, Gauge, Percent, Ruler, Scale, type LucideIcon } from "lucide-react"
import { useState } from "react"

import { Segmented } from "@/components/charts/chart-card"
import { InfoTip } from "@/components/shared/info-tip"
import type { GlossaryKey } from "@/config/glossary"
import { KpiCard, type Accent } from "@/components/shared/kpi-card"
import { computeDelta, DELTA_BASE_LABELS, type DeltaBase } from "@/features/biometrics/engine/deltas"
import { METRICS, type MetricKey } from "@/features/biometrics/engine/metrics"
import type { BiometricReport } from "@/features/biometrics/engine/report"
import { formatDate } from "@/lib/format"
import type { Checkup } from "@/types/domain"

const KPIS: Array<{ key: MetricKey; icon: LucideIcon; accent: Accent; info: GlossaryKey }> = [
  { key: "weight", icon: Scale, accent: "neon", info: "bmi" },
  { key: "fat_pct", icon: Percent, accent: "warn", info: "fat_pct" },
  { key: "ffm", icon: Dumbbell, accent: "gain", info: "ffm" },
  { key: "ffmi", icon: Activity, accent: "bia", info: "ffmi" },
  { key: "bmr", icon: Flame, accent: "warn", info: "bmr" },
  { key: "whtr", icon: Ruler, accent: "neon", info: "whtr" },
  { key: "visceral", icon: Gauge, accent: "danger", info: "visceral" },
  { key: "tbw_pct", icon: Droplets, accent: "bia", info: "tbw" },
]

export function KpiSection({ report }: { report: BiometricReport }) {
  const [base, setBase] = useState<DeltaBase>("previous")
  const latest = report.latest as Checkup
  const latestBia = report.latestBia ?? latest

  return (
    <section aria-labelledby="kpi-title" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p id="kpi-title" className="flex items-center gap-1.5 text-xs text-muted-foreground">
          Variazioni calcolate rispetto a <InfoTip term="delta_base" />
        </p>
        <Segmented<DeltaBase>
          label="Riferimento delle variazioni"
          value={base}
          onChange={setBase}
          options={[
            { value: "previous", label: "Precedente" },
            { value: "segment", label: "Inizio strumento" },
            { value: "baseline", label: "Prima visita" },
          ]}
        />
      </div>
      <div className="stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {KPIS.map(({ key, icon, accent, info }) => {
          const metric = METRICS[key]
          const target = metric.bia ? latestBia : latest
          const d = computeDelta(report.chronological, report.segments, target, metric, base)
          const caption = !d.comparable
            ? "strumento diverso"
            : d.from
              ? `${DELTA_BASE_LABELS[base]} · ${formatDate(d.from.checkup_date, "monthYear")}`
              : "nessun confronto"
          return (
            <KpiCard
                key={key}
                className="hover-lift"
                label={metric.unit === "%" && key === "fat_pct" ? "Massa grassa" : metric.label}
                value={metric.get(target)}
                unit={metric.unit || undefined}
                digits={metric.digits}
                icon={icon}
                accent={accent}
                delta={d.value}
                polarity={metric.polarity}
                caption={caption}
                info={info}
              />
          )
        })}
      </div>
    </section>
  )
}
