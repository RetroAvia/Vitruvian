/**
 * Punto d'ingresso del motore: dalle visite al report completo.
 * Funzione pura e deterministica (la data di oggi è un parametro).
 */
import { daysBetween, isNum, todayISO } from "@/lib/format"
import type { Checkup, Profile } from "@/types/domain"

import { katchMcArdle, mifflinStJeor, tdee } from "./energy"
import { ageAt } from "./indices"
import { buildInsights, nutritionistNotes, type Insight } from "./insights"
import { classifyRecomposition, type RecompResult } from "./recomposition"
import { segmentByProtocol, type Segment } from "./segments"

export interface EnergyReport {
  bmr: number | null
  tdee: number | null
  katchMcArdle: number | null
  mifflin: number | null
}

export interface BiometricReport {
  chronological: Checkup[]
  segments: Segment[]
  latest: Checkup | null
  latestBia: Checkup | null
  /** Ultima visita BIA vs precedente (stesso strumento) */
  lastRecomp: RecompResult | null
  /** Ultima visita BIA vs prima visita dello strumento attuale */
  segmentRecomp: RecompResult | null
  /** Tutti gli intervalli consecutivi confrontabili */
  intervals: RecompResult[]
  energy: EnergyReport
  age: number | null
  daysSinceLatest: number | null
  insights: Insight[]
  notes: string
}

const hasBia = (c: Checkup) => isNum(c.fat_mass_kg) && isNum(c.ffm_kg)

export function analyze(checkups: Checkup[], profile: Profile | null, today: string = todayISO()): BiometricReport {
  const chronological = [...checkups].sort((a, b) => a.checkup_date.localeCompare(b.checkup_date))
  const segments = segmentByProtocol(chronological)
  const latest = chronological[chronological.length - 1] ?? null
  const latestBia = [...chronological].reverse().find(hasBia) ?? null
  const age = ageAt(profile?.birth_date, today)

  const intervals: RecompResult[] = []
  for (const seg of segments) {
    const bia = seg.checkups.filter(hasBia)
    for (let i = 1; i < bia.length; i++) intervals.push(classifyRecomposition(bia[i - 1], bia[i] as Checkup))
  }

  let lastRecomp: RecompResult | null = null
  let segmentRecomp: RecompResult | null = null
  if (latestBia) {
    const seg = segments.find((s) => s.checkups.some((c) => c.id === latestBia.id))
    const bia = seg?.checkups.filter(hasBia) ?? []
    if (bia.length >= 2) {
      lastRecomp = classifyRecomposition(bia[bia.length - 2], latestBia)
      if (bia.length >= 3) segmentRecomp = classifyRecomposition(bia[0], latestBia)
    }
  }

  const energy: EnergyReport = {
    bmr: latestBia?.bmr_kcal ?? null,
    tdee: tdee(latestBia?.bmr_kcal, profile?.activity_level),
    katchMcArdle: katchMcArdle(latestBia?.ffm_kg),
    mifflin: mifflinStJeor(latest?.weight_kg, profile?.height_cm, age, profile?.sex),
  }

  const daysSinceLatest = latest ? daysBetween(latest.checkup_date, today) : null

  const insights = latest
    ? buildInsights({
        chronological,
        segments,
        latest,
        latestBia,
        lastRecomp,
        segmentRecomp,
        profile,
        age,
        katch: energy.katchMcArdle,
        today,
        daysSinceLatest: daysSinceLatest ?? 0,
      })
    : []

  return {
    chronological,
    segments,
    latest,
    latestBia,
    lastRecomp,
    segmentRecomp,
    intervals,
    energy,
    age,
    daysSinceLatest,
    insights,
    notes: latest ? nutritionistNotes(insights, latest, today) : "",
  }
}
