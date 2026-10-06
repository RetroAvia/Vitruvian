/**
 * Range di riferimento per adulti (valori indicativi, non diagnostici).
 *  - Massa grassa %: Gallagher et al., Am J Clin Nutr 2000 (per sesso ed età)
 *  - FFMI: Kouri et al., Clin J Sport Med 1995 (scala indicativa)
 *  - Vita/altezza: Ashwell & Hsieh 2005 (soglia 0,5)
 *  - BMI: classi OMS
 */
import type { Sex } from "@/types/domain"

export type Band = "low" | "optimal" | "elevated" | "high"

export interface BandResult {
  band: Band
  label: string
}

export function bodyFatBand(pct: number, sex: Sex | null, age: number | null): BandResult {
  const female = sex === "female"
  const a = age ?? 30
  // [sotto, ottimale fino a, sovrappeso fino a] per fascia d'età
  const table = female
    ? a < 40 ? [21, 33, 39] : a < 60 ? [23, 34, 40] : [24, 36, 42]
    : a < 40 ? [8, 20, 25] : a < 60 ? [11, 22, 28] : [13, 25, 30]
  const [low, opt, high] = table as [number, number, number]
  if (pct < low) return { band: "low", label: "Sotto il range" }
  if (pct < opt) return { band: "optimal", label: "Nel range salutare" }
  if (pct < high) return { band: "elevated", label: "Sopra il range" }
  return { band: "high", label: "Elevata" }
}

export function ffmiBand(ffmi: number, sex: Sex | null): BandResult & { tier: string } {
  const t = sex === "female" ? [14, 17, 19, 22] : [17, 20, 22, 25]
  const [a, b, c, d] = t as [number, number, number, number]
  if (ffmi < a) return { band: "low", label: "Sotto la media", tier: "Sotto la media" }
  if (ffmi < b) return { band: "optimal", label: "Nella media", tier: "Nella media" }
  if (ffmi < c) return { band: "optimal", label: "Sopra la media", tier: "Sopra la media" }
  if (ffmi < d) return { band: "optimal", label: "Eccellente", tier: "Eccellente" }
  return { band: "elevated", label: "Eccezionale", tier: "Eccezionale" }
}

export function whtrBand(v: number): BandResult {
  if (v < 0.4) return { band: "low", label: "Molto basso" }
  if (v < 0.5) return { band: "optimal", label: "Rischio basso" }
  if (v < 0.6) return { band: "elevated", label: "Rischio aumentato" }
  return { band: "high", label: "Rischio alto" }
}

export function bmiBand(v: number): BandResult {
  if (v < 18.5) return { band: "low", label: "Sottopeso" }
  if (v < 25) return { band: "optimal", label: "Normopeso" }
  if (v < 30) return { band: "elevated", label: "Sovrappeso" }
  return { band: "high", label: "Obesità" }
}

/** Scala tipica degli impedenziometri (1–59): 1–12 sano, ≥13 eccesso. Dipende dallo strumento. */
export function visceralBand(v: number): BandResult {
  if (v <= 12) return { band: "optimal", label: "Nel range" }
  return { band: "high", label: "Eccesso" }
}

export function hydrationBand(pct: number, sex: Sex | null): BandResult {
  const [lo, hi] = sex === "female" ? [45, 60] : [50, 65]
  if (pct < lo) return { band: "low", label: "Bassa" }
  if (pct <= hi) return { band: "optimal", label: "Nella norma" }
  return { band: "elevated", label: "Alta" }
}
