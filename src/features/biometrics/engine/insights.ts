/**
 * Biometric Health Status: trasforma numeri in osservazioni concrete.
 * Ogni regola è indipendente e produce al massimo un insight.
 */
import { formatDate, formatNumber, formatSigned, isNum } from "@/lib/format"
import type { Checkup, Profile } from "@/types/domain"

import { RECOMP_META, type RecompResult } from "./recomposition"
import { bodyFatBand, ffmiBand, hydrationBand, visceralBand, whtrBand } from "./reference"
import type { Segment } from "./segments"

export type InsightKind = "alert" | "watch" | "strength" | "info"

export interface Insight {
  id: string
  kind: InsightKind
  title: string
  detail: string
}

const ORDER: Record<InsightKind, number> = { alert: 0, watch: 1, strength: 2, info: 3 }

const kindFromTone = (tone: RecompResult["tone"]): InsightKind =>
  tone === "good" ? "strength" : tone === "bad" ? "alert" : tone === "warn" ? "watch" : "info"

function recompDetail(r: RecompResult) {
  const parts = [
    `MG ${formatSigned(r.dFatKg, 1)} kg`,
    `FFM ${formatSigned(r.dFfmKg, 1)} kg`,
    r.dWeight !== null ? `peso ${formatSigned(r.dWeight, 1)} kg` : null,
    r.days !== null ? `in ${r.days} giorni` : null,
  ]
  return `${parts.filter(Boolean).join(" · ")}. ${r.description}`
}

export interface InsightInput {
  chronological: Checkup[]
  segments: Segment[]
  latest: Checkup
  latestBia: Checkup | null
  lastRecomp: RecompResult | null
  segmentRecomp: RecompResult | null
  profile: Profile | null
  age: number | null
  katch: number | null
  today: string
  daysSinceLatest: number
}

