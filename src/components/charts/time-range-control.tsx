"use client"

import { TIME_RANGE_LABELS, useUiStore, type TimeRange } from "@/stores/ui-store"

import { Segmented } from "./chart-card"

export function TimeRangeControl() {
  const range = useUiStore((s) => s.timeRange)
  const setRange = useUiStore((s) => s.setTimeRange)
  return (
    <Segmented<TimeRange>
      label="Periodo dei grafici"
      value={range}
      onChange={setRange}
      options={(Object.keys(TIME_RANGE_LABELS) as TimeRange[]).map((r) => ({ value: r, label: TIME_RANGE_LABELS[r] }))}
    />
  )
}
