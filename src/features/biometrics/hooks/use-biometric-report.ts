"use client"

import { useMemo } from "react"

import { useCheckups } from "@/features/checkups/api/queries"
import { useProfile } from "@/features/profile/api/profile"

import { analyze } from "../engine/report"

/** Report del motore biometrico, ricalcolato solo quando cambiano visite o profilo. */
export function useBiometricReport() {
  const checkupsQ = useCheckups()
  const profileQ = useProfile()

  const report = useMemo(
    () => (checkupsQ.data ? analyze(checkupsQ.data, profileQ.data ?? null) : null),
    [checkupsQ.data, profileQ.data],
  )

  return {
    report,
    profile: profileQ.data ?? null,
    isPending: checkupsQ.isPending || profileQ.isPending,
    error: checkupsQ.error ?? profileQ.error,
  }
}
