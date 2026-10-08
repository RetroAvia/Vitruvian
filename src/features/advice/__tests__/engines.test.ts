import { describe, expect, it } from "vitest"

import { classifyFood } from "@/features/nutrition/engine/foods"
import { bpClass, parseMeasurements } from "@/features/medical/engine/analysis"
import { computeTotals, frequencyFactor, parseIngredients } from "@/features/supplements/engine/analysis"
import { resolveNutrient, toCanonical } from "@/features/supplements/engine/nutrients"
import type { Supplement } from "@/types/domain"

const sup = (over: Partial<Supplement>): Supplement => ({
  id: "s",
  user_id: "u",
  name: "Test",
  brand: null,
  form: "capsule",
  dose_label: null,
  servings_per_day: 1,
  timing: [],
  frequency: "daily",
  days_per_week: null,
  ingredients: [],
  purpose: null,
  notes: null,
  start_date: null,
  end_date: null,
  is_active: true,
  sort_order: 100,
  source: "manual",
  raw_payload: null,
  created_at: "",
  updated_at: "",
  ...over,
})

describe("nutrienti", () => {
  it("risolve alias e converte le UI di vitamina D", () => {
    const d = resolveNutrient("Vitamina D3")
    expect(d?.code).toBe("vitamin_d")
    expect(toCanonical(2000, "UI", d!)).toBe(50)
    expect(toCanonical(1, "mg", resolveNutrient("biotin")!)).toBe(1000)
  })
})

describe("integratori", () => {
  it("somma lo stesso principio da più prodotti e segnala il limite", () => {
    const { totals } = computeTotals(
      [
        sup({ id: "a", ingredients: parseIngredients([{ code: "magnesium", name: "Mg", amount: 150, unit: "mg" }]) }),
        sup({ id: "b", ingredients: parseIngredients([{ code: "magnesio", name: "Magnesio", amount: 300, unit: "mg" }]) }),
      ],
      "male",
    )
    const mg = totals.find((t) => t.def.code === "magnesium")
    expect(mg?.perDay).toBe(450)
    expect(mg?.status).toBe("over")
    expect(mg?.sources).toHaveLength(2)
  })

  it("usa la media settimanale per le dosi non quotidiane", () => {
    expect(frequencyFactor({ frequency: "training_days", days_per_week: 4 })).toBeCloseTo(4 / 7)
    const { totals } = computeTotals(
      [sup({ frequency: "weekly", days_per_week: 1, ingredients: parseIngredients([{ code: "vitamin_d", name: "D", amount: 25000, unit: "IU" }]) })],
      "male",
    )
    expect(totals[0]?.avg).toBeCloseTo(625 / 7)
  })
})

describe("alimenti", () => {
  it("classifica gli alimenti italiani più comuni", () => {
    expect(classifyFood("Salmone affumicato")).toBe("oily_fish")
    expect(classifyFood("Pasta integrale")).toBe("whole_grains")
    expect(classifyFood("Pasta")).toBe("refined_grains")
    expect(classifyFood("Ceci lessati")).toBe("legumes")
    expect(classifyFood("Prosciutto crudo")).toBe("processed_meat")
    expect(classifyFood("Zucchine grigliate")).toBe("vegetables")
  })
})

describe("referti", () => {
  it("classifica la pressione secondo ESC 2024", () => {
    expect(bpClass(115, 68).cls).toBe("optimal")
    expect(bpClass(132, 84).cls).toBe("elevated")
    expect(bpClass(145, 85).cls).toBe("hypertension")
  })
  it("scarta misure vuote e accetta numeri con la virgola", () => {
    const m = parseMeasurements([{ code: "qtc_ms", value: "412,0" }, { code: "x" }, { code: "rhythm", value_text: "sinusale" }])
    expect(m).toHaveLength(2)
    expect(m[0]?.value).toBe(412)
  })
})

