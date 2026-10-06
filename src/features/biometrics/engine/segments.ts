/**
 * Segmentazione per strumento BIA.
 * Due misure BIA sono confrontabili solo se fatte con lo stesso strumento:
 * la serie viene divisa in "segmenti" consecutivi con lo stesso protocollo.
 * Le visite senza BIA restano nel segmento in corso.
 */
import type { Checkup } from "@/types/domain"

export interface Segment {
  index: number
  protocolId: string | null
  protocolName: string | null
  checkups: Checkup[]
  start: string
  end: string
}

function hasBia(c: Checkup) {
  return c.fat_mass_pct !== null || c.bmr_kcal !== null || c.lean_mass_kg !== null
}

/** @param chronological visite in ordine di data crescente */
export function segmentByProtocol(chronological: Checkup[]): Segment[] {
  const segments: Segment[] = []
  let current: Segment | null = null

  for (const c of chronological) {
    const opensNew = current === null || (hasBia(c) && c.protocol_id !== current.protocolId && current.checkups.some(hasBia))
    if (opensNew || current === null) {
      current = {
        index: segments.length,
        protocolId: c.protocol_id,
        protocolName: c.protocol_name,
        checkups: [c],
        start: c.checkup_date,
        end: c.checkup_date,
      }
      segments.push(current)
    } else {
      if (!current.checkups.some(hasBia) && hasBia(c)) {
        current.protocolId = c.protocol_id
        current.protocolName = c.protocol_name
      }
      current.checkups.push(c)
      current.end = c.checkup_date
    }
  }
  return segments
}

export function segmentOf(segments: Segment[], checkupId: string): Segment | undefined {
  return segments.find((s) => s.checkups.some((c) => c.id === checkupId))
}
