/**
 * Avanzamento verso gli obiettivi personali.
 * Punto di partenza = ultima visita alla data di impostazione degli obiettivi
 * (per le metriche BIA: con lo stesso strumento della visita attuale).
 */
import { isNum } from "@/lib/format"
import type { Checkup, Profile } from "@/types/domain"

export interface GoalProgress {
  key: "weight" | "fat_pct" | "waist" | "ffm"
  label: string
  unit: string
  digits: number
  start: number | null
  current: number | null
  target: number
  /** 0–1 (null se non calcolabile) */
  progress: number | null
  remaining: number | null
  achieved: boolean
}

const DEFS = [
  { key: "weight", label: "Peso", unit: "kg", digits: 1, bia: false, get: (c: Checkup) => c.weight_kg, target: (p: Profile) => p.target_weight_kg },
  { key: "fat_pct", label: "Massa grassa", unit: "%", digits: 1, bia: true, get: (c: Checkup) => c.fat_mass_pct, target: (p: Profile) => p.target_fat_pct },
  { key: "waist", label: "Vita", unit: "cm", digits: 1, bia: false, get: (c: Checkup) => c.waist_cm, target: (p: Profile) => p.target_waist_cm },
  { key: "ffm", label: "Massa magra", unit: "kg", digits: 1, bia: true, get: (c: Checkup) => c.ffm_kg, target: (p: Profile) => p.target_ffm_kg },
] as const

export function hasGoals(p: Profile | null | undefined): boolean {
  return Boolean(p && DEFS.some((d) => isNum(d.target(p))))
}

/** true se la migrazione 0004 non è stata ancora applicata */
export function goalsUnavailable(p: Profile | null | undefined): boolean {
  return Boolean(p && !("target_weight_kg" in p))
}

export function computeGoals(profile: Profile | null, chronological: Checkup[]): GoalProgress[] {
  if (!profile) return []
  const out: GoalProgress[] = []
  const startDate = profile.goals_start_date

  for (const d of DEFS) {
    const target = d.target(profile)
    if (!isNum(target)) continue
    const withValue = chronological.filter((c) => isNum(d.get(c)))
    const latest = withValue[withValue.length - 1]
    const current = latest ? d.get(latest) : null

    let pool = withValue
    if (d.bia && latest) pool = pool.filter((c) => c.protocol_id === latest.protocol_id)
    const before = startDate ? pool.filter((c) => c.checkup_date <= startDate) : []
    const startRow = before[before.length - 1] ?? pool[0]
    const start = startRow ? d.get(startRow) : null

    let progress: number | null = null
    if (isNum(start) && isNum(current)) {
      if (start === target) progress = current === target ? 1 : 0
      else progress = Math.max(0, Math.min(1, (current - start) / (target - start)))
    }
    const remaining = isNum(current) ? target - current : null
    const achieved =
      isNum(current) && isNum(start) ? (target <= start ? current <= target : current >= target) : false

    out.push({ key: d.key, label: d.label, unit: d.unit, digits: d.digits, start, current, target, progress, remaining, achieved })
  }
  return out
}
