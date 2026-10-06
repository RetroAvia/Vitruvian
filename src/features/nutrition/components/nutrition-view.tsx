"use client"

import { LoaderCircle, Salad, Sparkles, Star, Trash2, TriangleAlert } from "lucide-react"
import Link from "next/link"
import { useMemo, useState } from "react"
import { toast } from "sonner"

import { EmptyState } from "@/components/shared/empty-state"
import { GlassCard } from "@/components/shared/glass-card"
import { InsightList } from "@/components/shared/insight-list"
import { PageHeader } from "@/components/shared/page-header"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { NativeSelect } from "@/components/ui/native-select"
import { Skeleton } from "@/components/ui/skeleton"
import { useBiometricReport } from "@/features/biometrics/hooks/use-biometric-report"
import { formatDate, todayISO } from "@/lib/format"
import { cn } from "@/lib/utils"

import { useActivatePlan, useDeletePlan, useDietPlans, useMealLogs, usePlanTree, useSetMealLog } from "../api/nutrition"
import { adherenceScore, adherenceSeries } from "../engine/adherence"
import { energyBalance, perKg } from "../engine/balance"
import { buildNutritionInsights } from "../engine/insights"
import { dayForDate, dayShortLabel, dayTotals } from "../engine/totals"
import { AdherenceCard } from "./adherence-card"
import { EnergyBalanceCard, MacroCard } from "./energy-macro-cards"
import { MealChecklist } from "./meal-checklist"

