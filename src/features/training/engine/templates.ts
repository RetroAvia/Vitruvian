/** Schede pronte da cui partire (modificabili nell'editor). */
import type { PlanPayload } from "../types"

type Ex = PlanPayload["days"][number]["exercises"][number]
const e = (code: string, name: string, sets: number, reps_min: number, reps_max: number, rest: number, extra: Partial<Ex> = {}): Ex => ({ code, name, sets, reps_min, reps_max, rest_seconds: rest, target_rir: 2, ...extra })

export const TEMPLATES: Array<{ key: string; title: string; description: string; plan: PlanPayload }> = [
  {
    key: "fullbody3",
    title: "Full body 3 giorni",
    description: "Ideale per iniziare o con poco tempo: ogni muscolo 3 volte a settimana.",
    plan: {
      name: "Full body 3x",
      goal: "hypertrophy",
      split: "Full body",
      days_per_week: 3,
      days: [
        { label: "Full body A", day_of_week: 1, exercises: [e("back_squat", "Squat con bilanciere", 3, 6, 8, 150), e("bench_press", "Panca piana bilanciere", 3, 6, 8, 150), e("seated_cable_row", "Pulley basso", 3, 8, 12, 90), e("romanian_deadlift", "Stacco rumeno", 2, 8, 10, 120), e("lateral_raise", "Alzate laterali con manubri", 3, 12, 15, 60), e("cable_crunch", "Crunch ai cavi", 2, 10, 15, 60)] },
        { label: "Full body B", day_of_week: 3, exercises: [e("deadlift", "Stacco da terra", 3, 4, 6, 180), e("overhead_press", "Lento avanti con bilanciere", 3, 6, 8, 150), e("lat_pulldown", "Lat machine", 3, 8, 12, 90), e("bulgarian_split_squat", "Affondi bulgari", 2, 8, 12, 90), e("barbell_curl", "Curl con bilanciere", 2, 10, 12, 60), e("triceps_pushdown", "Pushdown ai cavi", 2, 10, 12, 60)] },
        { label: "Full body C", day_of_week: 5, exercises: [e("leg_press", "Leg press", 3, 10, 12, 120), e("incline_dumbbell_press", "Panca inclinata manubri", 3, 8, 10, 120), e("pull_up", "Trazioni alla sbarra", 3, 6, 10, 120), e("hip_thrust", "Hip thrust", 3, 8, 12, 90), e("face_pull", "Face pull", 3, 12, 15, 60), e("standing_calf_raise", "Calf raise in piedi", 3, 10, 15, 60)] },
      ],
    },
  },
  {
    key: "upperlower4",
    title: "Upper / Lower 4 giorni",
    description: "Ogni muscolo 2 volte a settimana: ottimo equilibrio tra volume e recupero.",
    plan: {
      name: "Upper Lower 4x",
      goal: "hypertrophy",
      split: "Upper / Lower",
      days_per_week: 4,
      days: [
        { label: "Upper A", day_of_week: 1, exercises: [e("bench_press", "Panca piana bilanciere", 4, 6, 8, 150, { technique: "reverse_pyramid" }), e("barbell_row", "Rematore con bilanciere", 4, 6, 8, 120), e("overhead_press", "Lento avanti con bilanciere", 3, 8, 10, 120), e("lat_pulldown", "Lat machine", 3, 10, 12, 90), e("incline_curl", "Curl su panca inclinata", 3, 10, 12, 60, { superset_group: 1 }), e("overhead_triceps_extension", "Estensioni sopra la testa", 3, 10, 12, 60, { superset_group: 1 })] },
        { label: "Lower A", day_of_week: 2, exercises: [e("back_squat", "Squat con bilanciere", 4, 5, 8, 180), e("romanian_deadlift", "Stacco rumeno", 3, 8, 10, 120), e("leg_extension", "Leg extension", 3, 12, 15, 60, { technique: "drop_set" }), e("seated_leg_curl", "Leg curl seduto", 3, 10, 12, 60), e("standing_calf_raise", "Calf raise in piedi", 4, 10, 15, 60), e("hanging_leg_raise", "Sollevamento gambe alla sbarra", 3, 10, 15, 60)] },
        { label: "Upper B", day_of_week: 4, exercises: [e("incline_dumbbell_press", "Panca inclinata manubri", 4, 8, 10, 120), e("pull_up", "Trazioni alla sbarra", 4, 6, 10, 120), e("dumbbell_shoulder_press", "Lento con manubri", 3, 8, 12, 90), e("chest_supported_row", "Rematore con appoggio / machine row", 3, 10, 12, 90), e("cable_lateral_raise", "Alzate laterali ai cavi", 3, 12, 15, 45, { technique: "myo_reps" }), e("face_pull", "Face pull", 3, 12, 15, 60)] },
        { label: "Lower B", day_of_week: 5, exercises: [e("deadlift", "Stacco da terra", 3, 4, 6, 180), e("hack_squat", "Hack squat", 3, 8, 12, 120), e("bulgarian_split_squat", "Affondi bulgari", 3, 8, 12, 90), e("hip_thrust", "Hip thrust", 3, 8, 12, 90), e("seated_calf_raise", "Calf raise seduto", 3, 12, 15, 60)] },
      ],
    },
  },
  {
    key: "ppl3",
    title: "Push / Pull / Legs",
    description: "Classico 3 giorni (ripetibile su 6) per chi ha già qualche anno di palestra.",
    plan: {
      name: "Push Pull Legs",
      goal: "hypertrophy",
      split: "Push / Pull / Legs",
      days_per_week: 3,
      days: [
        { label: "Push", day_of_week: 1, exercises: [e("bench_press", "Panca piana bilanciere", 4, 6, 8, 150, { technique: "pyramid" }), e("incline_dumbbell_press", "Panca inclinata manubri", 3, 8, 10, 120), e("overhead_press", "Lento avanti con bilanciere", 3, 8, 10, 120), e("cable_lateral_raise", "Alzate laterali ai cavi", 4, 12, 15, 45), e("triceps_pushdown", "Pushdown ai cavi", 3, 10, 12, 60, { technique: "rest_pause" })] },
        { label: "Pull", day_of_week: 3, exercises: [e("pull_up", "Trazioni alla sbarra", 4, 6, 10, 120), e("barbell_row", "Rematore con bilanciere", 3, 8, 10, 120), e("seated_cable_row", "Pulley basso", 3, 10, 12, 90), e("face_pull", "Face pull", 3, 12, 15, 60), e("incline_curl", "Curl su panca inclinata", 3, 10, 12, 60), e("hammer_curl", "Hammer curl", 2, 10, 12, 60)] },
        { label: "Legs", day_of_week: 5, exercises: [e("back_squat", "Squat con bilanciere", 4, 6, 8, 180), e("romanian_deadlift", "Stacco rumeno", 3, 8, 10, 120), e("leg_press", "Leg press", 3, 10, 12, 120), e("seated_leg_curl", "Leg curl seduto", 3, 10, 12, 60), e("standing_calf_raise", "Calf raise in piedi", 4, 10, 15, 60), e("running", "Corsa", 1, 1, 1, 0, { duration_min: 15, sets: null, reps_min: null, reps_max: null, rest_seconds: null, target_rir: null })] },
      ],
    },
  },
  {
    key: "lower3",
    title: "Lower focus 3 giorni",
    description: "Priorità a glutei e gambe, parte alta in equilibrio: due giorni gambe e uno upper.",
    plan: {
      name: "Lower focus 3x",
      goal: "hypertrophy",
      split: "Lower / Upper / Lower",
      days_per_week: 3,
      days: [
        { label: "Glutei & quadricipiti", day_of_week: 1, exercises: [e("hip_thrust", "Hip thrust", 4, 8, 12, 120, { technique: "reverse_pyramid" }), e("goblet_squat", "Goblet squat", 3, 8, 12, 90), e("bulgarian_split_squat", "Affondi bulgari", 3, 10, 12, 90), e("leg_extension", "Leg extension", 2, 12, 15, 60), e("abductor_machine", "Abductor machine", 3, 15, 20, 45, { technique: "myo_reps" }), e("cable_kickback", "Kickback ai cavi", 2, 12, 15, 45)] },
        { label: "Upper", day_of_week: 3, exercises: [e("lat_pulldown", "Lat machine", 3, 10, 12, 90), e("dumbbell_shoulder_press", "Lento con manubri", 3, 8, 12, 90), e("seated_cable_row", "Pulley basso", 3, 10, 12, 90), e("incline_dumbbell_press", "Panca inclinata manubri", 3, 8, 12, 90), e("lateral_raise", "Alzate laterali con manubri", 3, 12, 15, 45), e("cable_crunch", "Crunch ai cavi", 2, 12, 15, 45)] },
        { label: "Glutei & femorali", day_of_week: 5, exercises: [e("romanian_deadlift", "Stacco rumeno", 3, 8, 10, 120), e("hip_thrust", "Hip thrust", 3, 10, 12, 90), e("lying_leg_curl", "Leg curl sdraiato", 3, 10, 12, 60), e("step_up", "Step-up", 3, 10, 12, 60), e("leg_press", "Leg press", 2, 12, 15, 90), e("face_pull", "Face pull", 2, 12, 15, 45)] },
      ],
    },
  },
]
