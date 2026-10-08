/**
 * Catalogo esercizi e gruppi muscolari.
 * Il prompt dell'AI Bridge usa questi codici, così volume e progressi sono
 * confrontabili nel tempo anche se nella scheda gli esercizi hanno nomi diversi.
 *
 * Conteggio del volume: 1 serie per il muscolo principale, 0,5 per i secondari
 * (convenzione usata in letteratura per le serie "frazionarie").
 */

export const MUSCLES = {
  chest: "Pettorali",
  lats: "Dorsali",
  upper_back: "Trapezi e romboidi",
  front_delts: "Deltoidi anteriori",
  side_delts: "Deltoidi laterali",
  rear_delts: "Deltoidi posteriori",
  biceps: "Bicipiti",
  triceps: "Tricipiti",
  forearms: "Avambracci",
  quads: "Quadricipiti",
  hamstrings: "Femorali",
  glutes: "Glutei",
  adductors: "Adduttori",
  calves: "Polpacci",
  abs: "Addome",
  lower_back: "Lombari",
} as const

export type Muscle = keyof typeof MUSCLES
export const MUSCLE_KEYS = Object.keys(MUSCLES) as Muscle[]

export function isMuscle(v: unknown): v is Muscle {
  return typeof v === "string" && v in MUSCLES
}

/** Distretti mostrati insieme nei grafici e collegati alle circonferenze. */
export const REGIONS: Array<{ key: string; label: string; muscles: Muscle[]; site?: string }> = [
  { key: "chest", label: "Petto", muscles: ["chest"], site: "chest" },
  { key: "back", label: "Schiena", muscles: ["lats", "upper_back", "lower_back"] },
  { key: "shoulders", label: "Spalle", muscles: ["front_delts", "side_delts", "rear_delts"], site: "shoulders" },
  { key: "arms", label: "Braccia", muscles: ["biceps", "triceps"], site: "arm" },
  { key: "forearms", label: "Avambracci", muscles: ["forearms"], site: "forearm" },
  { key: "legs", label: "Cosce", muscles: ["quads", "hamstrings", "adductors"], site: "thigh" },
  { key: "glutes", label: "Glutei", muscles: ["glutes"], site: "hips" },
  { key: "calves", label: "Polpacci", muscles: ["calves"], site: "calf" },
  { key: "core", label: "Core", muscles: ["abs"] },
]

export type Pattern =
  | "squat"
  | "hinge"
  | "lunge"
  | "horizontal_push"
  | "vertical_push"
  | "horizontal_pull"
  | "vertical_pull"
  | "isolation"
  | "core"
  | "carry"
  | "cardio"

export const PATTERN_LABELS: Record<Pattern, string> = {
  squat: "Squat",
  hinge: "Hip hinge (stacchi)",
  lunge: "Affondi / unilaterali",
  horizontal_push: "Spinta orizzontale",
  vertical_push: "Spinta verticale",
  horizontal_pull: "Tirata orizzontale",
  vertical_pull: "Tirata verticale",
  isolation: "Isolamento",
  core: "Core",
  carry: "Trasporti",
  cardio: "Cardio",
}

export interface ExerciseDef {
  code: string
  name: string
  primary: Muscle | null
  secondary: Muscle[]
  pattern: Pattern
  compound: boolean
  /** usato per il calcolo del massimale stimato e dei record */
  strength?: boolean
  aliases?: string[]
}

const E = (
  code: string,
  name: string,
  primary: Muscle | null,
  secondary: Muscle[],
  pattern: Pattern,
  opts: { compound?: boolean; strength?: boolean; aliases?: string[] } = {},
): ExerciseDef => ({ code, name, primary, secondary, pattern, compound: opts.compound ?? pattern !== "isolation", strength: opts.strength, aliases: opts.aliases })

