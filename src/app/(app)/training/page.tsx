import type { Metadata } from "next"
import { Suspense } from "react"

import { Skeleton } from "@/components/ui/skeleton"
import { TrainingView } from "@/features/training/components/training-view"

export const metadata: Metadata = { title: "Allenamento" }

export default function TrainingPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
      <TrainingView />
    </Suspense>
  )
}
