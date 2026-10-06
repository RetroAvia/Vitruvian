/**
 * Totali nutrizionali. Nelle alternative ("oppure") conta solo la prima
 * opzione di ogni gruppo, così i totali non raddoppiano.
 */
import { isNum } from "@/lib/format"

import type { DayWithMeals, MealItem, MealWithItems } from "../types"

export interface Macros {
  kcal: number
  protein_g: number
  carbs_g: number
  fat_g: number
  fiber_g: number
  /** Alimenti senza valori nutrizionali */
  missing: number
}

export const ZERO: Macros = { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0, missing: 0 }

export interface MealStructure {
  fixed: MealItem[]
  groups: Array<{ group: number; options: MealItem[] }>
}

export function mealStructure(meal: MealWithItems): MealStructure {
  const fixed: MealItem[] = []
  const groups = new Map<number, MealItem[]>()
  for (const it of [...meal.items].sort((a, b) => a.sort_order - b.sort_order)) {
    if (it.alternative_group === null) fixed.push(it)
    else groups.set(it.alternative_group, [...(groups.get(it.alternative_group) ?? []), it])
  }
  return { fixed, groups: [...groups.entries()].map(([group, options]) => ({ group, options })) }
}

function add(m: Macros, it: MealItem): Macros {
  return {
    kcal: m.kcal + (it.kcal ?? 0),
    protein_g: m.protein_g + (it.protein_g ?? 0),
    carbs_g: m.carbs_g + (it.carbs_g ?? 0),
    fat_g: m.fat_g + (it.fat_g ?? 0),
    fiber_g: m.fiber_g + (it.fiber_g ?? 0),
    missing: m.missing + (isNum(it.kcal) ? 0 : 1),
  }
}

export function mealTotals(meal: MealWithItems): Macros {
  const s = mealStructure(meal)
  const counted = [...s.fixed, ...s.groups.map((g) => g.options[0]).filter((x): x is MealItem => Boolean(x))]
  return counted.reduce(add, ZERO)
}

export function dayTotals(day: DayWithMeals): Macros {
  return day.meals.map(mealTotals).reduce(
    (a, b) => ({
      kcal: a.kcal + b.kcal,
      protein_g: a.protein_g + b.protein_g,
      carbs_g: a.carbs_g + b.carbs_g,
      fat_g: a.fat_g + b.fat_g,
      fiber_g: a.fiber_g + b.fiber_g,
      missing: a.missing + b.missing,
    }),
    ZERO,
  )
}

/** Energia dai macronutrienti (Atwater 4/4/9). */
export function macroKcal(m: Pick<Macros, "protein_g" | "carbs_g" | "fat_g">) {
  return m.protein_g * 4 + m.carbs_g * 4 + m.fat_g * 9
}

/** Ripartizione % delle calorie tra i macronutrienti. */
export function macroSplit(m: Pick<Macros, "protein_g" | "carbs_g" | "fat_g">) {
  const total = macroKcal(m)
  if (total <= 0) return { protein: 0, carbs: 0, fat: 0 }
  return {
    protein: ((m.protein_g * 4) / total) * 100,
    carbs: ((m.carbs_g * 4) / total) * 100,
    fat: ((m.fat_g * 9) / total) * 100,
  }
}

const DOW = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"]
export function dayShortLabel(d: DayWithMeals) {
  return d.day_of_week ? (DOW[d.day_of_week - 1] ?? d.label) : d.label
}

/** Giorno ISO della settimana (1 = lunedì) di una data YYYY-MM-DD. */
export function isoDow(iso: string) {
  const [y, m, dd] = iso.split("-").map(Number)
  const js = new Date(y ?? 1970, (m ?? 1) - 1, dd ?? 1).getDay()
  return js === 0 ? 7 : js
}

/** Giorno del piano da usare per una data: per giorno della settimana, altrimenti il primo "giorno tipo". */
export function dayForDate(days: DayWithMeals[], iso: string): DayWithMeals | undefined {
  const dow = isoDow(iso)
  return days.find((d) => d.day_of_week === dow) ?? days.find((d) => d.day_of_week === null) ?? days[0]
}
