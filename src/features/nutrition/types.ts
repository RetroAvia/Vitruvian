import type { Tables } from "@/types/database.types"

export type DietPlanRow = Tables<"diet_plans">
export type MealItem = Tables<"meal_items">
export type MealLog = Tables<"meal_logs">

export interface MealWithItems extends Tables<"meals"> {
  items: MealItem[]
}

export interface DayWithMeals extends Tables<"diet_days"> {
  meals: MealWithItems[]
}

export interface PlanTree {
  plan: DietPlanRow
  days: DayWithMeals[]
}
