/**
 * Prompt per l'IA esterna: foto delle etichette / elenco degli integratori → JSON.
 * Gli ingredienti usano i codici del catalogo, così l'app somma le dosi e
 * le confronta con fabbisogni e limiti di sicurezza.
 */
import { SUPPLEMENT_FORM_LABELS, SUPPLEMENT_FREQUENCY_LABELS, SUPPLEMENT_TIMINGS } from "@/config/constants"
import { NUTRIENTS } from "@/features/supplements/engine/nutrients"

export function buildSupplementPrompt(): string {
  const list = (o: Record<string, string>) =>
    Object.entries(o)
      .map(([k, v]) => `${k} (${v})`)
      .join(", ")
  const catalog = NUTRIENTS.map((n) => `- ${n.code} = ${n.name} [${n.unit}]`).join("\n")

  return `Sei un assistente che legge etichette di integratori alimentari e descrizioni di schemi di integrazione.

COMPITO
Dalle foto delle etichette, dai link ai prodotti o dalla descrizione che ti fornisco, crea l'elenco COMPLETO degli integratori che assumo, con dose, momento e composizione per singola dose.

FORMATO DI USCITA — OBBLIGATORIO
Rispondi SOLO con un oggetto JSON valido, senza testo prima o dopo e senza commenti. Puoi racchiuderlo in un blocco \`\`\`json.

{
  "schema": "vitruvian.supplements.v1",
  "deactivate_missing": false,
  "supplements": [
    {
      "name": "Vitamina D3 2000 UI",
      "brand": "Marca o null",
      "form": "softgel",
      "dose_label": "1 perla",
      "servings_per_day": 1,
      "timing": ["breakfast"],
      "frequency": "daily",
      "days_per_week": null,
      "purpose": "Mantenere livelli adeguati di vitamina D",
      "ingredients": [
        { "code": "vitamin_d", "name": "Vitamina D3 (colecalciferolo)", "amount": 50, "unit": "µg" }
      ],
      "start_date": null,
      "end_date": null,
      "is_active": true,
      "notes": null
    },
    {
      "name": "Creatina monoidrato",
      "brand": null,
      "form": "powder",
      "dose_label": "5 g (1 misurino)",
      "servings_per_day": 1,
      "timing": ["post_workout"],
      "frequency": "daily",
      "days_per_week": null,
      "purpose": "Forza e massa muscolare",
      "ingredients": [{ "code": "creatine", "name": "Creatina monoidrato", "amount": 5, "unit": "g" }],
      "start_date": null, "end_date": null, "is_active": true, "notes": null
    }
  ]
}

VALORI AMMESSI
- form: ${list(SUPPLEMENT_FORM_LABELS)}
- frequency: ${list(SUPPLEMENT_FREQUENCY_LABELS)}
- timing (uno o più): ${list(SUPPLEMENT_TIMINGS)}

CATALOGO PRINCIPI ATTIVI (code = nome [unità canonica])
${catalog}

REGOLE
1. "ingredients" = quantità contenuta in UNA dose ("dose_label"), NON la dose giornaliera. La dose giornaliera è amount × servings_per_day.
2. Usa il "code" del catalogo e converti nell'unità indicata: vitamina D in µg (40 UI = 1 µg), vitamina A in µg di retinolo (1 UI = 0,3 µg), mcg = µg. Per l'olio di pesce indica "omega3" = EPA + DHA in mg (non il peso totale dell'olio).
3. Ingredienti non presenti nel catalogo: code snake_case in inglese (es. "rhodiola", "turmeric"), name come in etichetta, quantità e unità dell'etichetta.
4. Per i multivitaminici elenca TUTTI i principi attivi con la loro quantità per dose.
5. Integratori proteici: indica "protein" in g per dose; se l'etichetta riporta anche carboidrati, aggiungi "carbohydrates".
6. frequency: "training_days" se lo prendo solo nei giorni di allenamento (indica days_per_week), "weekly" per dosi settimanali (es. vitamina D 25.000 UI a settimana → days_per_week 1), "as_needed" se al bisogno.
7. Numeri con il PUNTO decimale, senza simboli. Date YYYY-MM-DD o null.
8. Se ti fornisco l'elenco di TUTTO ciò che prendo oggi, imposta "deactivate_missing": true (gli integratori non elencati verranno segnati come sospesi).
9. NON inventare quantità: se in etichetta manca un valore, usa amount null e spiegalo in "notes".`
}
