import type { Metadata } from "next"

import { ReportsView } from "@/features/medical/components/reports-view"

export const metadata: Metadata = { title: "Referti medici" }

export default function ReportsPage() {
  return <ReportsView />
}
