"use client"

import { Settings } from "lucide-react"

import { PageHeader } from "@/components/shared/page-header"
import { BackupCard } from "@/features/backup/components/backup-card"
import { HealthConnectCard } from "@/features/health/components/health-connect-card"
import { GoalsCard } from "@/features/profile/components/goals-card"
import { ProfileCard } from "@/features/profile/components/profile-card"

import { ProtocolsCard } from "./protocols-card"
import { SecurityCard } from "./security-card"
import { WorkoutAlertsCard } from "./workout-alerts-card"

export function SettingsView() {
  return (
    <>
      <PageHeader
        icon={Settings}
        title="Impostazioni"
        description="Profilo, obiettivi, avvisi dell'allenamento, Apple Salute, strumenti di misura, sicurezza e backup."
      />
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="space-y-4">
          <ProfileCard />
          <WorkoutAlertsCard />
          <SecurityCard />
        </div>
        <div className="space-y-4">
          <GoalsCard />
          <HealthConnectCard />
          <BackupCard />
          <ProtocolsCard />
        </div>
      </div>
    </>
  )
}
