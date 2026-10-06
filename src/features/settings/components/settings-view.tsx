"use client"

import { Settings } from "lucide-react"

import { PageHeader } from "@/components/shared/page-header"
import { BackupCard } from "@/features/backup/components/backup-card"
import { GoalsCard } from "@/features/profile/components/goals-card"
import { ProfileCard } from "@/features/profile/components/profile-card"

import { ProtocolsCard } from "./protocols-card"
import { SecurityCard } from "./security-card"

export function SettingsView() {
  return (
    <>
      <PageHeader
        icon={Settings}
        title="Impostazioni"
        description="Profilo, obiettivi, strumenti di misura, sicurezza dell'account e backup dei dati."
      />
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="space-y-4">
          <ProfileCard />
          <SecurityCard />
        </div>
        <div className="space-y-4">
          <GoalsCard />
          <BackupCard />
          <ProtocolsCard />
        </div>
      </div>
    </>
  )
}