export const EXERCISES: ExerciseDef[] = [
  // Petto
  E("bench_press", "Panca piana bilanciere", "chest", ["front_delts", "triceps"], "horizontal_push", { strength: true, aliases: ["panca piana", "distensioni su panca piana", "bench"] }),
  E("incline_bench_press", "Panca inclinata bilanciere", "chest", ["front_delts", "triceps"], "horizontal_push", { strength: true, aliases: ["panca inclinata"] }),
  E("dumbbell_bench_press", "Panca piana manubri", "chest", ["front_delts", "triceps"], "horizontal_push", { strength: true, aliases: ["distensioni manubri"] }),
  E("incline_dumbbell_press", "Panca inclinata manubri", "chest", ["front_delts", "triceps"], "horizontal_push", { strength: true }),
  E("decline_bench_press", "Panca declinata", "chest", ["triceps"], "horizontal_push"),
  E("chest_press_machine", "Chest press", "chest", ["front_delts", "triceps"], "horizontal_push", { aliases: ["chest press"] }),
  E("dips", "Dip alle parallele", "chest", ["triceps", "front_delts"], "horizontal_push", { strength: true, aliases: ["dip", "parallele"] }),
  E("push_up", "Piegamenti", "chest", ["triceps", "front_delts"], "horizontal_push", { aliases: ["flessioni", "push up"] }),
  E("cable_fly", "Croci ai cavi", "chest", ["front_delts"], "isolation", { aliases: ["croci cavi", "cable crossover"] }),
  E("dumbbell_fly", "Croci con manubri", "chest", ["front_delts"], "isolation", { aliases: ["croci manubri"] }),
  E("pec_deck", "Pectoral machine", "chest", [], "isolation", { aliases: ["pec deck", "butterfly"] }),
  // Schiena
  E("pull_up", "Trazioni alla sbarra", "lats", ["biceps", "upper_back"], "vertical_pull", { strength: true, aliases: ["trazioni", "pull up"] }),
  E("chin_up", "Trazioni presa supina", "lats", ["biceps"], "vertical_pull", { strength: true, aliases: ["chin up"] }),
  E("lat_pulldown", "Lat machine", "lats", ["biceps", "upper_back"], "vertical_pull", { strength: true, aliases: ["lat machine", "pulldown"] }),
  E("barbell_row", "Rematore con bilanciere", "upper_back", ["lats", "biceps", "rear_delts", "lower_back"], "horizontal_pull", { strength: true, aliases: ["rematore bilanciere", "bent over row"] }),
  E("dumbbell_row", "Rematore con manubrio", "lats", ["upper_back", "biceps", "rear_delts"], "horizontal_pull", { strength: true, aliases: ["rematore manubrio"] }),
  E("seated_cable_row", "Pulley basso", "upper_back", ["lats", "biceps", "rear_delts"], "horizontal_pull", { strength: true, aliases: ["pulley", "low row"] }),
  E("t_bar_row", "Rematore T-bar", "upper_back", ["lats", "biceps", "rear_delts"], "horizontal_pull", { strength: true }),
  E("chest_supported_row", "Rematore con appoggio / machine row", "upper_back", ["lats", "rear_delts", "biceps"], "horizontal_pull", { aliases: ["row machine", "rematore macchina"] }),
  E("straight_arm_pulldown", "Pullover ai cavi", "lats", [], "isolation", { aliases: ["pullover", "pulldown braccia tese"] }),
  E("face_pull", "Face pull", "rear_delts", ["upper_back"], "isolation"),
  E("reverse_fly", "Alzate posteriori / reverse pec deck", "rear_delts", ["upper_back"], "isolation", { aliases: ["alzate posteriori", "reverse pec deck", "aperture posteriori"] }),
  E("shrug", "Scrollate", "upper_back", ["forearms"], "isolation", { aliases: ["scrollate"] }),
  // Spalle
  E("overhead_press", "Lento avanti con bilanciere", "front_delts", ["side_delts", "triceps"], "vertical_push", { strength: true, aliases: ["military press", "lento avanti", "ohp"] }),
  E("dumbbell_shoulder_press", "Lento con manubri", "front_delts", ["side_delts", "triceps"], "vertical_push", { strength: true, aliases: ["shoulder press manubri"] }),
  E("machine_shoulder_press", "Shoulder press macchina", "front_delts", ["side_delts", "triceps"], "vertical_push"),
  E("lateral_raise", "Alzate laterali con manubri", "side_delts", [], "isolation", { aliases: ["alzate laterali"] }),
  E("cable_lateral_raise", "Alzate laterali ai cavi", "side_delts", [], "isolation"),
  E("upright_row", "Tirate al mento", "side_delts", ["upper_back"], "isolation", { compound: true }),
  E("front_raise", "Alzate frontali", "front_delts", [], "isolation"),
  // Braccia
  E("barbell_curl", "Curl con bilanciere", "biceps", ["forearms"], "isolation", { aliases: ["curl bilanciere"] }),
  E("dumbbell_curl", "Curl con manubri", "biceps", ["forearms"], "isolation", { aliases: ["curl manubri", "curl alternato"] }),
  E("hammer_curl", "Hammer curl", "biceps", ["forearms"], "isolation", { aliases: ["curl a martello"] }),
  E("incline_curl", "Curl su panca inclinata", "biceps", [], "isolation"),
  E("preacher_curl", "Curl alla panca Scott", "biceps", [], "isolation", { aliases: ["panca scott"] }),
  E("cable_curl", "Curl ai cavi", "biceps", [], "isolation"),
  E("triceps_pushdown", "Pushdown ai cavi", "triceps", [], "isolation", { aliases: ["push down", "spinte in basso", "tricipiti ai cavi"] }),
  E("overhead_triceps_extension", "Estensioni sopra la testa", "triceps", [], "isolation", { aliases: ["french press manubrio", "overhead extension"] }),
  E("skull_crusher", "French press con bilanciere", "triceps", [], "isolation", { aliases: ["french press", "skull crusher"] }),
  E("close_grip_bench_press", "Panca presa stretta", "triceps", ["chest", "front_delts"], "horizontal_push", { strength: true, aliases: ["panca stretta"] }),
  E("wrist_curl", "Curl per i polsi", "forearms", [], "isolation"),
  // Gambe
  E("back_squat", "Squat con bilanciere", "quads", ["glutes", "adductors", "lower_back"], "squat", { strength: true, aliases: ["squat"] }),
  E("front_squat", "Front squat", "quads", ["glutes", "upper_back"], "squat", { strength: true }),
  E("hack_squat", "Hack squat", "quads", ["glutes"], "squat", { strength: true }),
  E("leg_press", "Leg press", "quads", ["glutes", "adductors"], "squat", { strength: true, aliases: ["pressa"] }),
  E("goblet_squat", "Goblet squat", "quads", ["glutes"], "squat"),
  E("bulgarian_split_squat", "Affondi bulgari", "quads", ["glutes", "adductors"], "lunge", { aliases: ["split squat", "bulgarian"] }),
  E("lunge", "Affondi", "quads", ["glutes", "adductors"], "lunge", { aliases: ["affondi camminati", "walking lunge"] }),
  E("leg_extension", "Leg extension", "quads", [], "isolation"),
  E("deadlift", "Stacco da terra", "glutes", ["hamstrings", "lower_back", "upper_back", "forearms"], "hinge", { strength: true, aliases: ["stacco"] }),
  E("romanian_deadlift", "Stacco rumeno", "hamstrings", ["glutes", "lower_back"], "hinge", { strength: true, aliases: ["rdl", "stacco a gambe tese"] }),
  E("hip_thrust", "Hip thrust", "glutes", ["hamstrings"], "hinge", { strength: true, aliases: ["ponte glutei", "glute bridge"] }),
  E("good_morning", "Good morning", "hamstrings", ["lower_back", "glutes"], "hinge"),
  E("lying_leg_curl", "Leg curl sdraiato", "hamstrings", [], "isolation", { aliases: ["leg curl"] }),
  E("seated_leg_curl", "Leg curl seduto", "hamstrings", [], "isolation"),
  E("back_extension", "Iperestensioni", "lower_back", ["glutes", "hamstrings"], "hinge", { aliases: ["hyperextension"] }),
  E("adductor_machine", "Adductor machine", "adductors", [], "isolation", { aliases: ["adduttori"] }),
  E("abductor_machine", "Abductor machine", "glutes", [], "isolation", { aliases: ["abduttori"] }),
  E("cable_kickback", "Kickback ai cavi", "glutes", ["hamstrings"], "isolation", { aliases: ["slanci ai cavi", "kickback glutei"] }),
  E("step_up", "Step-up", "quads", ["glutes"], "lunge", { aliases: ["salite sul gradone"] }),
  E("standing_calf_raise", "Calf raise in piedi", "calves", [], "isolation", { aliases: ["calf in piedi", "polpacci in piedi"] }),
  E("seated_calf_raise", "Calf raise seduto", "calves", [], "isolation", { aliases: ["calf seduto"] }),
  E("leg_press_calf_raise", "Calf alla pressa", "calves", [], "isolation"),
  // Core
  E("plank", "Plank", "abs", [], "core"),
  E("crunch", "Crunch", "abs", [], "core"),
  E("cable_crunch", "Crunch ai cavi", "abs", [], "core"),
  E("hanging_leg_raise", "Sollevamento gambe alla sbarra", "abs", [], "core", { aliases: ["leg raise"] }),
  E("ab_wheel", "Ab wheel", "abs", [], "core"),
  E("pallof_press", "Pallof press", "abs", [], "core"),
  E("farmer_walk", "Farmer walk", "forearms", ["upper_back", "abs"], "carry"),
  // Cardio
  E("running", "Corsa", null, [], "cardio"),
  E("walking", "Camminata", null, [], "cardio", { aliases: ["camminata veloce"] }),
  E("cycling", "Bici / cyclette", null, [], "cardio", { aliases: ["cyclette", "spinning"] }),
  E("rowing_machine", "Vogatore", null, [], "cardio"),
  E("elliptical", "Ellittica", null, [], "cardio"),
  E("stair_climber", "Stair climber", null, [], "cardio"),
  E("hiit", "HIIT", null, [], "cardio"),
  E("swimming", "Nuoto", null, [], "cardio"),
]

