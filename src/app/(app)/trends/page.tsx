import type { Metadata } from "next"

import { TrendsView } from "@/features/trends/components/trends-view"

export const metadata: Metadata = { title: "Trend" }

export default function TrendsPage() {
  return <TrendsView />
}
