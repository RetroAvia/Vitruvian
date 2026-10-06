/**
 * Prompt per l'IA esterna (Gemini, ChatGPT, Claude…): referto BIA + misure → JSON.
 * Generato dinamicamente: include i siti di misura reali (anche quelli personali).
 */
import type { MeasurementSite } from "@/types/domain"

export function buildCheckupPrompt(sites: MeasurementSite[]): string {
  const siteList = sites.map((s) => `- ${s.code} = ${s.label}${s.description ? ` (${s.description})` : ""}`).join("\n")

  return `Sei un assistente che estrae dati da referti di composizione corporea (bioimpedenziometria/BIA) e da schede di misurazioni antropometriche.

COMPITO
Analizza il documento allegato (PDF, foto o testo) ed estrai TUTTE le visite presenti. Il documento può contenere una sola visita oppure una tabella con più date.

FORMATO DI USCITA — OBBLIGATORIO
Rispondi SOLO con un oggetto JSON valido, senza testo prima o dopo e senza commenti. Puoi racchiuderlo in un blocco \`\`\`json.

{
  "schema": "vitruvian.checkups.v1",
  "checkups": [
    {
      "checkup_date": "YYYY-MM-DD",
      "weight_kg": 75.2,
      "professional": null,
      "notes": null,
      "bia": {
        "bmr_kcal": 1856,
        "fat_mass_pct": 16.5,
        "lean_mass_kg": 59.6,
        "muscle_mass_kg": null,
        "bone_mass_kg": null,
        "total_body_water_pct": 59.0,
        "visceral_fat": 2.5,
        "phase_angle_deg": null,
        "metabolic_age": null,
        "extra": {}
      },
      "circumferences": [
        { "site": "waist", "side": "none", "value_cm": 79 },
        { "site": "arm", "side": "right", "value_cm": 37 }
      ]
    }
  ]
}

SIGNIFICATO DEI CAMPI BIA
- bmr_kcal: metabolismo basale (kcal)
- fat_mass_pct: massa grassa in PERCENTUALE
- lean_mass_kg: "massa magra" così come scritta nel referto (kg)
- muscle_mass_kg: massa muscolare (kg), solo se riportata separatamente
- bone_mass_kg: massa ossea (kg)
- total_body_water_pct: acqua corporea totale in PERCENTUALE
- visceral_fat: livello/indice di grasso viscerale
- phase_angle_deg: angolo di fase (gradi)
- metabolic_age: età metabolica (anni)
- extra: altri parametri numerici BIA presenti nel referto (chiavi snake_case in inglese, es. "ecw_pct", "icw_pct", "bmi")

CODICI DEI SITI DI MISURA (usa SOLO questi in "site")
${siteList}

REGOLE
1. Date in formato ISO YYYY-MM-DD. Con anno a due cifre interpreta 20xx. Il formato italiano è giorno/mese/anno.
2. Numeri con il PUNTO decimale (75.2, non 75,2) e senza unità di misura.
3. Valore assente → null (o ometti la circonferenza). NON inventare e NON stimare valori mancanti.
4. Massa grassa: se il referto riporta solo i kg, calcola la percentuale = kg ÷ peso × 100 (1 decimale) e scrivilo in "notes".
5. Acqua corporea: se è in litri o kg, calcola la percentuale = litri ÷ peso × 100 (1 decimale) e scrivilo in "notes".
6. Circonferenze con lato indicato (dx/sx) → "side": "right"/"left"; altrimenti "none". Converti sempre in centimetri.
7. Visita senza BIA → "bia": null.
8. Se un valore è illeggibile o ambiguo, mettilo a null e spiegalo in "notes".
9. Una visita per ogni data distinta; ordina le visite dalla più vecchia alla più recente.`
}
