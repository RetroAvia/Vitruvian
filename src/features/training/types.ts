import type { Tables } from "@/types/database.types"

export type TrainingPlan = Tables<"training_plans">

export type Technique =
  | "straight"
  | "pyramid"
  | "reverse_pyramid"
  | "drop_set"
  | "rest_pause"
  | "myo_reps"
  | "cluster"
  | "amrap"
  | "emom"
  | "tempo"

export interface SchemeStep {
  reps: number
  /** percentuale del carico di lavoro (100 = carico della serie principale) */
  load_pct?: number | null
}

export type TrainingExercise = Omit<Tables<"training_exercises">, "technique" | "set_scheme"> & {
  technique: Technique
  set_scheme: SchemeStep[] | null
}

export interface TrainingDay extends Tables<"training_days"> {
  exercises: TrainingExercise[]
}

export interface TrainingTree {
  plan: TrainingPlan
  days: TrainingDay[]
}

/* ------------------------- Sessioni (formato compatto) ------------------------- */

/** 0 allenante · 1 riscaldamento · 2 drop · 3 rest-pause · 4 cedimento/AMRAP */
export type SetType = 0 | 1 | 2 | 3 | 4

export const SET_TYPE_LABELS: Record<SetType, string> = {
  0: "Serie",
  1: "Riscaldamento",
  2: "Drop",
  3: "Rest-pause",
  4: "Cedimento",
}

/** [ripetizioni, kg, RPE, tipo] */
export type CompactSet = [number, number | null, number | null, SetType]

export interface CompactExercise {
  c: string
  n: string
  s?: CompactSet[]
  /** minuti (cardio) */
  m?: number | null
}

/** Riepilogo per esercizio calcolato dal database. */
export interface ExerciseSummary {
  c: string
  n: string
  sets?: number
  reps?: number
  vol?: number
  e1rm?: number
  /** serie migliore [kg, ripetizioni] */
  top?: [number, number]
  maxr?: number
  min?: number
}

type WorkoutRow = Tables<"workouts">

/** Sessione "leggera": solo intestazione + riepilogo (quello che l'app scarica sempre). */
export type WorkoutSummary = Omit<WorkoutRow, "exercises" | "summary"> & { summary: ExerciseSummary[] }

/** Sessione completa con tutte le serie (scaricata solo quando serve). */
export type Workout = WorkoutSummary & { exercises: CompactExercise[] }

export const GOAL_LABELS: Record<string, string> = {
  hypertrophy: "Ipertrofia",
  strength: "Forza",
  recomp: "Ricomposizione",
  fat_loss: "Dimagrimento",
  endurance: "Resistenza",
  general: "Benessere generale",
}

/** Payload di public.save_workout */
export interface WorkoutPayload {
  id?: string | null
  /** true = nuova sessione (id generato sul telefono); false = modifica: se non esiste più è un errore */
  is_new?: boolean
  workout_date: string
  plan_day_id?: string | null
  title: string
  duration_min?: number | null
  session_rpe?: number | null
  notes?: string | null
  exercises: Array<{
    code: string
    name: string
    sets: Array<{
      reps: number | null
      weight_kg: number | null
      rpe?: number | null
      duration_min?: number | null
      warmup?: boolean
      type?: "normal" | "warmup" | "drop" | "rest_pause" | "failure"
    }>
  }>
}

/** Payload di public.save_training_plan */
export interface PlanPayload {
  id?: string | null
  name: string
  goal: string
  split?: string | null
  coach?: string | null
  days_per_week?: number | null
  valid_from?: string | null
  valid_to?: string | null
  notes?: string | null
  is_active?: boolean
  days: Array<{
    label: string
    day_of_week?: number | null
    focus?: string | null
    exercises: Array<{
      code: string
      name: string
      muscle_primary?: string | null
      muscles_secondary?: string[]
      pattern?: string | null
      sets?: number | null
      reps_min?: number | null
      reps_max?: number | null
      target_rir?: number | null
      rest_seconds?: number | null
      tempo?: string | null
      load_kg?: number | null
      duration_min?: number | null
      superset_group?: number | null
      notes?: string | null
      technique?: Technique
      set_scheme?: SchemeStep[] | null
    }>
  }>
}
