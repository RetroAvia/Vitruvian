import type { Metadata } from "next"
import { Suspense } from "react"

import { Skeleton } from "@/components/ui/skeleton"
import { CheckupsView } from "@/features/checkups/components/checkups-view"

export const metadata: Metadata = { title: "Visite" }

export default function CheckupsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-[560px] rounded-2xl" />}>
      <CheckupsView />
    </Suspense>
  )
}
