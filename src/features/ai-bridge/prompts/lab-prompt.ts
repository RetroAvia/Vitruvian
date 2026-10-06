/**
 * Prompt per l'IA esterna: referto di analisi del sangue → JSON.
 * Include il catalogo esami con le unità canoniche, così i valori arrivano già convertiti.
 */
import { LAB_CATEGORY_LABELS } from "@/config/constants"
import type { LabAnalyte } from "@/types/domain"

export function buildLabPrompt(analytes: LabAnalyte[]): string {
  const catalog = analytes
    .map((a) => `- ${a.code} = ${a.name}${a.unit ? ` [${a.unit}]` : ""}`)
    .join("\n")
  const categories = Object.entries(LAB_CATEGORY_LABELS)
    .map(([k, v]) => `${k} (${v})`)
    .join(", ")

  return `Sei un assistente che estrae dati da referti di analisi del sangue di laboratori italiani.

COMPITO
Analizza il referto allegato (PDF, foto o testo) ed estrai TUTTI gli esami con valore numerico o esito. Se ci sono più prelievi con date diverse, crea un referto per ciascuna data.

FORMATO DI USCITA — OBBLIGATORIO
Rispondi SOLO con un oggetto JSON valido, senza testo prima o dopo e senza commenti. Puoi racchiuderlo in un blocco \`\`\`json.

{
  "schema": "vitruvian.labs.v1",
  "reports": [
    {
      "report_date": "YYYY-MM-DD",
      "lab_name": "Nome del laboratorio",
      "fasting": true,
      "notes": null,
      "results": [
        { "code": "glucose", "name": "Glicemia", "category": "metabolic", "value": 88, "value_text": null, "unit": "mg/dL", "ref_low": 70, "ref_high": 99, "note": null },
        { "code": "hbsag", "name": "HBsAg", "category": "other", "value": null, "value_text": "negativo", "unit": null, "ref_low": null, "ref_high": null, "note": null }
      ]
    }
  ]
}

CATALOGO ESAMI (code = nome [unità canonica])
${catalog}

REGOLE
1. report_date = data del PRELIEVO (non di stampa) in formato YYYY-MM-DD.
2. Usa il "code" del catalogo quando l'esame corrisponde, anche se nel referto ha un nome diverso (es. "Azotemia" → urea, "GPT" → alt, "Sideremia" → iron, "25-OH Vitamina D" → vitamin_d).
3. CONVERTI valore e range nell'unità canonica indicata tra parentesi quadre. Conversioni frequenti:
   - Glicemia mmol/L × 18 → mg/dL · Colesterolo mmol/L × 38,67 → mg/dL · Trigliceridi mmol/L × 88,57 → mg/dL
   - Creatinina µmol/L ÷ 88,4 → mg/dL · Vitamina D nmol/L ÷ 2,5 → ng/mL
   - HbA1c in % → mmol/mol = (% − 2,15) × 10,929 · Testosterone ng/mL × 100 → ng/dL · PCR mg/dL × 10 → mg/L
   Dopo la conversione scrivi in "unit" l'unità canonica.
4. Esami NON presenti nel catalogo: crea un code snake_case in inglese (es. "homocysteine", "lipoprotein_a"), "name" in italiano come nel referto, mantieni l'unità del referto e scegli "category" tra: ${categories}.
5. ref_low / ref_high = intervallo di riferimento DEL LABORATORIO (convertito). Se il referto indica solo "< X" usa ref_low null e ref_high X; se "> X" usa ref_low X e ref_high null. Se manca, null.
6. Numeri con il PUNTO decimale, senza simboli. Valori come "<0,5" → value null e value_text "<0.5".
7. Esiti qualitativi (negativo, positivo, assente…) → value null e value_text con l'esito.
8. fasting = true solo se il referto indica esplicitamente il digiuno, altrimenti null.
9. NON inventare valori. Se un dato è illeggibile, omettilo o spiegalo in "note".
10. Ignora formula leucocitaria in valore assoluto se è presente anche in percentuale (usa la percentuale), e ignora le intestazioni e i commenti amministrativi.`
}
