import type { Metadata } from "next"

import { SupplementsView } from "@/features/supplements/components/supplements-view"

export const metadata: Metadata = { title: "Integratori" }

export default function SupplementsPage() {
  return <SupplementsView />
}
