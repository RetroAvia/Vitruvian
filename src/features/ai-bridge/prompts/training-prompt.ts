/**
 * Prompt per l'IA esterna: scheda di allenamento (+ eventuale storico dei carichi) → JSON.
 * Gli esercizi usano i codici del catalogo: volume per muscolo e progressi
 * restano confrontabili anche se cambiano i nomi tra una scheda e l'altra.
 */
import { EXERCISES, MUSCLES, PATTERN_LABELS } from "@/features/training/engine/catalog"
import { TECHNIQUES } from "@/features/training/engine/techniques"
import { GOAL_LABELS } from "@/features/training/types"

export function buildTrainingPrompt(): string {
  const catalog = EXERCISES.map((e) => `- ${e.code} = ${e.name}`).join("\n")
  const list = (o: Record<string, string>) =>
    Object.entries(o)
      .map(([k, v]) => `${k} (${v})`)
      .join(", ")

  return `Sei un preparatore atletico che trasforma schede di allenamento e diari di palestra in dati strutturati.

COMPITO
Ti fornisco la mia scheda di allenamento (testo, foto o PDF) ed eventualmente il diario delle ultime settimane/mesi con carichi e ripetizioni. Trasformali in un unico JSON.

FORMATO DI USCITA — OBBLIGATORIO
Rispondi SOLO con un oggetto JSON valido, senza testo prima o dopo e senza commenti. Puoi racchiuderlo in un blocco \`\`\`json.

{
  "schema": "vitruvian.training.v1",
  "activate": true,
  "plan": {
    "name": "Push Pull Legs – autunno 2026",
    "coach": null,
    "goal": "hypertrophy",
    "split": "Push / Pull / Legs",
    "days_per_week": 3,
    "valid_from": "YYYY-MM-DD o null",
    "valid_to": null,
    "notes": null,
    "days": [
      {
        "label": "Push",
        "day_of_week": 1,
        "focus": "Petto, spalle, tricipiti",
        "exercises": [
          { "code": "bench_press", "name": "Panca piana", "muscle_primary": "chest", "muscles_secondary": ["front_delts", "triceps"], "pattern": "horizontal_push",
            "sets": 4, "reps_min": 6, "reps_max": 8, "target_rir": 2, "rest_seconds": 150, "tempo": null, "load_kg": 80, "duration_min": null, "superset_group": null, "notes": null, "technique": "straight", "set_scheme": null },
          { "code": "running", "name": "Corsa leggera", "muscle_primary": null, "muscles_secondary": [], "pattern": "cardio",
            "sets": null, "reps_min": null, "reps_max": null, "target_rir": null, "rest_seconds": null, "tempo": null, "load_kg": null, "duration_min": 20, "superset_group": null, "notes": null }
        ]
      }
    ]
  },
  "history": [
    {
      "date": "YYYY-MM-DD",
      "title": "Push",
      "day_label": "Push",
      "duration_min": 70,
      "session_rpe": 8,
      "notes": null,
      "exercises": [
        { "code": "bench_press", "name": "Panca piana", "sets": [
          { "reps": 12, "weight_kg": 40, "rpe": null, "duration_min": null, "warmup": true },
          { "reps": 8, "weight_kg": 80, "rpe": 8, "duration_min": null, "warmup": false }
        ] }
      ]
    }
  ]
}

VALORI AMMESSI
- goal: ${list(GOAL_LABELS)}
- muscle_primary / muscles_secondary: ${list(MUSCLES)}
- pattern: ${list(PATTERN_LABELS)}
- technique: ${Object.entries(TECHNIQUES).map(([k, v]) => `${k} (${v.label})`).join(", ")}

CATALOGO ESERCIZI (code = nome)
${catalog}

REGOLE
1. Usa il "code" del catalogo quando l'esercizio corrisponde, anche se il nome è diverso (es. "distensioni su panca" → bench_press, "lat machine avanti" → lat_pulldown, "RDL" → romanian_deadlift). Per esercizi non in catalogo crea un code snake_case in inglese e compila SEMPRE muscle_primary, muscles_secondary e pattern.
2. day_of_week: 1 = lunedì … 7 = domenica. Se la scheda è a rotazione (A/B/C) senza giorni fissi usa null e indica days_per_week.
3. Ripetizioni: "8-10" → reps_min 8, reps_max 10; "10" → reps_min e reps_max 10; "a cedimento" → reps_min null e scrivilo in notes. Recupero in SECONDI (2' → 120).
4. Superserie e circuiti: stesso numero in superset_group per gli esercizi collegati.
4b. Tecniche: piramidi, drop set, rest-pause ecc. vanno in "technique". Se la scheda indica ripetizioni diverse serie per serie (es. 12-10-8-6) usa "set_scheme": [{ "reps": 12, "load_pct": 80 }, { "reps": 10, "load_pct": 87 }, …] con load_pct = carico in % della serie più pesante (null se non indicato).
5. Cardio: pattern "cardio", minuti in duration_min; nello storico usa una serie con duration_min.
6. history: crea una sessione per ogni allenamento del diario, con la data reale (YYYY-MM-DD) e TUTTE le serie (riscaldamento con "warmup": true). day_label deve coincidere con il "label" del giorno della scheda.
7. Se il diario non ha date precise NON inventarle: lascia "history": [] e riporta i carichi attuali in load_kg della scheda.
8. Carichi in kg (libbre × 0,4536). Per esercizi a corpo libero weight_kg 0 (o il sovraccarico se presente). Per manubri indica il peso di UN manubrio.
9. Numeri con il PUNTO decimale. NON inventare esercizi, serie o carichi che non ci sono.
10. Se ti fornisco solo il diario senza la scheda, ometti "plan" (o mettilo a null) e compila solo "history".`
}