const BY_CODE = new Map<string, ExerciseDef>()
for (const e of EXERCISES) {
  BY_CODE.set(e.code, e)
  for (const a of e.aliases ?? []) BY_CODE.set(slug(a), e)
  BY_CODE.set(slug(e.name), e)
}

export function slug(s: string): string {
  const c = s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
  return c && !/^[a-z]/.test(c) ? `x_${c}` : c
}

export function findExercise(code: string | null | undefined, name?: string | null): ExerciseDef | undefined {
  return (code ? BY_CODE.get(slug(code)) : undefined) ?? (name ? BY_CODE.get(slug(name)) : undefined)
}

/** Esercizi consigliati per un muscolo carente, dal più efficace in poi. */
export const FOCUS_EXERCISES: Record<Muscle, string[]> = {
  chest: ["incline_dumbbell_press", "cable_fly", "dips"],
  lats: ["lat_pulldown", "pull_up", "straight_arm_pulldown"],
  upper_back: ["chest_supported_row", "seated_cable_row", "face_pull"],
  front_delts: ["overhead_press", "incline_bench_press"],
  side_delts: ["cable_lateral_raise", "lateral_raise", "upright_row"],
  rear_delts: ["reverse_fly", "face_pull"],
  biceps: ["incline_curl", "preacher_curl", "hammer_curl"],
  triceps: ["overhead_triceps_extension", "skull_crusher", "triceps_pushdown"],
  forearms: ["hammer_curl", "wrist_curl", "farmer_walk"],
  quads: ["hack_squat", "bulgarian_split_squat", "leg_extension"],
  hamstrings: ["romanian_deadlift", "seated_leg_curl"],
  glutes: ["hip_thrust", "bulgarian_split_squat"],
  adductors: ["adductor_machine", "back_squat"],
  calves: ["standing_calf_raise", "seated_calf_raise"],
  abs: ["cable_crunch", "hanging_leg_raise", "ab_wheel"],
  lower_back: ["back_extension", "romanian_deadlift"],
}

/**
 * Serie settimanali per muscolo (Schoenfeld 2017; Pelland 2024):
 * sotto ~8 lo stimolo è basso, 10–20 è la fascia più produttiva per l'ipertrofia,
 * oltre ~22 il recupero diventa il fattore limitante.
 */
export const VOLUME_ZONES = { low: 8, optimalMin: 10, optimalMax: 20, high: 24 } as const

/** Muscoli piccoli che ricevono molto lavoro indiretto: soglie più basse. */
export const SMALL_MUSCLES: Muscle[] = ["front_delts", "forearms", "abs", "lower_back", "adductors"]
