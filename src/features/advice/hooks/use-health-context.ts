"use client"

import { useMemo } from "react"

import { dataQuality, forecastGoals } from "@/features/biometrics/engine/forecast"
import { useBiometricReport } from "@/features/biometrics/hooks/use-biometric-report"
import { useHealthDays } from "@/features/health/api/health"
import { summarizeHealth } from "@/features/health/engine/health"
import { useLabResults } from "@/features/labs/api/labs"
import { analyzeLabs } from "@/features/labs/engine/report"
import { useMedicalReports } from "@/features/medical/api/medical"
import { analyzeMedical } from "@/features/medical/engine/analysis"
import { useDietPlans, useMealLogs, usePlanTree } from "@/features/nutrition/api/nutrition"
import { adherenceScore, adherenceSeries } from "@/features/nutrition/engine/adherence"
import { energyBalance } from "@/features/nutrition/engine/balance"
import { foodProfile } from "@/features/nutrition/engine/foods"
import { useSupplements } from "@/features/supplements/api/supplements"
import { computeTotals } from "@/features/supplements/engine/analysis"
import { useTraining } from "@/features/training/hooks/use-training"
import { shiftISO, todayISO } from "@/lib/format"

import { buildAdvice, healthScore, type AdviceInput } from "../engine/advice"

/**
 * Raccoglie TUTTI i dati dell'utente (con la cache di TanStack Query, quindi
 * senza richieste duplicate) e calcola consigli, previsioni e punteggio.
 */
export function useHealthContext() {
  const { report, profile, isPending: bioPending } = useBiometricReport()
  const labsQ = useLabResults()
  const medQ = useMedicalReports()
  const supQ = useSupplements()
  const plansQ = useDietPlans()
  const activePlan = (plansQ.data ?? []).find((p) => p.is_active) ?? null
  const treeQ = usePlanTree(activePlan?.id ?? null)
  const from = useMemo(() => shiftISO(todayISO(), -30), [])
  const logsQ = useMealLogs(from)
  const training = useTraining()
  const healthQ = useHealthDays()

  const isPending =
    bioPending || training.isPending || labsQ.isPending || medQ.isPending || supQ.isPending || plansQ.isPending || (Boolean(activePlan) && treeQ.isPending)

  const result = useMemo(() => {
    if (isPending) return null
    const today = todayISO()
    const sex = profile?.sex ?? null
    const labs = labsQ.data && labsQ.data.length > 0 ? analyzeLabs(labsQ.data, profile) : null
    const medical = medQ.data && medQ.data.length > 0 ? analyzeMedical(medQ.data, sex, today) : null
    const supplements = supQ.data ?? []
    const { totals: supTotals } = computeTotals(supplements, sex, today)
    const tree = activePlan ? treeQ.data : undefined
    const food = tree ? foodProfile(tree.days) : null
    const planKcal = tree?.plan.target_kcal ?? (food?.avgKcal ? Math.round(food.avgKcal) : null)
    const balance = report ? energyBalance(planKcal, report.energy.tdee, report.energy.bmr) : null
    let mealAdherence: number | null = null
    if (tree) {
      const since = tree.plan.valid_from ?? tree.plan.created_at.slice(0, 10)
      const adh = adherenceScore(adherenceSeries(tree.days, logsQ.data ?? [], today, 14, since))
      mealAdherence = adh.score !== null && adh.trackedDays >= 3 ? Math.round(adh.score * 100) : null
    }
    const forecasts = report ? forecastGoals(report, profile, today) : []
    const quality = report && report.chronological.length > 0 ? dataQuality(report, today) : null

    const input: AdviceInput = {
      today,
      profile,
      bio: report,
      forecasts,
      quality,
      labs,
      balance,
      food,
      planName: tree?.plan.name ?? null,
      mealAdherence,
      supplements,
      supTotals,
      medical,
      training: training.report,
      health: summarizeHealth(healthQ.data ?? [], today),
    }
    return { input, advice: buildAdvice(input), score: healthScore(input) }
  }, [isPending, profile, report, labsQ.data, medQ.data, supQ.data, activePlan, treeQ.data, logsQ.data, training.report, healthQ.data])

  return { ...result, isPending }
}
