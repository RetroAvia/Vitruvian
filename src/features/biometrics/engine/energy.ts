/**
 * Fabbisogno energetico.
 *  - TDEE = BMR (referto) × fattore di attività (PAL)
 *  - Katch-McArdle: BMR stimato dalla massa magra (370 + 21,6 × FFM)
 *  - Mifflin-St Jeor: BMR stimato da peso, altezza, età, sesso
 * Le due stime servono a validare il BMR del referto.
 */
import { ACTIVITY_LEVELS } from "@/config/constants"
import { isNum } from "@/lib/format"
import type { ActivityLevel, Sex } from "@/types/domain"

type N = number | null | undefined

export function tdee(bmr: N, activity: ActivityLevel | null | undefined): number | null {
  if (!isNum(bmr) || !activity) return null
  return Math.round(bmr * ACTIVITY_LEVELS[activity].factor)
}

export function katchMcArdle(ffmKg: N): number | null {
  return isNum(ffmKg) ? Math.round(370 + 21.6 * ffmKg) : null
}

export function mifflinStJeor(weightKg: N, heightCm: N, age: N, sex: Sex | null | undefined): number | null {
  if (!isNum(weightKg) || !isNum(heightCm) || !isNum(age) || !sex) return null
  return Math.round(10 * weightKg + 6.25 * heightCm - 5 * age + (sex === "male" ? 5 : -161))
}
