/** Prompt per l'IA esterna: piano alimentare del nutrizionista → JSON strutturato. */
import { MEAL_SLOT_LABELS } from "@/config/constants"

export function buildDietPrompt(): string {
  const slots = Object.entries(MEAL_SLOT_LABELS)
    .map(([k, v]) => `${k} (${v})`)
    .join(", ")

  return `Sei un assistente esperto di nutrizione che trasforma piani alimentari (PDF, foto o testo) in dati strutturati.

COMPITO
Leggi il piano alimentare allegato ed estrai giorni, pasti, alimenti con grammature e valori nutrizionali.

FORMATO DI USCITA — OBBLIGATORIO
Rispondi SOLO con un oggetto JSON valido, senza testo prima o dopo e senza commenti. Puoi racchiuderlo in un blocco \`\`\`json.

{
  "schema": "vitruvian.diet.v1",
  "name": "Piano ottobre 2026",
  "professional": "Dott. …",
  "valid_from": "YYYY-MM-DD",
  "valid_to": null,
  "notes": "Indicazioni generali del nutrizionista",
  "targets": { "kcal": 2600, "protein_g": 160, "carbs_g": 300, "fat_g": 80, "fiber_g": 30 },
  "days": [
    {
      "day_of_week": null,
      "label": "Giorno tipo",
      "meals": [
        {
          "slot": "breakfast",
          "label": "Colazione",
          "time": "07:30",
          "notes": null,
          "items": [
            { "food": "Fiocchi d'avena", "quantity": 60, "unit": "g", "kcal": 225, "protein_g": 8.1, "carbs_g": 36.6, "fat_g": 4.2, "fiber_g": 6, "alternative_group": null, "notes": null },
            { "food": "Pane integrale", "quantity": 80, "unit": "g", "kcal": 194, "protein_g": 7.4, "carbs_g": 33.8, "fat_g": 2.3, "fiber_g": 5.4, "alternative_group": 1, "notes": null },
            { "food": "Fette biscottate integrali", "quantity": 50, "unit": "g", "kcal": 186, "protein_g": 6.0, "carbs_g": 34.0, "fat_g": 3.0, "fiber_g": 4.5, "alternative_group": 1, "notes": null }
          ]
        }
      ]
    }
  ]
}

STRUTTURA DEI GIORNI
- Stesso menu tutti i giorni → un solo giorno con "day_of_week": null e "label": "Giorno tipo".
- Menu diverso per giorno della settimana → un giorno per ciascuno con "day_of_week" da 1 (lunedì) a 7 (domenica).
- Giorni a tipologia (es. allenamento / riposo, giorno A / giorno B) → un giorno per tipologia con "day_of_week": null e "label" descrittiva.

CAMPI
- slot: uno tra ${slots}.
- time: orario indicativo "HH:MM" se presente, altrimenti null.
- quantity + unit: grammatura dell'alimento ("g", "ml", "pz", "cucchiaio"…). Se il piano indica solo "a piacere" usa quantity null e scrivilo in notes.
- alternative_group: gli alimenti alternativi tra loro ("oppure", "in alternativa") nello stesso pasto hanno lo STESSO numero (1, 2, 3…); gli alimenti fissi hanno null. Metti per prima l'opzione principale.
- targets: obiettivi giornalieri SOLO se dichiarati nel piano, altrimenti null nei singoli campi.

VALORI NUTRIZIONALI
1. Se il piano riporta calorie e macronutrienti degli alimenti, usali.
2. Altrimenti STIMALI per la quantità indicata usando tabelle di composizione standard (CREA/INRAN o USDA), valori a crudo salvo diversa indicazione, e aggiungi in "notes" del piano: "valori nutrizionali stimati".
3. Coerenza: kcal ≈ proteine×4 + carboidrati×4 + grassi×9 (tolleranza 10%).
4. Numeri con il PUNTO decimale, senza unità; massimo una cifra decimale.

REGOLE
- Date in formato YYYY-MM-DD; se assenti null.
- Non inventare alimenti o pasti che non sono nel piano.
- Condimenti indicati a parte (olio, sale…) vanno come alimenti nel pasto in cui sono indicati; se sono indicati "per la giornata", inseriscili nel pasto principale e spiegalo in notes.`
}
