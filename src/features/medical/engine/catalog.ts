/**
 * Catalogo delle misure canoniche dei referti strumentali.
 * Il prompt dell'AI Bridge usa questi codici → i valori sono confrontabili nel tempo.
 * I range sono riferimenti generali per adulti: quelli scritti nel referto hanno precedenza.
 */
import type { MedicalReportKind, Sex } from "@/types/domain"

export interface MeasureDef {
  code: string
  label: string
  unit: string | null
  kinds: MedicalReportKind[]
  low?: number
  high?: number
  /** Range diverso per le donne */
  lowF?: number
  highF?: number
  digits: number
  /** Spiegazione breve mostrata nel tooltip */
  hint?: string
}

export const MEASURES: MeasureDef[] = [
  // ECG
  { code: "heart_rate", label: "Frequenza cardiaca", unit: "bpm", kinds: ["ecg", "holter", "sports_medical", "blood_pressure", "stress_test"], low: 50, high: 100, digits: 0, hint: "Negli sportivi allenati 45–60 bpm a riposo è normale (bradicardia fisiologica)." },
  { code: "pr_ms", label: "Intervallo PR", unit: "ms", kinds: ["ecg", "sports_medical"], low: 120, high: 200, digits: 0, hint: "Tempo di conduzione atri → ventricoli." },
  { code: "qrs_ms", label: "Durata QRS", unit: "ms", kinds: ["ecg", "sports_medical"], low: 70, high: 110, digits: 0, hint: "Tempo di attivazione dei ventricoli." },
  { code: "qt_ms", label: "Intervallo QT", unit: "ms", kinds: ["ecg", "sports_medical"], digits: 0 },
  { code: "qtc_ms", label: "QT corretto (QTc)", unit: "ms", kinds: ["ecg", "sports_medical"], low: 340, high: 450, lowF: 340, highF: 460, digits: 0, hint: "QT corretto per la frequenza: alcuni farmaci e integratori lo allungano." },
  { code: "axis_deg", label: "Asse elettrico", unit: "°", kinds: ["ecg", "sports_medical"], low: -30, high: 90, digits: 0 },
  // Pressione
  { code: "systolic", label: "Pressione sistolica", unit: "mmHg", kinds: ["blood_pressure", "sports_medical", "stress_test", "specialist"], low: 90, high: 129, digits: 0, hint: "Ottimale < 120 mmHg; 120–129 normale-alta (ESC 2024)." },
  { code: "diastolic", label: "Pressione diastolica", unit: "mmHg", kinds: ["blood_pressure", "sports_medical", "stress_test", "specialist"], low: 60, high: 79, digits: 0, hint: "Ottimale < 80 mmHg." },
  // Spirometria
  { code: "fev1_pct", label: "FEV1 (% del predetto)", unit: "%", kinds: ["spirometry", "sports_medical"], low: 80, digits: 0 },
  { code: "fvc_pct", label: "FVC (% del predetto)", unit: "%", kinds: ["spirometry", "sports_medical"], low: 80, digits: 0 },
  { code: "fev1_fvc", label: "Indice di Tiffeneau (FEV1/FVC)", unit: "%", kinds: ["spirometry", "sports_medical"], low: 70, digits: 0 },
  { code: "pef_l_s", label: "Picco di flusso (PEF)", unit: "L/s", kinds: ["spirometry"], digits: 1 },
  // Ecocardiogramma
  { code: "ef_pct", label: "Frazione di eiezione", unit: "%", kinds: ["echo"], low: 52, high: 72, lowF: 54, highF: 74, digits: 0, hint: "Quanto sangue pompa il ventricolo sinistro a ogni battito." },
  { code: "lv_mass_index", label: "Massa VS indicizzata", unit: "g/m²", kinds: ["echo"], low: 49, high: 115, lowF: 43, highF: 95, digits: 0 },
  { code: "ivs_mm", label: "Setto interventricolare", unit: "mm", kinds: ["echo"], low: 6, high: 10, lowF: 6, highF: 9, digits: 1 },
  { code: "lvedd_mm", label: "Diametro telediastolico VS", unit: "mm", kinds: ["echo"], low: 42, high: 58, lowF: 38, highF: 52, digits: 0 },
  { code: "la_volume_index", label: "Volume atriale sx indicizzato", unit: "mL/m²", kinds: ["echo"], high: 34, digits: 0 },
  { code: "tapse_mm", label: "TAPSE", unit: "mm", kinds: ["echo"], low: 17, digits: 0 },
  // Test da sforzo
  { code: "max_heart_rate", label: "Frequenza massima raggiunta", unit: "bpm", kinds: ["stress_test", "holter", "sports_medical"], digits: 0 },
  { code: "pct_max_predicted_hr", label: "% FC massima teorica", unit: "%", kinds: ["stress_test"], low: 85, digits: 0 },
  { code: "mets", label: "Capacità funzionale", unit: "METs", kinds: ["stress_test"], low: 10, digits: 1 },
  { code: "vo2max", label: "VO₂max", unit: "mL/kg/min", kinds: ["stress_test", "sports_medical"], digits: 1 },
  { code: "max_systolic", label: "Sistolica al picco", unit: "mmHg", kinds: ["stress_test"], high: 210, digits: 0 },
  // Holter
  { code: "mean_heart_rate", label: "FC media 24 h", unit: "bpm", kinds: ["holter"], low: 50, high: 90, digits: 0 },
  { code: "min_heart_rate", label: "FC minima", unit: "bpm", kinds: ["holter"], digits: 0 },
  { code: "pvc_count", label: "Extrasistoli ventricolari (24 h)", unit: "n", kinds: ["holter"], high: 500, digits: 0, hint: "Fino a qualche centinaio nelle 24 ore è comune anche nei sani." },
  { code: "svpb_count", label: "Extrasistoli sopraventricolari (24 h)", unit: "n", kinds: ["holter"], high: 500, digits: 0 },
  // DEXA
  { code: "t_score", label: "T-score", unit: null, kinds: ["dexa"], low: -1, digits: 1, hint: "Densità ossea rispetto al picco giovanile: < −1 osteopenia, < −2,5 osteoporosi." },
  { code: "z_score", label: "Z-score", unit: null, kinds: ["dexa"], low: -2, digits: 1 },
  { code: "dexa_fat_pct", label: "Massa grassa (DEXA)", unit: "%", kinds: ["dexa"], digits: 1 },
  { code: "dexa_lean_kg", label: "Massa magra (DEXA)", unit: "kg", kinds: ["dexa"], digits: 1 },
  { code: "vat_g", label: "Grasso viscerale (VAT)", unit: "g", kinds: ["dexa"], high: 1000, digits: 0 },
  // Visita sportiva / altro
  { code: "spo2_pct", label: "Saturazione O₂", unit: "%", kinds: ["sports_medical", "spirometry", "stress_test", "specialist"], low: 95, digits: 0 },
  { code: "weight_kg", label: "Peso", unit: "kg", kinds: ["sports_medical", "specialist"], digits: 1 },
]

export const MEASURE_BY_CODE = new Map(MEASURES.map((m) => [m.code, m]))

export function defaultRange(code: string, sex: Sex | null): { low: number | null; high: number | null } {
  const d = MEASURE_BY_CODE.get(code)
  if (!d) return { low: null, high: null }
  const female = sex === "female"
  return {
    low: (female ? (d.lowF ?? d.low) : d.low) ?? null,
    high: (female ? (d.highF ?? d.high) : d.high) ?? null,
  }
}

/** Intervallo consigliato tra due controlli dello stesso tipo, in mesi (adulto sano, sportivo). */
export const RECHECK_MONTHS: Partial<Record<MedicalReportKind, number>> = {
  sports_medical: 12,
  ecg: 12,
  blood_pressure: 12,
  echo: 36,
  spirometry: 24,
  dexa: 24,
}
