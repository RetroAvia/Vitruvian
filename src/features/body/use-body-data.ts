"use client"

import { useMemo } from "react"

import type { BodyFigure } from "@/components/body/body-geometry"
import type { BodyMarker, MuscleTone } from "@/components/body/body-map"
import { useHealthContext } from "@/features/advice/hooks/use-health-context"
import { bpClass, latestValue } from "@/features/medical/engine/analysis"
import { MUSCLE_KEYS, VOLUME_ZONES, type Muscle } from "@/features/training/engine/catalog"
import { latestSites } from "@/features/training/engine/physique"
import { formatNumber, isNum } from "@/lib/format"

/** Tutti i dati della mappa corporea, calcolati una volta dalla cache condivisa. */
export function useBodyData() {
  const health = useHealthContext()
  const { input } = health

  const data = useMemo(() => {
    if (!input) return null
    const bio = input.bio
    const chronological = bio?.chronological ?? []
    const { values: sites } = latestSites(chronological)
    const tr = input.training
    const deltas: Record<string, number> = {}
    for (const g of tr?.physique.growth ?? []) deltas[g.site] = g.delta

    // volume per muscolo: sessioni reali se sufficienti, altrimenti la scheda
    const useLogged = tr && tr.logged.sessions >= 4
    const volume = tr ? (useLogged ? tr.logged.perMuscle : (tr.plan?.perMuscle ?? null)) : null
    const trainingTone: Partial<Record<Muscle, MuscleTone>> = {}
    const focusTone: Partial<Record<Muscle, MuscleTone>> = {}
    const labels: Partial<Record<Muscle, string>> = {}
    const weak = new Set(tr?.physique.weaknesses.map((w) => w.muscle) ?? [])
    for (const m of MUSCLE_KEYS) {
      const v = volume?.[m] ?? 0
      trainingTone[m] = v <= 0 ? "none" : v < VOLUME_ZONES.low ? "low" : v < VOLUME_ZONES.optimalMin ? "ok" : v > VOLUME_ZONES.high ? "high" : "optimal"
      focusTone[m] = weak.has(m) ? "weak" : v >= VOLUME_ZONES.optimalMin && v <= VOLUME_ZONES.optimalMax ? "strong" : "none"
      if (volume) labels[m] = `${formatNumber(v, v % 1 ? 1 : 0)} serie/settimana`
    }

    const markers: BodyMarker[] = []
    const reports = input.medical?.reports ?? []
    const sys = latestValue(reports, "systolic")
    const dia = latestValue(reports, "diastolic")
    const hr = latestValue(reports, "heart_rate")
    const bp = sys && dia ? bpClass(sys.value, dia.value) : null
    const ecg = input.medical?.latestByKind.get("ecg") ?? null
    if (bp || hr || ecg) {
      const bad = bp?.cls === "hypertension" || ecg?.outcome === "abnormal"
      const watch = bp?.cls === "elevated" || ecg?.outcome === "borderline"
      markers.push({
        id: "heart",
        view: "front",
        at: [110, 98],
        tone: bad ? "danger" : watch ? "warn" : "gain",
        label: [sys && dia ? `Pressione ${sys.value}/${dia.value}` : null, hr ? `FC ${hr.value} bpm` : null, ecg ? `ECG: ${ecg.outcome === "normal" ? "nella norma" : ecg.outcome}` : null].filter(Boolean).join(" · "),
      })
    }
    const labs = input.labs
    if (labs?.latestDate) {
      const out = labs.series.filter((s) => s.latest.date === labs.latestDate && (s.latest.flag === "high" || s.latest.flag === "low"))
      markers.push({ id: "labs", view: "front", at: [57, 198], tone: out.length === 0 ? "gain" : out.length <= 2 ? "warn" : "danger", label: out.length ? `Analisi: ${out.map((s) => s.name).join(", ")} fuori range` : "Analisi nella norma" })
    }

    const figure: BodyFigure = input.profile?.sex === "female" ? "female" : "male"
    return { figure, sites, deltas, trainingTone, focusTone, labels, markers, volume, bp, sys, dia, hr, ecg }
  }, [input])

  return { ...health, body: data }
}

export function fmtDelta(v: number | null | undefined, digits = 1) {
  if (!isNum(v) || Math.abs(v) < 10 ** -digits / 2) return null
  return `${v > 0 ? "+" : "−"}${formatNumber(Math.abs(v), digits)}`
}
