/** Frasi di sintesi in linguaggio naturale per il riepilogo della dashboard. */
import { formatDate, formatNumber, formatSigned, isNum } from "@/lib/format"
import type { Profile } from "@/types/domain"

import { bodyFatBand, whtrBand } from "./reference"
import type { BiometricReport } from "./report"

export interface Summary {
  headline: string
  tone: "good" | "neutral" | "warn"
  sentences: string[]
}

export function buildSummary(r: BiometricReport, profile: Profile | null): Summary {
  const sentences: string[] = []
  const bia = r.latestBia
  const fat = bia && isNum(bia.fat_mass_pct) ? bodyFatBand(bia.fat_mass_pct, profile?.sex ?? null, r.age) : null
  const whtr = r.latest && isNum(r.latest.waist_to_height) ? whtrBand(r.latest.waist_to_height) : null

  const healthy = fat?.band === "optimal" && (whtr === null || whtr.band === "optimal")
  const issue = r.lastRecomp && (r.lastRecomp.tone === "bad" || r.lastRecomp.tone === "warn")

  let headline = "Ecco dove sei oggi"
  let tone: Summary["tone"] = "neutral"
  if (healthy && !issue) {
    headline = "Composizione in salute e andamento favorevole"
    tone = "good"
  } else if (healthy && issue) {
    headline = "Valori in salute, ma l'ultimo periodo va corretto"
    tone = "warn"
  } else if (fat && fat.band !== "optimal") {
    headline = "Ci sono margini di miglioramento"
    tone = "warn"
  }

  if (bia && isNum(bia.fat_mass_pct)) {
    sentences.push(
      `Massa grassa al ${formatNumber(bia.fat_mass_pct, 1)}% (${fat?.label.toLowerCase()})${
        isNum(r.latest?.waist_to_height) ? `, vita/altezza ${formatNumber(r.latest?.waist_to_height, 2)}` : ""
      }.`,
    )
  }
  const lr = r.lastRecomp
  if (lr && lr.type !== "insufficient" && lr.from) {
    sentences.push(
      `Dal ${formatDate(lr.from.checkup_date, "medium")}: ${lr.title.toLowerCase()} (grasso ${formatSigned(lr.dFatKg, 1)} kg, massa magra ${formatSigned(lr.dFfmKg, 1)} kg).`,
    )
  }
  const first = r.chronological.find((c) => isNum(c.weight_kg))
  if (first && r.latest && first.id !== r.latest.id && isNum(r.latest.weight_kg) && isNum(first.weight_kg)) {
    const dWaist = isNum(first.waist_cm) && isNum(r.latest.waist_cm) ? r.latest.waist_cm - first.waist_cm : null
    sentences.push(
      `In totale dal ${formatDate(first.checkup_date, "monthYear")}: peso ${formatSigned(r.latest.weight_kg - first.weight_kg, 1)} kg${
        dWaist !== null ? `, vita ${formatSigned(dWaist, 1)} cm` : ""
      }.`,
    )
  }
  return { headline, tone, sentences }
}
