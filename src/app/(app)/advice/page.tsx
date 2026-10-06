import type { Metadata } from "next"

import { AdviceView } from "@/features/advice/components/advice-view"

export const metadata: Metadata = { title: "Consigli" }

export default function AdvicePage() {
  return <AdviceView />
}
