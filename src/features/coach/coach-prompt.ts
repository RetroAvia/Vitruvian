/**
 * Prompt "Coach AI": l'IA esterna CREA una scheda e/o una dieta su misura a
 * partire dai dati dell'app e dalle preferenze scelte, e risponde nello stesso
 * formato JSON dell'AI Bridge (così l'import è automatico).
 */
import { MEAL_SLOT_LABELS } from "@/config/constants"
import { EXERCISES, MUSCLES, PATTERN_LABELS } from "@/features/training/engine/catalog"
import { TECHNIQUES } from "@/features/training/engine/techniques"
import { GOAL_LABELS } from "@/features/training/types"

export type CoachTarget = "training" | "diet" | "both"

export interface TrainingPrefs {
  goal: string
  level: "beginner" | "intermediate" | "advanced"
  days: number
  preferredDays: number[]
  minutes: number
  place: "gym" | "home" | "bodyweight" | "mixed"
  focus: string[]
  avoid: string
  cardio: "none" | "light" | "moderate" | "high"
  techniques: boolean
  variants: boolean
  notes: string
}

export interface DietPrefs {
  goal: "lose" | "maintain" | "gain" | "recomp"
  kcal: number | null
  protein: number | null
  meals: number
  style: "omnivore" | "mediterranean" | "vegetarian" | "vegan" | "pescatarian"
  intolerances: string[]
  avoid: string
  likes: string
  cooking: "quick" | "normal" | "elaborate"
  structure: "same" | "weekly" | "train_rest"
  alternatives: number
  notes: string
}

export const LEVEL_LABELS: Record<TrainingPrefs["level"], string> = { beginner: "Principiante (meno di 1 anno)", intermediate: "Intermedio (1–3 anni)", advanced: "Avanzato (oltre 3 anni)" }
export const PLACE_LABELS: Record<TrainingPrefs["place"], string> = { gym: "Palestra attrezzata", home: "Casa con manubri / elastici", bodyweight: "Solo corpo libero", mixed: "Palestra + casa" }
export const CARDIO_LABELS: Record<TrainingPrefs["cardio"], string> = { none: "Nessuno", light: "Leggero (10–15′ a fine seduta)", moderate: "Moderato (2–3 sessioni da 20–30′)", high: "Importante (obiettivo resistenza)" }
export const FOCUS_OPTIONS = ["Glutei", "Gambe", "Schiena", "Petto", "Spalle", "Braccia", "Addome", "Postura", "Mobilità"]
export const DIET_GOAL_LABELS: Record<DietPrefs["goal"], string> = { lose: "Dimagrire", maintain: "Mantenere", gain: "Aumentare la massa", recomp: "Ricomposizione" }
export const STYLE_LABELS: Record<DietPrefs["style"], string> = { omnivore: "Onnivora", mediterranean: "Mediterranea", vegetarian: "Vegetariana", vegan: "Vegana", pescatarian: "Pescetariana" }
export const INTOLERANCE_OPTIONS = ["Lattosio", "Glutine", "Frutta a guscio", "Uova", "Pesce e crostacei", "Soia", "Legumi"]
export const COOKING_LABELS: Record<DietPrefs["cooking"], string> = { quick: "Poco tempo (piatti da 10–15′)", normal: "Normale", elaborate: "Mi piace cucinare" }
export const STRUCTURE_LABELS: Record<DietPrefs["structure"], string> = { same: "Stesso menu ogni giorno", weekly: "Menu diverso per giorno della settimana", train_rest: "Giorno di allenamento / di riposo" }
const DOW = ["", "lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato", "domenica"]

export const DEFAULT_TRAINING: TrainingPrefs = { goal: "hypertrophy", level: "intermediate", days: 3, preferredDays: [], minutes: 60, place: "gym", focus: [], avoid: "", cardio: "light", techniques: true, variants: true, notes: "" }
export const DEFAULT_DIET: DietPrefs = { goal: "maintain", kcal: null, protein: null, meals: 5, style: "mediterranean", intolerances: [], avoid: "", likes: "", cooking: "normal", structure: "train_rest", alternatives: 2, notes: "" }

/** Calorie e proteine suggerite dall'app (TDEE della BIA ± obiettivo). */
export function suggestedTargets(tdee: number | null, weight: number | null, goal: DietPrefs["goal"]) {
  const factor = { lose: 0.82, maintain: 1, gain: 1.08, recomp: 0.95 }[goal]
  const proteinPerKg = { lose: 2.0, maintain: 1.6, gain: 1.8, recomp: 2.0 }[goal]
  return {
    kcal: tdee ? Math.round((tdee * factor) / 10) * 10 : null,
    protein: weight ? Math.round(weight * proteinPerKg) : null,
  }
}