describe("allenamento", () => {
  it("stima il massimale e riconosce gli esercizi dal nome", async () => {
    const { e1rm, resolveExercise } = await import("@/features/training/engine/analysis")
    expect(e1rm(100, 1)).toBe(100)
    expect(Math.round(e1rm(80, 8) ?? 0)).toBe(101)
    expect(resolveExercise("", "Panca piana").code).toBe("bench_press")
    expect(resolveExercise("rdl", "RDL").code).toBe("romanian_deadlift")
  })
  it("calcola le proporzioni e le asimmetrie dalle circonferenze", async () => {
    const { asymmetries, proportions } = await import("@/features/training/engine/physique")
    const p = proportions({ shoulders: 118, waist: 80, arm: 36, neck: 39 })
    expect(p.find((x) => x.key === "shoulders_waist")?.status).toBe("ok")
    expect(p.find((x) => x.key === "arm_neck")?.status).toBe("low")
    const a = asymmetries({ arm_left: 36, arm_right: 37.4 })
    expect(a[0]?.relevant).toBe(true)
    expect(a[0]?.weaker).toBe("sinistro")
  })
  it("usa i riferimenti femminili (clessidra) per il profilo donna", async () => {
    const { proportions } = await import("@/features/training/engine/physique")
    const p = proportions({ shoulders: 100, waist: 68, hips: 84, arm: 27, neck: 32 }, "female")
    expect(p.find((x) => x.key === "hips_waist")?.status).toBe("low")
    expect(p.find((x) => x.key === "hips_waist")?.lowMeans).toContain("glutes")
    expect(p.some((x) => x.key === "arm_neck")).toBe(false)
  })
  it("deforma la figura femminile mantenendo l'asse di simmetria", async () => {
    const { bodyGeometry } = await import("@/components/body/body-geometry")
    const m = bodyGeometry("male")
    const f = bodyGeometry("female")
    expect(f.place([100, 180])[0]).toBe(100)
    expect(f.place([70, 180])[0] > 70).toBe(true)
    expect(f.place([70, 230])[0] < 70).toBe(true)
    expect(f.silhouette.length).toBe(m.silhouette.length)
  })
})

describe("tecniche e progressione", () => {
  it("genera le serie della piramide e del drop set", async () => {
    const { planSets } = await import("@/features/training/engine/techniques")
    const base = { sets: 4, reps_min: 6, reps_max: 8, rest_seconds: 120, set_scheme: null, duration_min: null }
    const pyr = planSets({ ...base, technique: "pyramid" }, 100)
    expect(pyr.map((s) => s.reps).join("-")).toBe("12-10-8-6")
    expect(pyr[3]?.weight).toBe(100)
    const drop = planSets({ ...base, technique: "drop_set" }, 100)
    expect(drop.length).toBe(6)
    expect(drop[4]?.weight).toBe(80)
  })
  it("doppia progressione: aumenta solo se chiudi tutte le serie al massimo", async () => {
    const { suggestLoad } = await import("@/features/training/engine/techniques")
    const up = suggestLoad([[8, 80, null, 0], [8, 80, null, 0], [8, 80, null, 0]], { reps_min: 6, reps_max: 8 }, { strength: true })
    expect(up.direction).toBe("up")
    expect(up.weight).toBe(82.5)
    const same = suggestLoad([[8, 80, null, 0], [7, 80, null, 0]], { reps_min: 6, reps_max: 8 }, { strength: true })
    expect(same.direction).toBe("same")
    const down = suggestLoad([[3, 80, null, 0], [3, 80, null, 0]], { reps_min: 6, reps_max: 8 }, { strength: true })
    expect(down.direction).toBe("down")
  })
  it("calcola i dischi per lato", async () => {
    const { platesPerSide } = await import("@/features/training/engine/techniques")
    expect(platesPerSide(102.5)?.plates.join("+")).toBe("25+15+1.25")
    expect(platesPerSide(15)).toBe(null)
  })
  it("ricostruisce progressi e volume dai riepiloghi compatti", async () => {
    const { exerciseProgress, loggedVolume } = await import("@/features/training/engine/analysis")
    const w = (date: string, e1rm: number) => ({ id: date, user_id: "u", workout_date: date, plan_day_id: null, title: "Push", duration_min: 60, session_rpe: 8, notes: null, source: "manual" as const, total_sets: 3, total_volume: 1800, created_at: "", updated_at: "", summary: [{ c: "bench_press", n: "Panca", sets: 3, reps: 24, vol: 1800, e1rm, top: [80, 8] as [number, number], maxr: 8 }] })
    const ws = [w("2026-09-30", 104), w("2026-09-16", 100), w("2026-09-02", 98)]
    const p = exerciseProgress(ws, "2026-10-07")
    expect(p[0]?.best.value).toBe(104)
    expect(p[0]?.status).toBe("progress")
    const v = loggedVolume(ws, "2026-10-07", 4)
    expect(v.perMuscle.chest).toBe(1.5)
  })
})