export function buildInsights(input: InsightInput): Insight[] {
  const { chronological, segments, latest, latestBia, lastRecomp, segmentRecomp, profile, age, katch } = input
  const sex = profile?.sex ?? null
  const out: Insight[] = []
  const add = (i: Insight) => out.push(i)

  /* --- Freschezza dei dati --- */
  if (input.daysSinceLatest > 120) {
    add({
      id: "stale",
      kind: "watch",
      title: `Ultimo controllo ${input.daysSinceLatest} giorni fa`,
      detail: "Oltre 4 mesi senza misurazioni: i trend potrebbero non riflettere la situazione attuale.",
    })
  }

  /* --- Composizione attuale --- */
  if (latestBia && isNum(latestBia.fat_mass_pct)) {
    const b = bodyFatBand(latestBia.fat_mass_pct, sex, age)
    const value = `${formatNumber(latestBia.fat_mass_pct, 1)}%`
    add({
      id: "fat-band",
      kind: b.band === "optimal" ? "strength" : b.band === "high" ? "alert" : "watch",
      title: `Massa grassa ${value}: ${b.label.toLowerCase()}`,
      detail:
        b.band === "optimal"
          ? "Percentuale di grasso nel range salutare per sesso ed età."
          : b.band === "low"
            ? "Percentuale molto bassa: attenzione a energia, ormoni e recupero."
            : "Sopra il range di riferimento per sesso ed età.",
    })
  }

  if (latestBia && isNum(latestBia.ffmi)) {
    const b = ffmiBand(latestBia.ffmi, sex)
    const good = ["Sopra la media", "Eccellente", "Eccezionale"].includes(b.tier)
    add({
      id: "ffmi",
      kind: good ? "strength" : b.band === "low" ? "watch" : "info",
      title: `FFMI ${formatNumber(latestBia.ffmi, 1)}: ${b.tier.toLowerCase()}`,
      detail: "Indice di massa magra rispetto all'altezza: misura lo sviluppo muscolare indipendentemente dal grasso.",
    })
  }

  if (isNum(latest.waist_to_height)) {
    const b = whtrBand(latest.waist_to_height)
    add({
      id: "whtr",
      kind: b.band === "optimal" ? "strength" : b.band === "high" ? "alert" : b.band === "elevated" ? "watch" : "info",
      title: `Vita/altezza ${formatNumber(latest.waist_to_height, 2)}: ${b.label.toLowerCase()}`,
      detail: "Indicatore di rischio cardiometabolico: la soglia di attenzione è 0,50 (vita inferiore a metà altezza).",
    })
  }

  if (latestBia && isNum(latestBia.visceral_fat)) {
    const b = visceralBand(latestBia.visceral_fat)
    add({
      id: "visceral",
      kind: b.band === "optimal" ? "strength" : "alert",
      title: `Grasso viscerale ${formatNumber(latestBia.visceral_fat, 1)}: ${b.label.toLowerCase()}`,
      detail: "Scala tipica degli impedenziometri (1–12 nella norma). Il valore esatto dipende dallo strumento.",
    })
  }

  if (latestBia && isNum(latestBia.total_body_water_pct)) {
    const b = hydrationBand(latestBia.total_body_water_pct, sex)
    if (b.band !== "optimal") {
      add({
        id: "hydration",
        kind: "watch",
        title: `Acqua corporea ${formatNumber(latestBia.total_body_water_pct, 1)}%: ${b.label.toLowerCase()}`,
        detail: "L'idratazione influenza molto la lettura BIA: misurati sempre nelle stesse condizioni (a digiuno, stessa ora).",
      })
    }
  }

  /* --- Ultimo intervallo --- */
  if (lastRecomp && lastRecomp.type !== "insufficient") {
    add({
      id: "recomp-last",
      kind: kindFromTone(lastRecomp.tone),
      title: `Ultimo intervallo: ${lastRecomp.title.toLowerCase()}`,
      detail: recompDetail(lastRecomp),
    })
    if (lastRecomp.waistConsistent === false) {
      add({
        id: "waist-incoherent",
        kind: "watch",
        title: "Vita e massa grassa in direzioni opposte",
        detail: `La vita è variata di ${formatSigned(lastRecomp.dWaist, 1)} cm mentre la massa grassa di ${formatSigned(lastRecomp.dFatKg, 1)} kg: possibile errore di misura o diversa idratazione.`,
      })
    }
  }

  /* --- Trend dello strumento attuale --- */
  const current = segments[segments.length - 1]
  if (segmentRecomp && segmentRecomp.type !== "insufficient" && segmentRecomp.from && current) {
    add({
      id: "recomp-segment",
      kind: kindFromTone(segmentRecomp.tone),
      title: `Dal ${formatDate(segmentRecomp.from.checkup_date, "medium")}: ${segmentRecomp.title.toLowerCase()}`,
      detail: recompDetail(segmentRecomp),
    })
  }

  /* --- Trend % grasso in salita per 3 visite consecutive --- */
  if (current) {
    const bia = current.checkups.filter((c) => isNum(c.fat_mass_pct)).slice(-3)
    if (bia.length === 3) {
      const [a, b, c] = bia.map((x) => x.fat_mass_pct as number) as [number, number, number]
      if (a < b && b < c && c - a >= 2) {
        add({
          id: "fat-rising",
          kind: "watch",
          title: "Massa grassa in aumento da 3 visite",
          detail: `${formatNumber(a, 1)}% → ${formatNumber(b, 1)}% → ${formatNumber(c, 1)}%: valuta con il nutrizionista l'apporto calorico.`,
        })
      }
    }
  }

  /* --- Lungo periodo, indipendente dallo strumento (peso + circonferenze) --- */
  const first = chronological.find((c) => isNum(c.weight_kg) && isNum(c.waist_cm))
  if (first && first.id !== latest.id && isNum(latest.weight_kg) && isNum(latest.waist_cm)) {
    const dW = latest.weight_kg - (first.weight_kg as number)
    const dWaist = latest.waist_cm - (first.waist_cm as number)
    const limbs = [
      isNum(first.arm_cm) && isNum(latest.arm_cm) ? `braccio ${formatSigned(latest.arm_cm - first.arm_cm, 1)} cm` : null,
      isNum(first.chest_cm) && isNum(latest.chest_cm) ? `torace ${formatSigned(latest.chest_cm - first.chest_cm, 1)} cm` : null,
      isNum(first.thigh_cm) && isNum(latest.thigh_cm) ? `coscia ${formatSigned(latest.thigh_cm - first.thigh_cm, 1)} cm` : null,
    ].filter(Boolean)
    const since = formatDate(first.checkup_date, "medium")
    if (dW >= 2) {
      const cmPerKg = dWaist / dW
      add({
        id: "long-term",
        kind: cmPerKg <= 0.35 ? "strength" : cmPerKg >= 1 ? "watch" : "info",
        title:
          cmPerKg <= 0.35
            ? `Dal ${since}: ${formatSigned(dW, 1)} kg con vita ${formatSigned(dWaist, 1)} cm`
            : `Dal ${since}: la vita cresce con il peso`,
        detail: `${
          cmPerKg <= 0.35
            ? "L'aumento di peso è in gran parte massa magra: la vita è quasi invariata."
            : "Una parte rilevante dell'aumento di peso si deposita sull'addome."
        }${limbs.length ? ` Circonferenze: ${limbs.join(", ")}.` : ""} Questo confronto non dipende dallo strumento BIA.`,
      })
    } else if (dW <= -2) {
      add({
        id: "long-term",
        kind: dWaist < 0 ? "strength" : "watch",
        title: `Dal ${since}: ${formatSigned(dW, 1)} kg, vita ${formatSigned(dWaist, 1)} cm`,
        detail: `${limbs.length ? `Circonferenze: ${limbs.join(", ")}. ` : ""}Confronto indipendente dallo strumento BIA.`,
      })
    }
  }

  /* --- Qualità del dato BMR --- */
  if (latestBia && isNum(latestBia.bmr_kcal) && isNum(katch)) {
    const diff = ((latestBia.bmr_kcal - katch) / katch) * 100
    if (Math.abs(diff) > 12) {
      add({
        id: "bmr-check",
        kind: "info",
        title: `BMR del referto ${diff > 0 ? "superiore" : "inferiore"} del ${formatNumber(Math.abs(diff), 0)}% alla stima`,
        detail: `Katch-McArdle stima ${katch} kcal dalla tua massa magra contro ${latestBia.bmr_kcal} kcal del referto. Per il fabbisogno usa il valore indicato dal nutrizionista.`,
      })
    }
  }

  /* --- Contesto --- */
  if (segments.length > 1 && current) {
    add({
      id: "protocol-change",
      kind: "info",
      title: `Strumento BIA cambiato il ${formatDate(current.start, "medium")}`,
      detail: `${current.protocolName ?? "Nuovo strumento"}: i confronti BIA partono da questa data, peso e circonferenze restano confrontabili su tutto lo storico.`,
    })
  }
  if (!profile?.height_cm) {
    add({
      id: "no-height",
      kind: "info",
      title: "Altezza mancante nel profilo",
      detail: "Impostala per calcolare BMI, FFMI e rapporto vita/altezza.",
    })
  }

  return out.sort((a, b) => ORDER[a.kind] - ORDER[b.kind])
}

/** Testo pronto da copiare per il prossimo controllo. */
export function nutritionistNotes(insights: Insight[], latest: Checkup, today: string): string {
  const relevant = insights.filter((i) => i.kind === "alert" || i.kind === "watch")
  const lines = [
    `Note per il controllo — ${formatDate(today, "long")}`,
    `Ultima misurazione: ${formatDate(latest.checkup_date, "long")}` +
      (isNum(latest.weight_kg) ? ` · ${formatNumber(latest.weight_kg, 1)} kg` : "") +
      (isNum(latest.fat_mass_pct) ? ` · MG ${formatNumber(latest.fat_mass_pct, 1)}%` : ""),
    "",
    ...(relevant.length
      ? relevant.map((i) => `• ${i.title}. ${i.detail}`)
      : ["• Nessuna anomalia rilevata dal monitoraggio."]),
  ]
  return lines.join("\n")
}

export { RECOMP_META }