function trainingSection(t: TrainingPrefs): string {
  const catalog = EXERCISES.map((e) => `- ${e.code} = ${e.name}`).join("\n")
  const list = (o: Record<string, string>) => Object.entries(o).map(([k, v]) => `${k} (${v})`).join(", ")
  return `### SCHEDA DI ALLENAMENTO — RICHIESTE
- Obiettivo: ${GOAL_LABELS[t.goal] ?? t.goal}
- Esperienza: ${LEVEL_LABELS[t.level]}
- Giorni a settimana: ${t.days}${t.preferredDays.length ? ` (preferibilmente ${t.preferredDays.map((d) => DOW[d]).join(", ")})` : ""}
- Durata massima di ogni seduta: ${t.minutes} minuti (riscaldamento e recuperi compresi)
- Dove: ${PLACE_LABELS[t.place]}
- Cardio: ${CARDIO_LABELS[t.cardio]}
${t.focus.length ? `- Distretti da privilegiare: ${t.focus.join(", ")}\n` : ""}${t.avoid.trim() ? `- PROBLEMI / ESERCIZI DA EVITARE (rispettalo sempre, proponi alternative sicure): ${t.avoid.trim()}\n` : ""}- Tecniche avanzate (piramide, drop set, rest-pause…): ${t.techniques ? "sì, dove hanno senso" : "no, solo serie classiche"}
${t.variants ? "- Per ogni esercizio indica in \"notes\" 1–2 VARIANTI equivalenti (es. \"Varianti: leg press, hack squat\") da usare se l'attrezzo è occupato o dà fastidio.\n" : ""}${t.notes.trim() ? `- Note: ${t.notes.trim()}\n` : ""}
### SCHEDA — FORMATO JSON (blocco \`\`\`json)
{
  "schema": "vitruvian.training.v1",
  "activate": true,
  "plan": {
    "name": "Nome della scheda",
    "coach": "AI Coach",
    "goal": "${t.goal}",
    "split": "es. Full body / Upper-Lower / PPL",
    "days_per_week": ${t.days},
    "valid_from": null, "valid_to": null,
    "notes": "Indicazioni generali: progressione, riscaldamento, quando aumentare i carichi",
    "days": [
      { "label": "Giorno A", "day_of_week": 1, "focus": "Gambe e glutei",
        "exercises": [
          { "code": "back_squat", "name": "Squat con bilanciere", "muscle_primary": "quads", "muscles_secondary": ["glutes"], "pattern": "squat",
            "sets": 4, "reps_min": 6, "reps_max": 10, "target_rir": 2, "rest_seconds": 120, "tempo": null, "load_kg": null, "duration_min": null,
            "superset_group": null, "notes": "Varianti: leg press, goblet squat", "technique": "straight", "set_scheme": null }
        ] }
    ]
  },
  "history": []
}
VALORI AMMESSI
- goal: ${list(GOAL_LABELS)}
- muscle_primary / muscles_secondary: ${list(MUSCLES)}
- pattern: ${list(PATTERN_LABELS)}
- technique: ${Object.entries(TECHNIQUES).map(([k, v]) => `${k} (${v.label})`).join(", ")}
- day_of_week: 1 = lunedì … 7 = domenica (null se la scheda è a rotazione)
- rest_seconds in secondi; target_rir = ripetizioni lasciate in riserva (0–4); load_kg null (l'app lo propone dai carichi registrati)
- set_scheme (opzionale, per piramidi con ripetizioni diverse): [{ "reps": 12, "load_pct": 80 }, …]
CATALOGO ESERCIZI (usa questi code; per esercizi non presenti crea un code snake_case in inglese e compila muscle_primary, muscles_secondary e pattern)
${catalog}`
}

