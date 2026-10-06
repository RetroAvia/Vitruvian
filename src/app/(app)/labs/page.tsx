import type { Metadata } from "next"

import { LabsView } from "@/features/labs/components/labs-view"

export const metadata: Metadata = { title: "Analisi del sangue" }

export default function LabsPage() {
  return <LabsView />
}
