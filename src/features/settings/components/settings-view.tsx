"use client"

import { Settings } from "lucide-react"

import { PageHeader } from "@/components/shared/page-header"
import { GoalsCard } from "@/features/profile/components/goals-card"
import { ProfileCard } from "@/features/profile/components/profile-card"

import { ProtocolsCard } from "./protocols-card"

export function SettingsView() {
  return (
    <>
      <PageHeader
        icon={Settings}
        title="Impostazioni"
        description="Dati anagrafici per gli indici biometrici, obiettivi personali e strumenti di misura usati nelle visite."
      />
      <div className="grid gap-4 xl:grid-cols-2">
        <ProfileCard />
        <div className="space-y-4">
          <GoalsCard />
          <ProtocolsCard />
        </div>
      </div>
    </>
  )
}
