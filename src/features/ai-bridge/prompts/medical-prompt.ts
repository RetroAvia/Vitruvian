/**
 * Prompt per l'IA esterna: referto strumentale (ECG, pressione, spirometria, eco…) → JSON.
 * Le misure usano codici canonici, così i valori sono confrontabili nel tempo.
 */
import { MEDICAL_KIND_LABELS, MEDICAL_OUTCOME_LABELS } from "@/config/constants"
import { MEASURES } from "@/features/medical/engine/catalog"

export function buildMedicalPrompt(): string {
  const kinds = Object.entries(MEDICAL_KIND_LABELS)
    .map(([k, v]) => `${k} (${v})`)
    .join(", ")
  const outcomes = Object.entries(MEDICAL_OUTCOME_LABELS)
    .map(([k, v]) => `${k} (${v})`)
    .join(", ")
  const catalog = MEASURES.map((m) => `- ${m.code} = ${m.label}${m.unit ? ` [${m.unit}]` : ""}`).join("\n")

  return `Sei un assistente che estrae dati da referti medici italiani (elettrocardiogramma, ecocardiogramma, test da sforzo, Holter, pressione arteriosa, spirometria, visita medico-sportiva, DEXA, ecografie, visite specialistiche).

COMPITO
Leggi il referto allegato (PDF, foto o testo) e trasformalo in JSON. Se nel materiale ci sono più referti (date o esami diversi) crea un elemento per ciascuno.

FORMATO DI USCITA — OBBLIGATORIO
Rispondi SOLO con un oggetto JSON valido, senza testo prima o dopo e senza commenti. Puoi racchiuderlo in un blocco \`\`\`json.

{
  "schema": "vitruvian.medical.v1",
  "reports": [
    {
      "report_date": "YYYY-MM-DD",
      "kind": "ecg",
      "title": "ECG a riposo",
      "facility": "Nome struttura o null",
      "physician": "Nome del medico o null",
      "summary": "Descrizione sintetica in 1–3 frasi di cosa è stato fatto e trovato",
      "conclusion": "Conclusione del medico, riportata fedelmente",
      "outcome": "normal",
      "measurements": [
        { "code": "heart_rate", "label": "Frequenza cardiaca", "value": 58, "value_text": null, "unit": "bpm", "ref_low": null, "ref_high": null },
        { "code": "rhythm", "label": "Ritmo", "value": null, "value_text": "sinusale", "unit": null, "ref_low": null, "ref_high": null }
      ],
      "findings": ["Ritmo sinusale", "Nessuna alterazione della ripolarizzazione"],
      "recommendations": ["Controllo tra 12 mesi"],
      "next_check_date": "YYYY-MM-DD o null",
      "notes": null
    }
  ]
}

TIPI (kind): ${kinds}
ESITO (outcome): ${outcomes}

CATALOGO MISURE (code = nome [unità])
${catalog}

REGOLE
1. report_date = data in cui è stato ESEGUITO l'esame, formato YYYY-MM-DD.
2. Usa il "code" del catalogo quando la misura corrisponde (es. "FC" → heart_rate, "QTc" → qtc_ms, "PA 120/80" → systolic 120 e diastolic 80, "FE" o "EF" → ef_pct, "Tiffeneau" → fev1_fvc). Per misure non in catalogo crea un code snake_case in inglese (es. "rhythm", "aortic_root_mm").
3. Converti nelle unità del catalogo (es. QT in secondi × 1000 → ms). Numeri con il PUNTO decimale, senza simboli.
4. Valori descrittivi (ritmo, morfologia, "nella norma") → value null e value_text con il testo.
5. ref_low / ref_high SOLO se il referto li riporta, altrimenti null.
6. outcome: "normal" se il medico conclude per normalità/idoneità; "borderline" se segnala qualcosa da monitorare o rivalutare; "abnormal" se riporta alterazioni significative o non idoneità; "unknown" se non è chiaro.
7. findings = reperti principali (frasi brevi). recommendations = indicazioni del medico (controlli, terapie, accertamenti).
8. next_check_date: se il referto indica "controllo tra N mesi", calcola la data a partire da report_date; altrimenti null.
9. Più misurazioni della pressione nello stesso referto → riporta la MEDIA in systolic/diastolic e scrivi le singole misure in notes.
10. NON inventare valori, NON aggiungere interpretazioni personali: riporta solo ciò che è scritto. Ometti dati anagrafici e codici fiscali.`
}
