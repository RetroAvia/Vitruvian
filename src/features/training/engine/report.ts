/** Punto d'ingresso del motore allenamento. */
import type { Insight } from "@/features/biometrics/engine/insights"
import { daysBetween, formatNumber, isNum } from "@/lib/format"
import type { Checkup } from "@/types/domain"

import type { TrainingTree, WorkoutSummary } from "../types"
import {
  exerciseProgress,
  loggedVolume,
  plannedDay,
  planVolume,
  recentPrs,
  streakWeeks,
  type ExerciseProgress,
  type LoggedVolume,
  type PlanVolume,
} from "./analysis"
import { analyzePhysique, type PhysiqueAnalysis } from "./physique"

export interface TrainingReport {
  tree: TrainingTree | null
  plan: PlanVolume | null
  logged: LoggedVolume
  progress: ExerciseProgress[]
  prs: ExerciseProgress[]
  physique: PhysiqueAnalysis
  today: ReturnType<typeof plannedDay>
  streak: number
  /** % sessioni svolte rispetto a quelle previste (4 settimane) */
  adherence: number | null
  insights: Insight[]
  hasData: boolean
}

export function analyzeTraining(input: { tree: TrainingTree | null; workouts: WorkoutSummary[]; chronological: Checkup[]; today: string; sex?: "male" | "female" | null }): TrainingReport {
  const { tree, workouts, chronological, today } = input
  const plan = tree && tree.days.length > 0 ? planVolume(tree) : null
  const logged = loggedVolume(workouts, today, 4)
  const progress = exerciseProgress(workouts, today)
  const prs = recentPrs(progress, today, 30)
  const physique = analyzePhysique({ chronological, plan, logged, progress, sex: input.sex })
  const target = plan?.sessionsPerWeek ?? 0
  const firstWorkout = workouts.reduce<string | null>((min, w) => (!min || w.workout_date < min ? w.workout_date : min), null)
  // la costanza si misura solo da quando usi il registro (niente penalità per il passato)
  const trackedWeeks = firstWorkout ? Math.min(4, Math.max(1, Math.ceil((daysBetween(firstWorkout, today) + 1) / 7))) : 0
  const adherence = target > 0 && trackedWeeks > 0 ? Math.min(100, Math.round((logged.sessions / (target * trackedWeeks)) * 100)) : null

  const insights: Insight[] = []
  if (adherence !== null && trackedWeeks >= 2) {
    insights.push(
      adherence >= 85
        ? { id: "adherence", kind: "strength", title: `Costanza ${adherence}%`, detail: `${formatNumber(logged.sessionsPerWeek, 1)} sessioni a settimana su ${target} previste.` }
        : { id: "adherence", kind: adherence < 60 ? "alert" : "watch", title: `Costanza ${adherence}%`, detail: `${formatNumber(logged.sessionsPerWeek, 1)} sessioni a settimana su ${target} previste: la regolarità conta più del programma perfetto.` },
    )
  }
  const stalled = progress.filter((p) => p.status === "stall" && p.sessions >= 4).slice(0, 4)
  if (stalled.length > 0) {
    insights.push({
      id: "stall",
      kind: "watch",
      title: `${stalled.length === 1 ? "Un esercizio fermo" : `${stalled.length} esercizi fermi`} da oltre 5 settimane`,
      detail: `${stalled.map((p) => p.name).join(", ")}. Prova a cambiare intervallo di ripetizioni, aggiungere una serie o fare una settimana di scarico.`,
    })
  }
  const regress = progress.filter((p) => p.status === "regress" && p.sessions >= 4)
  if (regress.length >= 2) {
    insights.push({ id: "regress", kind: "alert", title: "Carichi in calo su più esercizi", detail: `${regress.map((p) => p.name).join(", ")}: possibile affaticamento accumulato, sonno o calorie insufficienti.` })
  }
  if (isNum(logged.avgRpe) && logged.avgRpe >= 8.8 && logged.sessions >= 6) {
    insights.push({ id: "rpe", kind: "watch", title: `Sessioni molto dure (RPE medio ${formatNumber(logged.avgRpe, 1)})`, detail: "Allenarsi sempre vicino al limite aumenta la fatica: programma una settimana di scarico ogni 4–8 settimane." })
  }
  // settimane consecutive di allenamento pieno (senza una settimana leggera di scarico)
  const full = logged.weekly.filter((w) => w.sets > 0).map((w) => w.sets).sort((x, y) => x - y)
  const median = full.length ? (full[Math.floor(full.length / 2)] as number) : 0
  let straight = 0
  for (let i = logged.weekly.length - 1; i >= 0; i--) {
    const w = logged.weekly[i] as (typeof logged.weekly)[number]
    if (i === logged.weekly.length - 1 && w.sets === 0) continue // settimana in corso appena iniziata
    if (median > 0 && w.sets >= median * 0.6) straight++
    else break
  }
  const fatigue = stalled.length + regress.length >= 2 || (isNum(logged.avgRpe) && logged.avgRpe >= 8.5)
  if (straight >= 6 && (fatigue || straight >= 10)) {
    insights.push({
      id: "deload",
      kind: fatigue ? "watch" : "info",
      title: `${straight} settimane di fila senza scarico`,
      detail: `${fatigue ? "Con progressi fermi o sessioni molto dure, " : ""}una settimana con metà delle serie (stessi carichi) smaltisce la fatica e di solito fa ripartire i progressi.`,
    })
  }
  if (prs.length > 0) {
    insights.push({ id: "prs", kind: "strength", title: `${prs.length} ${prs.length === 1 ? "record personale" : "record personali"} nell'ultimo mese`, detail: prs.slice(0, 4).map((p) => p.name).join(", ") + "." })
  }
  const cardio = Math.max(logged.cardioMinPerWeek, plan?.cardioMin ?? 0)
  if ((plan || logged.sessions > 0) && cardio < 60) {
    insights.push({ id: "cardio", kind: "info", title: `Cardio: ${formatNumber(cardio, 0)} minuti a settimana`, detail: "L'OMS consiglia 150 minuti di attività moderata: 2–3 camminate veloci o uscite in bici migliorano cuore, recupero e consumo calorico." })
  }
  for (const b of physique.balance.filter((x) => x.tone === "warn")) insights.push({ id: `bal-${b.key}`, kind: "watch", title: b.title, detail: b.detail })
  for (const a of physique.asymmetries.filter((x) => x.relevant)) {
    insights.push({ id: `asym-${a.site}`, kind: "watch", title: `${a.label}: lato ${a.weaker} più piccolo di ${formatNumber(a.diff, 1)} cm`, detail: "Inserisci esercizi monolaterali (manubri, affondi) partendo dal lato debole e senza fare più ripetizioni con l'altro." })
  }

  const order = { alert: 0, watch: 1, strength: 2, info: 3 } as const
  insights.sort((a, b) => order[a.kind] - order[b.kind])

  return {
    tree,
    plan,
    logged,
    progress,
    prs,
    physique,
    today: plannedDay(tree ?? undefined, workouts, today),
    streak: streakWeeks(workouts, today, target || 3),
    adherence,
    insights,
    hasData: Boolean(plan) || workouts.length > 0,
  }
}
