/**
 * Smart Biometric Engine — indici antropometrici (funzioni pure).
 * Nessuna dipendenza da React o dal database: testabili in isolamento.
 * Tutte le funzioni restituiscono null se mancano gli input.
 */
import { isNum } from "@/lib/format"

type N = number | null | undefined

export function round(value: number, digits = 2): number {
  const f = 10 ** digits
  return Math.round(value * f) / f
}

/** Massa grassa in kg = peso × MG% */
export function fatMassKg(weightKg: N, fatPct: N): number | null {
  return isNum(weightKg) && isNum(fatPct) ? round((weightKg * fatPct) / 100) : null
}

/** Fat-Free Mass in kg = peso × (1 − MG%) — indipendente dalla definizione di "magra" del device */
export function fatFreeMassKg(weightKg: N, fatPct: N): number | null {
  return isNum(weightKg) && isNum(fatPct) ? round(weightKg * (1 - fatPct / 100)) : null
}

export function bmi(weightKg: N, heightCm: N): number | null {
  if (!isNum(weightKg) || !isNum(heightCm) || heightCm <= 0) return null
  return round(weightKg / (heightCm / 100) ** 2)
}

/** FFMI = FFM / altezza² (kg/m²) */
export function ffmi(ffmKg: N, heightCm: N): number | null {
  if (!isNum(ffmKg) || !isNum(heightCm) || heightCm <= 0) return null
  return round(ffmKg / (heightCm / 100) ** 2)
}

/** FFMI normalizzato a 1,80 m (Kouri et al., 1995) */
export function ffmiNormalized(ffmKg: N, heightCm: N): number | null {
  const base = ffmi(ffmKg, heightCm)
  if (base === null || !isNum(heightCm)) return null
  return round(base + 6.1 * (1.8 - heightCm / 100))
}

/** Rapporto generico a/b (es. vita/altezza, vita/addome) */
export function ratio(a: N, b: N, digits = 3): number | null {
  return isNum(a) && isNum(b) && b !== 0 ? round(a / b, digits) : null
}

/** Età in anni compiuti alla data indicata (ISO YYYY-MM-DD) */
export function ageAt(birthISO: string | null | undefined, atISO: string): number | null {
  if (!birthISO) return null
  const [by, bm, bd] = birthISO.split("-").map(Number)
  const [ay, am, ad] = atISO.split("-").map(Number)
  if (!by || !bm || !bd || !ay || !am || !ad) return null
  let age = ay - by
  if (am < bm || (am === bm && ad < bd)) age -= 1
  return age
}