function daysAgo(n: number) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  const pad = (x: number) => String(x).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function NutritionView() {
  const plansQ = useDietPlans()
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null)
  const plans = plansQ.data ?? []
  const planId = selectedPlan ?? plans.find((p) => p.is_active)?.id ?? plans[0]?.id ?? null
  const treeQ = usePlanTree(planId)

  const from = useMemo(() => daysAgo(30), [])
  const logsQ = useMealLogs(from)
  const setLog = useSetMealLog(from)
  const activate = useActivatePlan()
  const del = useDeletePlan()
  const { report } = useBiometricReport()

  const [date, setDate] = useState(todayISO())
  const [dayChoice, setDayChoice] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const tree = treeQ.data
  const day = useMemo(() => {
    if (!tree) return undefined
    return tree.days.find((d) => d.id === dayChoice) ?? dayForDate(tree.days, date)
  }, [tree, dayChoice, date])

  const analysis = useMemo(() => {
    if (!tree || !day) return null
    const totals = dayTotals(day)
    const plan = tree.plan
    const planKcal = plan.target_kcal ?? (totals.kcal > 0 ? totals.kcal : null)
    const balance = energyBalance(planKcal, report?.energy.tdee ?? null, report?.energy.bmr ?? null)
    const weight = report?.latest?.weight_kg ?? null
    const ffm = report?.latestBia?.ffm_kg ?? null
    const protein = totals.protein_g > 0 ? totals.protein_g : plan.target_protein_g
    const since = plan.valid_from ?? plan.created_at.slice(0, 10)
    const series = adherenceSeries(tree.days, logsQ.data ?? [], todayISO(), 14, since)
    const adh = adherenceScore(series)
    const insights = buildNutritionInsights({
      balance,
      day: totals,
      targetKcal: plan.target_kcal,
      proteinPerKg: perKg(protein, weight),
      proteinPerFfm: perKg(protein, ffm),
      lastRecomp: report?.lastRecomp ?? null,
      adherence: adh.score,
      trackedDays: adh.trackedDays,
    })
    return { totals, balance, weight, series, adh, insights, source: plan.target_kcal ? ("target" as const) : ("sum" as const) }
  }, [tree, day, report, logsQ.data])

  const header = (
    <PageHeader
      icon={Salad}
      title="Nutrizione"
      description="Il piano del nutrizionista, la checklist dei pasti e il confronto con il tuo fabbisogno."
      actions={
        <Button asChild className="rounded-xl">
          <Link href="/bridge?tab=diet">
            <Sparkles className="size-4" /> Importa dieta
          </Link>
        </Button>
      }
    />
  )

  if (plansQ.isPending || (planId && treeQ.isPending)) {
    return (
      <>
        {header}
        <Skeleton className="h-96 rounded-2xl" />
      </>
    )
  }
  if (plansQ.error || treeQ.error) {
    return (
      <>
        {header}
        <EmptyState icon={TriangleAlert} title="Impossibile caricare il piano" description={(plansQ.error ?? treeQ.error)?.message} />
      </>
    )
  }
  if (!tree || !day || !analysis) {
    return (
      <>
        {header}
        <EmptyState
          icon={Salad}
          title="Nessun piano alimentare"
          description="Importa la dieta del nutrizionista dall'AI Bridge: pasti, grammature e macro vengono strutturati in automatico."
          action={
            <Button asChild className="rounded-xl">
              <Link href="/bridge?tab=diet">
                <Sparkles className="size-4" /> Importa la dieta
              </Link>
            </Button>
          }
        />
      </>
    )
  }

  const plan = tree.plan

  async function onDelete() {
    try {
      await del.mutateAsync(plan.id)
      setSelectedPlan(null)
      setConfirmDelete(false)
      toast.success("Piano eliminato")
    } catch (e) {
      toast.error("Eliminazione non riuscita", { description: e instanceof Error ? e.message : undefined })
    }
  }

  return (
    <>
      {header}
      <div className="space-y-6">
        {/* Piano selezionato */}
        <GlassCard className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            {plans.length > 1 ? (
              <NativeSelect
                aria-label="Piano"
                value={plan.id}
                onChange={(e) => {
                  setSelectedPlan(e.target.value)
                  setDayChoice(null)
                }}
                className="h-9 w-64 rounded-lg"
              >
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.is_active ? " (attivo)" : ""}
                  </option>
                ))}
              </NativeSelect>
            ) : (
              <p className="text-sm font-semibold">{plan.name}</p>
            )}
            {plan.is_active && (
              <span className="inline-flex items-center gap-1 rounded-full bg-neon/10 px-2 py-0.5 text-[11px] font-medium text-neon ring-1 ring-inset ring-neon/25">
                <Star className="size-3" /> Attivo
              </span>
            )}
            <span className="text-xs text-muted-foreground">
              {plan.professional && `${plan.professional} · `}
              {plan.valid_from ? `dal ${formatDate(plan.valid_from, "medium")}` : `importato il ${formatDate(plan.created_at.slice(0, 10), "medium")}`}
            </span>
          </div>
          <div className="flex gap-2">
            {!plan.is_active && (
              <Button
                variant="outline"
                size="sm"
                className="rounded-lg"
                disabled={activate.isPending}
                onClick={() =>
                  activate.mutate(plan.id, {
                    onSuccess: () => toast.success("Piano attivato"),
                    onError: (e) => toast.error("Attivazione non riuscita", { description: e.message }),
                  })
                }
              >
                <Star className="size-3.5" /> Rendi attivo
              </Button>
            )}
            <Button variant="ghost" size="sm" className="rounded-lg text-muted-foreground hover:text-destructive" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="size-3.5" /> Elimina
            </Button>
          </div>
        </GlassCard>

        {plan.notes && <p className="rounded-xl surface-inset px-4 py-3 text-xs text-muted-foreground">{plan.notes}</p>}

        {/* Giorni del piano */}
        {tree.days.length > 1 && (
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Giorno del piano">
            {tree.days.map((d) => (
              <button
                key={d.id}
                type="button"
                aria-pressed={day.id === d.id}
                onClick={() => setDayChoice(d.id)}
                className={cn(
                  "h-8 rounded-full border px-3 text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  day.id === d.id ? "border-neon/40 bg-neon/10 text-neon" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {dayShortLabel(d)}
              </button>
            ))}
          </div>
        )}

        <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
          <MealChecklist
            day={day}
            date={date}
            onDateChange={(d) => {
              setDate(d)
              setDayChoice(null)
            }}
            logs={logsQ.data ?? []}
            onSet={(mealId, status) =>
              setLog.mutate(
                { mealId, date, status },
                { onError: (e) => toast.error("Non salvato", { description: e.message }) },
              )
            }
          />
          <div className="space-y-4">
            <EnergyBalanceCard balance={analysis.balance} source={analysis.source} />
            <MacroCard
              day={analysis.totals}
              weight={analysis.weight}
              targets={{
                protein_g: plan.target_protein_g,
                carbs_g: plan.target_carbs_g,
                fat_g: plan.target_fat_g,
                fiber_g: plan.target_fiber_g,
              }}
            />
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <GlassCard className="p-5">
            <h2 className="text-sm font-semibold">Osservazioni sul piano</h2>
            <p className="mb-4 mt-0.5 text-xs text-muted-foreground">Incrocio tra dieta, fabbisogno e andamento della composizione</p>
            <InsightList insights={analysis.insights} />
          </GlassCard>
          <AdherenceCard series={analysis.series} score={analysis.adh.score} tracked={analysis.adh.trackedDays} />
        </div>
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare &ldquo;{plan.name}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>
              Verranno eliminati giorni, pasti, alimenti e lo storico della checklist di questo piano.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Annulla</AlertDialogCancel>
            <Button variant="destructive" className="rounded-xl" onClick={() => void onDelete()} disabled={del.isPending}>
              {del.isPending && <LoaderCircle className="size-4 animate-spin" />}
              Elimina
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
