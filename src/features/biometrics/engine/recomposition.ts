/**
 * Classificazione della ricomposizione corporea tra due visite
 * (stesso strumento BIA), sul piano ΔMassa grassa × ΔMassa magra (kg).
 *
 * Le soglie "di rumore" assorbono l'errore tipico della BIA tra misure
 * ripetute (~0,5–1 kg): variazioni più piccole sono considerate stabili.
 */
import { daysBetween, isNum } from "@/lib/format"
import type { Checkup } from "@/types/domain"

export type RecompType =
  | "recomp"
  | "lean_gain"
  | "lean_bulk"
  | "dirty_bulk"
  | "fat_gain"
  | "worsening"
  | "cut"
  | "mixed_loss"
  | "lean_loss_alert"
  | "water_retention"
  | "dehydration"
  | "stable"
  | "insufficient"

export type Tone = "good" | "neutral" | "warn" | "bad"

export const NOISE = { fatKg: 0.6, ffmKg: 0.8 } as const
/** Rapporto acqua/FFM fisiologico ≈ 0,73: scostamenti marcati indicano variazioni idriche */
const HYDRATION_SHIFT = 0.03

export const RECOMP_META: Record<RecompType, { title: string; tone: Tone; description: string }> = {
  recomp: {
    title: "Ricomposizione",
    tone: "good",
    description: "Meno grasso e più massa magra: il risultato migliore possibile.",
  },
  lean_gain: {
    title: "Guadagno muscolare pulito",
    tone: "good",
    description: "La massa magra cresce senza aumento di grasso.",
  },
  lean_bulk: {
    title: "Massa controllata",
    tone: "good",
    description: "Crescono entrambe, ma prevale la massa magra.",
  },
  dirty_bulk: {
    title: "Massa con eccesso di grasso",
    tone: "warn",
    description: "Il grasso cresce più della massa magra: valuta con il nutrizionista il surplus calorico.",
  },
  fat_gain: {
    title: "Aumento di grasso",
    tone: "warn",
    description: "Cresce il grasso, la massa magra resta stabile.",
  },
  worsening: {
    title: "Peggioramento della composizione",
    tone: "bad",
    description: "Più grasso e meno massa magra: da discutere al prossimo controllo.",
  },
  cut: {
    title: "Cut efficace",
    tone: "good",
    description: "Il grasso scende e la massa magra è preservata.",
  },
  mixed_loss: {
    title: "Perdita mista",
    tone: "neutral",
    description: "Cala soprattutto il grasso, con una piccola perdita di massa magra.",
  },
  lean_loss_alert: {
    title: "Allarme perdita di massa magra",
    tone: "bad",
    description: "La massa magra cala in modo significativo: segnalalo al nutrizionista.",
  },
  water_retention: {
    title: "Possibile ritenzione idrica",
    tone: "neutral",
    description: "L'aumento di massa magra è accompagnato da un aumento sproporzionato di acqua.",
  },
  dehydration: {
    title: "Possibile disidratazione",
    tone: "warn",
    description: "Il calo di massa magra è accompagnato da un calo sproporzionato di acqua: idratazione da verificare.",
  },
  stable: {
    title: "Composizione stabile",
    tone: "neutral",
    description: "Variazioni entro l'errore di misura dello strumento.",
  },
  insufficient: {
    title: "Dati insufficienti",
    tone: "neutral",
    description: "Servono due visite con BIA completa e lo stesso strumento.",
  },
}

export interface RecompResult {
  type: RecompType
  title: string
  tone: Tone
  description: string
  from: Checkup | null
  to: Checkup
  dFatKg: number | null
  dFfmKg: number | null
  dWeight: number | null
  dWaist: number | null
  days: number | null
  /** Coerenza tra circonferenza vita e massa grassa (null se non valutabile) */
  waistConsistent: boolean | null
}

function hydrationRatio(c: Checkup) {
  return isNum(c.tbw_kg) && isNum(c.ffm_kg) && c.ffm_kg > 0 ? c.tbw_kg / c.ffm_kg : null
}

export function classifyRecomposition(from: Checkup | null | undefined, to: Checkup): RecompResult {
  const base = {
    from: from ?? null,
    to,
    dFatKg: null,
    dFfmKg: null,
    dWeight: null,
    dWaist: null,
    days: null,
    waistConsistent: null,
  }
  const insufficient = (): RecompResult => ({ ...base, type: "insufficient", ...RECOMP_META.insufficient })

  if (!from || from.protocol_id !== to.protocol_id) return insufficient()
  if (!isNum(from.fat_mass_kg) || !isNum(to.fat_mass_kg) || !isNum(from.ffm_kg) || !isNum(to.ffm_kg)) {
    return insufficient()
  }

  const dFat = to.fat_mass_kg - from.fat_mass_kg
  const dFfm = to.ffm_kg - from.ffm_kg
  const fatUp = dFat > NOISE.fatKg
  const fatDown = dFat < -NOISE.fatKg
  const ffmUp = dFfm > NOISE.ffmKg
  const ffmDown = dFfm < -NOISE.ffmKg

  const hFrom = hydrationRatio(from)
  const hTo = hydrationRatio(to)
  const dHydration = hFrom !== null && hTo !== null ? hTo - hFrom : 0

  let type: RecompType
  if (ffmUp && dHydration > HYDRATION_SHIFT) type = "water_retention"
  else if (ffmDown && dHydration < -HYDRATION_SHIFT) type = "dehydration"
  else if (fatDown && ffmUp) type = "recomp"
  else if (!fatUp && !fatDown && ffmUp) type = "lean_gain"
  else if (fatUp && ffmUp) type = dFfm >= dFat ? "lean_bulk" : "dirty_bulk"
  else if (fatUp && !ffmDown) type = "fat_gain"
  else if (fatUp && ffmDown) type = "worsening"
  else if (fatDown && !ffmDown) type = "cut"
  else if (fatDown && ffmDown) type = Math.abs(dFfm) < Math.abs(dFat) * 0.5 ? "mixed_loss" : "lean_loss_alert"
  else if (ffmDown) type = "lean_loss_alert"
  else type = "stable"

  const dWaist = isNum(from.waist_cm) && isNum(to.waist_cm) ? to.waist_cm - from.waist_cm : null
  // Vita in crescita (>1 cm) mentre il grasso scende, o viceversa → dati incoerenti
  const waistConsistent =
    dWaist === null ? null : !((fatDown && dWaist > 1) || (fatUp && dWaist < -1.5))

  return {
    ...base,
    type,
    ...RECOMP_META[type],
    dFatKg: dFat,
    dFfmKg: dFfm,
    dWeight: isNum(from.weight_kg) && isNum(to.weight_kg) ? to.weight_kg - from.weight_kg : null,
    dWaist,
    days: daysBetween(from.checkup_date, to.checkup_date),
    waistConsistent,
  }
}
