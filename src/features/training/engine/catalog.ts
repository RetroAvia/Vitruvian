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
  // ---- Ampliamento catalogo ----
  // Petto
  E("smith_bench_press", "Panca piana alla Smith", "chest", ["front_delts", "triceps"], "horizontal_push", { strength: true, aliases: ["panca smith"] }),
  E("incline_smith_press", "Panca inclinata alla Smith", "chest", ["front_delts", "triceps"], "horizontal_push", { strength: true, aliases: ["panca inclinata smith"] }),
  E("incline_chest_press_machine", "Chest press inclinata", "chest", ["front_delts", "triceps"], "horizontal_push", { aliases: ["incline chest press"] }),
  E("decline_dumbbell_press", "Panca declinata manubri", "chest", ["triceps"], "horizontal_push"),
  E("low_cable_fly", "Croci ai cavi dal basso", "chest", ["front_delts"], "isolation", { aliases: ["croci dal basso"] }),
  E("high_cable_fly", "Croci ai cavi dall'alto", "chest", ["front_delts"], "isolation", { aliases: ["croci dall'alto"] }),
  E("incline_dumbbell_fly", "Croci su panca inclinata", "chest", ["front_delts"], "isolation"),
  E("dumbbell_pullover", "Pullover con manubrio", "chest", ["lats", "triceps"], "isolation", { compound: true }),
  E("landmine_press", "Landmine press", "front_delts", ["chest", "triceps"], "vertical_push"),
  E("weighted_push_up", "Piegamenti zavorrati", "chest", ["triceps", "front_delts"], "horizontal_push"),
  // Schiena
  E("close_grip_pulldown", "Lat machine presa stretta / neutra", "lats", ["biceps", "upper_back"], "vertical_pull", { strength: true, aliases: ["lat presa stretta", "lat presa neutra"] }),
  E("single_arm_pulldown", "Lat machine a un braccio", "lats", ["biceps"], "vertical_pull"),
  E("assisted_pull_up", "Trazioni assistite", "lats", ["biceps", "upper_back"], "vertical_pull", { aliases: ["trazioni con elastico", "assisted pull up"] }),
  E("inverted_row", "Rematore inverso", "upper_back", ["lats", "biceps", "rear_delts"], "horizontal_pull", { aliases: ["australian pull up"] }),
  E("pendlay_row", "Rematore Pendlay", "upper_back", ["lats", "biceps", "lower_back"], "horizontal_pull", { strength: true }),
  E("seal_row", "Seal row", "upper_back", ["lats", "rear_delts", "biceps"], "horizontal_pull"),
  E("high_row_machine", "High row alla macchina", "lats", ["upper_back", "biceps"], "horizontal_pull", { aliases: ["high row", "rematore alto"] }),
  E("single_arm_cable_row", "Rematore ai cavi a un braccio", "lats", ["upper_back", "biceps"], "horizontal_pull"),
  E("meadows_row", "Meadows row", "lats", ["upper_back", "rear_delts", "biceps"], "horizontal_pull"),
  E("rack_pull", "Stacco dai blocchi", "upper_back", ["glutes", "lower_back", "forearms"], "hinge", { strength: true, aliases: ["rack pull"] }),
  E("dumbbell_shrug", "Scrollate con manubri", "upper_back", ["forearms"], "isolation"),
  // Spalle
  E("arnold_press", "Arnold press", "front_delts", ["side_delts", "triceps"], "vertical_push"),
  E("smith_shoulder_press", "Lento alla Smith", "front_delts", ["side_delts", "triceps"], "vertical_push", { strength: true }),
  E("machine_lateral_raise", "Alzate laterali alla macchina", "side_delts", [], "isolation", { aliases: ["lateral raise machine"] }),
  E("rear_delt_cable_fly", "Alzate posteriori ai cavi", "rear_delts", ["upper_back"], "isolation", { aliases: ["croci inverse ai cavi"] }),
  E("cable_front_raise", "Alzate frontali ai cavi", "front_delts", [], "isolation"),
  E("y_raise", "Y-raise", "side_delts", ["rear_delts", "upper_back"], "isolation"),
  // Bicipiti e avambracci
  E("ez_bar_curl", "Curl con bilanciere EZ", "biceps", ["forearms"], "isolation", { aliases: ["curl ez", "curl bilanciere sagomato"] }),
  E("concentration_curl", "Curl di concentrazione", "biceps", [], "isolation"),
  E("spider_curl", "Spider curl", "biceps", [], "isolation"),
  E("bayesian_curl", "Curl ai cavi dietro (Bayesian)", "biceps", [], "isolation", { aliases: ["bayesian curl"] }),
  E("machine_curl", "Curl alla macchina", "biceps", [], "isolation"),
  E("rope_hammer_curl", "Hammer curl ai cavi con corda", "biceps", ["forearms"], "isolation"),
  E("reverse_curl", "Curl inverso", "forearms", ["biceps"], "isolation", { aliases: ["curl presa prona"] }),
  E("reverse_wrist_curl", "Curl inverso per i polsi", "forearms", [], "isolation"),
  // Tricipiti
  E("rope_pushdown", "Pushdown con corda", "triceps", [], "isolation", { aliases: ["push down corda", "pushdown corda"] }),
  E("single_arm_pushdown", "Pushdown a un braccio", "triceps", [], "isolation"),
  E("cable_overhead_extension", "Estensioni sopra la testa ai cavi", "triceps", [], "isolation", { aliases: ["overhead cavi"] }),
  E("dumbbell_skull_crusher", "French press con manubri", "triceps", [], "isolation"),
  E("triceps_kickback", "Kickback per tricipiti", "triceps", [], "isolation", { aliases: ["kickback tricipiti"] }),
  E("bench_dips", "Dip su panca", "triceps", ["chest", "front_delts"], "horizontal_push", { aliases: ["dip alla panca"] }),
  E("machine_dips", "Dip machine", "triceps", ["chest"], "horizontal_push", { aliases: ["tricipiti alla macchina"] }),
  // Quadricipiti
  E("smith_squat", "Squat alla Smith", "quads", ["glutes", "adductors"], "squat", { strength: true, aliases: ["squat smith"] }),
  E("pendulum_squat", "Pendulum squat", "quads", ["glutes"], "squat", { strength: true }),
  E("belt_squat", "Belt squat", "quads", ["glutes", "adductors"], "squat"),
  E("sissy_squat", "Sissy squat", "quads", [], "isolation"),
  E("reverse_lunge", "Affondi indietro", "quads", ["glutes", "adductors"], "lunge", { aliases: ["affondi inversi", "reverse lunge"] }),
  E("lateral_lunge", "Affondi laterali", "adductors", ["quads", "glutes"], "lunge"),
  E("single_leg_press", "Leg press a una gamba", "quads", ["glutes"], "squat"),
  E("single_leg_extension", "Leg extension a una gamba", "quads", [], "isolation"),
  // Femorali e glutei
  E("sumo_deadlift", "Stacco sumo", "glutes", ["adductors", "hamstrings", "quads", "lower_back"], "hinge", { strength: true }),
  E("trap_bar_deadlift", "Stacco con trap bar", "quads", ["glutes", "hamstrings", "upper_back"], "hinge", { strength: true, aliases: ["hex bar"] }),
  E("dumbbell_rdl", "Stacco rumeno con manubri", "hamstrings", ["glutes", "lower_back"], "hinge", { aliases: ["rdl manubri"] }),
  E("single_leg_rdl", "Stacco rumeno a una gamba", "hamstrings", ["glutes"], "hinge"),
  E("hip_thrust_machine", "Hip thrust alla macchina", "glutes", ["hamstrings"], "hinge", { aliases: ["glute drive"] }),
  E("smith_hip_thrust", "Hip thrust alla Smith", "glutes", ["hamstrings"], "hinge"),
  E("cable_pull_through", "Pull through ai cavi", "glutes", ["hamstrings"], "hinge", { aliases: ["pull through"] }),
  E("kettlebell_swing", "Kettlebell swing", "glutes", ["hamstrings", "lower_back"], "hinge", { aliases: ["swing"] }),
  E("glute_ham_raise", "Glute ham raise", "hamstrings", ["glutes"], "isolation", { aliases: ["ghr"] }),
  E("nordic_curl", "Nordic curl", "hamstrings", [], "isolation", { aliases: ["nordic hamstring"] }),
  E("standing_leg_curl", "Leg curl in piedi", "hamstrings", [], "isolation"),
  E("cable_hip_abduction", "Abduzioni ai cavi", "glutes", [], "isolation", { aliases: ["slanci laterali ai cavi"] }),
  E("frog_pump", "Frog pump", "glutes", [], "isolation"),
  // Polpacci
  E("smith_calf_raise", "Calf raise alla Smith", "calves", [], "isolation"),
  E("single_leg_calf_raise", "Calf raise a una gamba", "calves", [], "isolation"),
  E("tibialis_raise", "Tibialis raise", "calves", [], "isolation"),
  // Core
  E("side_plank", "Plank laterale", "abs", [], "core", { aliases: ["side plank"] }),
  E("dead_bug", "Dead bug", "abs", [], "core"),
  E("reverse_crunch", "Crunch inverso", "abs", [], "core"),
  E("russian_twist", "Russian twist", "abs", [], "core"),
  E("captain_chair_leg_raise", "Sollevamento gambe alla sedia romana", "abs", [], "core", { aliases: ["sedia romana"] }),
  E("hollow_hold", "Hollow hold", "abs", [], "core"),
  E("cable_woodchopper", "Woodchopper ai cavi", "abs", [], "core", { aliases: ["woodchopper"] }),
  E("ab_crunch_machine", "Crunch alla macchina", "abs", [], "core", { aliases: ["abdominal machine"] }),
  E("bird_dog", "Bird dog", "lower_back", ["abs", "glutes"], "core"),
  E("suitcase_carry", "Suitcase carry", "abs", ["forearms"], "carry"),
  E("sled_push", "Spinta della slitta", "quads", ["glutes", "calves"], "carry", { aliases: ["slitta", "sled"] }),
  // Cardio
  E("incline_walk", "Camminata in pendenza", null, [], "cardio", { aliases: ["tapis roulant in pendenza", "incline walk"] }),
  E("jump_rope", "Salto della corda", null, [], "cardio", { aliases: ["corda"] }),
  E("air_bike", "Air bike", null, [], "cardio", { aliases: ["assault bike"] }),
  E("ski_erg", "SkiErg", null, [], "cardio"),
  E("battle_ropes", "Battle rope", null, [], "cardio"),
  E("burpees", "Burpees", null, [], "cardio"),
  E("boxing", "Sacco / boxe", null, [], "cardio", { aliases: ["boxe", "sacco"] }),
  E("mountain_climber", "Mountain climber", null, ["abs"], "cardio"),
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