function dietSection(d: DietPrefs): string {
  const slots = Object.entries(MEAL_SLOT_LABELS).map(([k, v]) => `${k} (${v})`).join(", ")
  return `### DIETA — RICHIESTE
- Obiettivo: ${DIET_GOAL_LABELS[d.goal]}
- Calorie giornaliere: ${d.kcal ? `circa ${d.kcal} kcal` : "calcolale tu dai dati"}${d.protein ? ` · proteine circa ${d.protein} g` : ""}
- Pasti al giorno: ${d.meals}
- Stile alimentare: ${STYLE_LABELS[d.style]}
${d.intolerances.length ? `- INTOLLERANZE / ALLERGIE (escludi del tutto): ${d.intolerances.join(", ")}\n` : ""}${d.avoid.trim() ? `- Alimenti da NON usare: ${d.avoid.trim()}\n` : ""}${d.likes.trim() ? `- Alimenti graditi da includere: ${d.likes.trim()}\n` : ""}- Tempo per cucinare: ${COOKING_LABELS[d.cooking]}
- Struttura: ${STRUCTURE_LABELS[d.structure]}
- VARIANTI: per ogni pasto prevedi ${d.alternatives > 1 ? `${d.alternatives} alternative intercambiabili per l'alimento principale (stesso "alternative_group"), con calorie simili` : "una sola opzione"}
${d.notes.trim() ? `- Note: ${d.notes.trim()}\n` : ""}
### DIETA — FORMATO JSON (blocco \`\`\`json)
{
  "schema": "vitruvian.diet.v1",
  "name": "Nome del piano",
  "professional": "AI Coach",
  "valid_from": null, "valid_to": null,
  "notes": "Indicazioni generali (idratazione, condimenti, sgarri) — valori nutrizionali stimati",
  "targets": { "kcal": ${d.kcal ?? 2000}, "protein_g": ${d.protein ?? 120}, "carbs_g": 220, "fat_g": 65, "fiber_g": 30 },
  "days": [
    { "day_of_week": null, "label": "Giorno di allenamento",
      "meals": [
        { "slot": "breakfast", "label": "Colazione", "time": "07:30", "notes": null,
          "items": [
            { "food": "Yogurt greco 0%", "quantity": 170, "unit": "g", "kcal": 99, "protein_g": 17, "carbs_g": 6, "fat_g": 0.7, "fiber_g": 0, "alternative_group": null, "notes": null },
            { "food": "Fiocchi d'avena", "quantity": 40, "unit": "g", "kcal": 150, "protein_g": 5.4, "carbs_g": 24.4, "fat_g": 2.8, "fiber_g": 4, "alternative_group": 1, "notes": null },
            { "food": "Pane integrale", "quantity": 50, "unit": "g", "kcal": 121, "protein_g": 4.6, "carbs_g": 21, "fat_g": 1.4, "fiber_g": 3.4, "alternative_group": 1, "notes": null }
          ] }
      ] }
  ]
}
REGOLE DIETA
- slot: uno tra ${slots}.
- Struttura: "same" → un giorno "Giorno tipo" (day_of_week null); "weekly" → 7 giorni con day_of_week 1–7; "train_rest" → due giorni "Giorno di allenamento" e "Giorno di riposo" (day_of_week null).
- Alternative dello stesso pasto: STESSO numero in alternative_group (1, 2, 3…), la prima è l'opzione principale; alimenti fissi null.
- Grammature a crudo, valori da tabelle CREA/USDA; kcal ≈ proteine×4 + carboidrati×4 + grassi×9.
- I totali di ogni giorno devono rispettare calorie e proteine richieste (±5%).`
}

export function buildCoachPrompt(opts: { target: CoachTarget; training: TrainingPrefs; diet: DietPrefs; snapshot: string; name: string | null }): string {
  const { target } = opts
  const wantT = target !== "diet"
  const wantD = target !== "training"
  const what = target === "both" ? "una SCHEDA DI ALLENAMENTO e una DIETA coordinate tra loro" : wantT ? "una SCHEDA DI ALLENAMENTO" : "una DIETA"

  return `Sei un preparatore atletico e nutrizionista sportivo esperto. Crea ${what} su misura per ${opts.name ? opts.name : "me"}, basandoti sui miei dati reali qui sotto.

COME LAVORARE
1. Leggi con attenzione i dati: composizione corporea, circonferenze, analisi del sangue, referti e allenamento attuale. Tienine conto (es. valori fuori range → scelte alimentari adatte; distretti carenti → più volume; problemi indicati → esercizi alternativi).
2. Usa principi aggiornati e prudenti: volume 10–20 serie/settimana per gruppo muscolare, progressione graduale, recuperi adeguati; deficit/surplus calorici moderati, proteine adeguate, cibi veri e vari.
3. Non dare diagnosi mediche: se un dato richiede il medico, scrivilo nelle "notes".
4. ${target === "both" ? "Coordina le due cose: nella dieta i giorni di allenamento hanno più carboidrati attorno alla seduta." : "Resta nei limiti richiesti."}

FORMATO DI USCITA — OBBLIGATORIO
- Rispondi SOLO con ${target === "both" ? "DUE blocchi ```json: prima la scheda (schema vitruvian.training.v1), poi la dieta (schema vitruvian.diet.v1)" : "UN blocco ```json"}, senza altro testo, senza commenti, senza riferimenti alle fonti tipo [cite].
- Numeri con il PUNTO decimale. JSON valido (nessuna virgola finale).

${wantT ? trainingSection(opts.training) : ""}

${wantD ? dietSection(opts.diet) : ""}

## I MIEI DATI (dall'app Vitruvian)
${opts.snapshot}`
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}
