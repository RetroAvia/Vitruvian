/**
 * Osservazioni sugli esami del sangue. Informative, non diagnostiche:
 * l'interpretazione spetta sempre al medico.
 */
import { formatDate, formatNumber } from "@/lib/format"

import type { Insight } from "@/features/biometrics/engine/insights"

import { derivedFlag, type DerivedIndex } from "./derived"
import type { AnalyteSeries } from "./series"
import { nearLimit } from "./status"

/** Esami che l'allenamento intenso può alterare transitoriamente */
const TRAINING_SENSITIVE = new Set(["ast", "alt", "cpk", "creatinine", "urea", "ldh"])

export function buildLabInsights(series: AnalyteSeries[], derived: DerivedIndex[], latestDate: string | null): Insight[] {
  const out: Insight[] = []
  const latestOnly = series.filter((s) => s.latest.date === latestDate)

  for (const s of latestOnly) {
    const v = s.latest.value
    if (v === null) continue
    const value = `${formatNumber(v, s.digits)}${s.unit ? ` ${s.unit}` : ""}`
    const range =
      s.latest.refLow !== null && s.latest.refHigh !== null
        ? `${formatNumber(s.latest.refLow, s.digits)}–${formatNumber(s.latest.refHigh, s.digits)}`
        : s.latest.refHigh !== null
          ? `< ${formatNumber(s.latest.refHigh, s.digits)}`
          : s.latest.refLow !== null
            ? `> ${formatNumber(s.latest.refLow, s.digits)}`
            : "—"

    if (s.latest.flag === "high" || s.latest.flag === "low") {
      const training = TRAINING_SENSITIVE.has(s.code)
      const wasOk = s.previous && s.previous.flag === "normal"
      out.push({
        id: `lab-${s.code}`,
        kind: training ? "watch" : "alert",
        title: `${s.name} ${s.latest.flag === "high" ? "alto" : "basso"}: ${value}`,
        detail: `Range ${range}.${wasOk ? " Era nel range al controllo precedente." : s.outOfRangeCount > 1 ? ` Fuori range in ${s.outOfRangeCount} referti.` : ""}${
          training ? " Può risentire dell'allenamento nei 2–3 giorni prima del prelievo." : ""
        }`,
      })
      continue
    }

    if (s.latest.flag === "normal" && s.previous && (s.previous.flag === "high" || s.previous.flag === "low")) {
      out.push({
        id: `lab-${s.code}-back`,
        kind: "strength",
        title: `${s.name} rientrato nel range`,
        detail: `${value} (range ${range}); al ${formatDate(s.previous.date, "medium")} era ${s.previous.flag === "high" ? "alto" : "basso"}.`,
      })
      continue
    }

    const near = nearLimit(v, s.latest.refLow, s.latest.refHigh)
    if (near && ((near === "high" && s.trend === "up") || (near === "low" && s.trend === "down"))) {
      out.push({
        id: `lab-${s.code}-near`,
        kind: "watch",
        title: `${s.name} vicino al limite ${near === "high" ? "superiore" : "inferiore"}`,
        detail: `${value} (range ${range}) con tendenza in ${near === "high" ? "aumento" : "calo"} negli ultimi referti.`,
      })
    }
  }

  for (const d of derived) {
    const last = d.points[d.points.length - 1]
    if (!last || last.date !== latestDate) continue
    const f = derivedFlag(d)
    if (f === "high" || f === "low") {
      out.push({
        id: `derived-${d.code}`,
        kind: "watch",
        title: `${d.name}: ${formatNumber(last.value, d.digits)}`,
        detail: d.description,
      })
    } else if (f === "normal" && ["tg_hdl", "homa_ir", "non_hdl"].includes(d.code)) {
      out.push({
        id: `derived-${d.code}`,
        kind: "strength",
        title: `${d.name} favorevole: ${formatNumber(last.value, d.digits)}`,
        detail: d.description,
      })
    }
  }

  const inRange = latestOnly.filter((s) => s.latest.flag === "normal").length
  const withRange = latestOnly.filter((s) => s.latest.flag !== "unknown").length
  if (withRange > 0) {
    out.push({
      id: "lab-summary",
      kind: inRange === withRange ? "strength" : "info",
      title: `${inRange} esami su ${withRange} nel range`,
      detail: `Ultimo referto del ${formatDate(latestDate, "long")}. Valori indicativi: l'interpretazione spetta al medico.`,
    })
  }

  const order = { alert: 0, watch: 1, strength: 2, info: 3 } as const
  return out.sort((a, b) => order[a.kind] - order[b.kind])
}
