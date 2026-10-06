/** Spiegazioni brevi dei termini tecnici, mostrate nei tooltip ⓘ. */
export const GLOSSARY = {
  bia: "Bioimpedenziometria: la bilancia stima grasso, massa magra e acqua misurando come una debole corrente attraversa il corpo. Strumenti diversi danno valori non confrontabili.",
  fat_pct: "Percentuale del peso costituita da tessuto adiposo.",
  fat_kg: "Massa grassa in kg = peso × percentuale di massa grassa.",
  ffm: "Fat-Free Mass: tutto ciò che non è grasso (muscoli, organi, ossa, acqua). Calcolata come peso − massa grassa.",
  lean_ref: "Il valore di \"massa magra\" scritto sul referto: ogni strumento lo definisce in modo diverso.",
  ffmi: "Fat-Free Mass Index: massa magra ÷ altezza². Misura lo sviluppo muscolare indipendentemente dal grasso (uomo: 18–20 nella media, oltre 22 eccellente).",
  bmr: "Metabolismo basale: le calorie che consumi a riposo assoluto in 24 ore.",
  tdee: "Total Daily Energy Expenditure: calorie consumate in una giornata tipo = metabolismo basale × livello di attività.",
  whtr: "Rapporto vita/altezza: sotto 0,50 il rischio cardiometabolico è basso. Semplice e più predittivo del BMI.",
  bmi: "Indice di massa corporea = peso ÷ altezza². Non distingue tra muscolo e grasso.",
  visceral: "Grasso attorno agli organi addominali. Sulla scala degli impedenziometri 1–12 è nella norma.",
  tbw: "Acqua corporea totale in percentuale del peso. Varia con idratazione, pasti e allenamento.",
  recomposition: "Come cambiano insieme massa grassa e massa magra tra due visite con lo stesso strumento.",
  protocol: "Lo strumento BIA usato per la misura. I valori BIA si confrontano solo tra visite fatte con lo stesso strumento.",
  delta_base: "Riferimento delle variazioni: la visita precedente, la prima visita con lo strumento attuale o la prima visita in assoluto.",
  homa_ir: "Indice di resistenza insulinica da glicemia e insulina a digiuno: sotto 2,5 nella norma.",
  egfr: "Filtrato glomerulare stimato: indica quanto bene filtrano i reni. Sopra 90 è nella norma.",
  non_hdl: "Colesterolo totale − HDL: tutte le frazioni potenzialmente aterogene.",
  tg_hdl: "Trigliceridi ÷ HDL: marcatore indiretto di sensibilità insulinica, ottimale sotto 2.",
  adherence: "Pasti segnati come fatti (i sostituiti valgono metà) sui pasti previsti, nei soli giorni registrati.",
  energy_balance: "Calorie del piano − TDEE stimato: negativo = deficit, positivo = surplus.",
} as const

export type GlossaryKey = keyof typeof GLOSSARY
