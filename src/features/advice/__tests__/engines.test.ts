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
