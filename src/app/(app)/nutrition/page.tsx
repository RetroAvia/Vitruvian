import type { Metadata } from "next"

import { NutritionView } from "@/features/nutrition/components/nutrition-view"

export const metadata: Metadata = { title: "Nutrizione" }

export default function NutritionPage() {
  return <NutritionView />
}
