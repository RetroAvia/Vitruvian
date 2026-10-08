import type { Metadata } from "next"

import { BodyView } from "@/features/body/body-view"

export const metadata: Metadata = { title: "Mappa corporea" }

export default function BodyPage() {
  return <BodyView />
}
