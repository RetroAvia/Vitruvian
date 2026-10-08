"use client"

import { useMemo } from "react"

import { useBiometricReport } from "@/features/biometrics/hooks/use-biometric-report"
import { todayISO } from "@/lib/format"

import { useTrainingPlans, useTrainingTree, useWorkouts } from "../api/training"
import { analyzeTraining } from "../engine/report"

/** Scheda attiva + riepiloghi delle sessioni + misure → report allenamento (cache condivisa). */
export function useTraining(selectedPlanId?: string | null) {
  const plansQ = useTrainingPlans()
  const plans = plansQ.data ?? []
  const planId = selectedPlanId && plans.some((p) => p.id === selectedPlanId) ? selectedPlanId : (plans.find((p) => p.is_active)?.id ?? null)
  const treeQ = useTrainingTree(planId)
  const workoutsQ = useWorkouts()
  const { report: bio, profile, isPending: bioPending } = useBiometricReport()

  const isPending = plansQ.isPending || workoutsQ.isPending || bioPending || (Boolean(planId) && treeQ.isPending)
  const error = plansQ.error ?? treeQ.error ?? workoutsQ.error

  const report = useMemo(() => {
    if (isPending) return null
    return analyzeTraining({
      tree: planId ? (treeQ.data ?? null) : null,
      workouts: workoutsQ.data ?? [],
      chronological: bio?.chronological ?? [],
      today: todayISO(),
      sex: profile?.sex ?? null,
    })
  }, [isPending, planId, treeQ.data, workoutsQ.data, bio, profile?.sex])

  return { report, plans, planId, workouts: workoutsQ.data ?? [], isPending, error }
}
