import type { Metadata } from "next"
import { Suspense } from "react"

import { Skeleton } from "@/components/ui/skeleton"
import { BridgeView } from "@/features/ai-bridge/components/bridge-view"

export const metadata: Metadata = { title: "AI Bridge" }

export default function BridgePage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
      <BridgeView />
    </Suspense>
  )
}
