import { describe, expect, it } from "vitest"

import type { Checkup } from "@/types/domain"

import { computeDelta } from "../deltas"
import { METRICS } from "../metrics"
import { classifyRecomposition } from "../recomposition"
import { analyze } from "../report"
import { segmentByProtocol } from "../segments"

let n = 0
function visit(date: string, weight: number, fatPct: number | null, protocol: string | null, extra: Partial<Checkup> = {}): Checkup {
  n += 1
  const fat = fatPct === null ? null : (weight * fatPct) / 100
  return {
    id: `c${n}`,
    user_id: "u",
    visit_number: n,
    checkup_date: date,
    weight_kg: weight,
    fat_mass_pct: fatPct,
    fat_mass_kg: fat,
    ffm_kg: fat === null ? null : weight - fat,
    tbw_kg: fat === null ? null : (weight - fat) * 0.73,
    protocol_id: protocol,
    protocol_name: protocol,
    waist_cm: 80,
    ...extra,
  } as Checkup
}

describe("segmenti", () => {
  it("separa le visite al cambio di strumento", () => {
    const s = segmentByProtocol([visit("2024-01-01", 70, 15, "A"), visit("2024-03-01", 71, 15, "A"), visit("2024-06-01", 72, 14, "B")])
    expect(s).toHaveLength(2)
    expect(s[1]?.protocolId).toBe("B")
  })
})

describe("ricomposizione", () => {
  it("riconosce la ricomposizione", () => {
    const r = classifyRecomposition(visit("2024-01-01", 70, 15, "A"), visit("2024-03-01", 70, 12, "A"))
    expect(r.type).toBe("recomp")
  })
  it("segnala la perdita di massa magra", () => {
    const r = classifyRecomposition(visit("2024-01-01", 70, 15, "A"), visit("2024-03-01", 67, 15.7, "A"))
    expect(r.type).toBe("lean_loss_alert")
  })
  it("non confronta strumenti diversi", () => {
    const r = classifyRecomposition(visit("2024-01-01", 70, 15, "A"), visit("2024-03-01", 70, 12, "B"))
    expect(r.type).toBe("insufficient")
  })
  it("variazioni piccole = stabile", () => {
    const r = classifyRecomposition(visit("2024-01-01", 70, 15, "A"), visit("2024-03-01", 70.2, 15.2, "A"))
    expect(r.type).toBe("stable")
  })
})

describe("delta", () => {
  it("blocca il confronto BIA tra strumenti ma non quello del peso", () => {
    const list = [visit("2024-01-01", 70, 15, "A"), visit("2024-06-01", 72, 14, "B")]
    const segs = segmentByProtocol(list)
    const last = list[1] as Checkup
    expect(computeDelta(list, segs, last, METRICS.fat_pct, "previous").comparable).toBe(false)
    expect(computeDelta(list, segs, last, METRICS.weight, "previous").value).toBeCloseTo(2)
  })
})

describe("report", () => {
  it("produce insight e note", () => {
    const list = [visit("2024-01-01", 70, 15, "A"), visit("2024-03-01", 70, 12, "A"), visit("2024-05-01", 71, 11.5, "A")]
    const r = analyze(list, null, "2024-06-01")
    expect(r.lastRecomp?.type).toBeDefined()
    expect(r.insights.length).toBeGreaterThan(0)
    expect(r.notes).toContain("Note per il controllo")
  })
})
