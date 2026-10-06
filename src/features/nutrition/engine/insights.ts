import type { Insight } from "@/features/biometrics/engine/insights"
import type { RecompResult } from "@/features/biometrics/engine/recomposition"
import { formatNumber, formatSigned, isNum } from "@/lib/format"

import { BALANCE_LABELS, type EnergyBalance } from "./balance"
import { macroSplit, type Macros } from "./totals"

interface Input {
  balance: EnergyBalance
  day: Macros
  targetKcal: number | null
  proteinPerKg: number | null
  proteinPerFfm: number | null
  lastRecomp: RecompResult | null
  adherence: number | null
  trackedDays: number
}

export function buildNutritionInsights(i: Input): Insight[] {
  const out: Insight[] = []
  const b = i.balance

  if (b.status !== "unknown" && isNum(b.delta) && isNum(b.pct)) {
    out.push({
      id: "balance",
      kind: b.status === "deficit_aggressive" || b.status === "surplus_high" ? "watch" : "info",
      title: `${BALANCE_LABELS[b.status]}: ${formatSigned(b.delta, 0)} kcal/giorno`,
      detail: `Piano ${formatNumber(b.planKcal, 0)} kcal contro un TDEE stimato di ${formatNumber(b.tdee, 0)} kcal (${formatSigned(b.pct, 0)}%). Il TDEE è una stima: conta il trend del peso nelle prossime visite.`,
    })
  }
  if (b.belowBmr) {
    out.push({
      id: "below-bmr",
      kind: "watch",
      title: "Calorie del piano sotto il metabolismo basale",
      detail: `${formatNumber(b.planKcal, 0)} kcal contro un BMR di ${formatNumber(b.bmr, 0)} kcal: verifica con il nutrizionista che sia voluto.`,
    })
  }

  if (isNum(i.proteinPerKg)) {
    const p = i.proteinPerKg
    out.push({
      id: "protein",
      kind: p < 1.6 ? "watch" : p > 2.6 ? "info" : "strength",
      title: `Proteine ${formatNumber(p, 1)} g/kg${isNum(i.proteinPerFfm) ? ` (${formatNumber(i.proteinPerFfm, 1)} g/kg di massa magra)` : ""}`,
      detail:
        p < 1.6
          ? "Sotto 1,6 g/kg, la soglia indicata per mantenere e costruire massa magra con l'allenamento."
          : p > 2.6
            ? "Apporto molto alto: oltre 2,2 g/kg i benefici aggiuntivi sono minimi."
            : "Nel range 1,6–2,2 g/kg indicato per chi si allena con i pesi.",
    })
  }

  const split = macroSplit(i.day)
  if (i.day.kcal > 0 && split.fat > 0 && split.fat < 20) {
    out.push({
      id: "fat-low",
      kind: "watch",
      title: `Grassi al ${formatNumber(split.fat, 0)}% delle calorie`,
      detail: "Sotto il 20% può incidere su ormoni e assorbimento delle vitamine liposolubili.",
    })
  }
  if (i.day.kcal > 0 && i.day.fiber_g > 0 && i.day.fiber_g < 25) {
    out.push({
      id: "fiber-low",
      kind: "info",
      title: `Fibre ${formatNumber(i.day.fiber_g, 0)} g/giorno`,
      detail: "L'obiettivo generale è almeno 25–30 g al giorno.",
    })
  }
  if (isNum(i.targetKcal) && i.day.kcal > 0 && Math.abs(i.day.kcal - i.targetKcal) / i.targetKcal > 0.1) {
    out.push({
      id: "target-mismatch",
      kind: "info",
      title: "Totale degli alimenti diverso dall'obiettivo dichiarato",
      detail: `Somma degli alimenti ${formatNumber(i.day.kcal, 0)} kcal contro ${formatNumber(i.targetKcal, 0)} kcal indicate nel piano: alcuni valori potrebbero essere stimati.`,
    })
  }
  if (i.day.missing > 0) {
    out.push({
      id: "missing",
      kind: "info",
      title: `${i.day.missing} alimenti senza valori nutrizionali`,
      detail: "I totali del giorno sono sottostimati: reimporta la dieta chiedendo all'IA di stimarli.",
    })
  }

  // Incrocio con l'andamento della composizione corporea
  const r = i.lastRecomp
  if (r && r.type !== "insufficient") {
    const surplus = b.status === "surplus" || b.status === "surplus_high"
    const deficit = b.status === "deficit" || b.status === "deficit_aggressive"
    if (surplus && ["fat_gain", "dirty_bulk", "worsening"].includes(r.type)) {
      out.push({
        id: "cross-surplus",
        kind: "watch",
        title: "Surplus calorico e grasso in aumento",
        detail: `Nell'ultimo intervallo la massa grassa è variata di ${formatSigned(r.dFatKg, 1)} kg: il surplus potrebbe essere più alto del necessario.`,
      })
    } else if (deficit && (r.type === "lean_loss_alert" || r.type === "mixed_loss")) {
      out.push({
        id: "cross-deficit",
        kind: "watch",
        title: "Deficit e calo di massa magra",
        detail: "Valuta con il nutrizionista un deficit meno marcato o più proteine per proteggere la massa magra.",
      })
    } else if (r.tone === "good") {
      out.push({
        id: "cross-good",
        kind: "strength",
        title: `Piano coerente con i risultati: ${r.title.toLowerCase()}`,
        detail: "L'ultimo intervallo mostra un andamento favorevole della composizione corporea.",
      })
    }
  }

  if (i.adherence !== null && i.trackedDays >= 3) {
    const pct = i.adherence * 100
    out.push({
      id: "adherence",
      kind: pct >= 85 ? "strength" : pct < 65 ? "watch" : "info",
      title: `Aderenza ${formatNumber(pct, 0)}% negli ultimi ${i.trackedDays} giorni registrati`,
      detail: pct >= 85 ? "Ottima costanza." : "I risultati dipendono soprattutto dalla costanza: individua i pasti saltati più spesso.",
    })
  }

  const order = { alert: 0, watch: 1, strength: 2, info: 3 } as const
  return out.sort((a, b2) => order[a.kind] - order[b2.kind])
}
