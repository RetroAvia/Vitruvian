/**
 * Indici derivati calcolati per ogni referto che contiene gli esami necessari.
 *  - Colesterolo non-HDL = totale − HDL
 *  - Totale/HDL (indice di rischio di Castelli)
 *  - Trigliceridi/HDL: marcatore indiretto di insulino-resistenza (mg/dL)
 *  - HOMA-IR = glicemia (mg/dL) × insulina (µU/mL) / 405
 *  - AST/ALT (rapporto di De Ritis)
 *  - eGFR CKD-EPI 2021 (senza coefficiente etnico), se non riportato dal laboratorio
 */
import { isNum } from "@/lib/format"
import type { Sex } from "@/types/domain"

import type { AnalyteSeries } from "./series"
import { flagOf } from "./status"

export interface DerivedIndex {
  code: string
  name: string
  unit: string
  digits: number
  description: string
  refLow: number | null
  refHigh: number | null
  points: Array<{ date: string; value: number }>
}

export function ckdEpi2021(creatinineMgDl: number, age: number, sex: Sex): number {
  const female = sex === "female"
  const k = female ? 0.7 : 0.9
  const a = female ? -0.241 : -0.302
  const r = creatinineMgDl / k
  return 142 * Math.min(r, 1) ** a * Math.max(r, 1) ** -1.2 * 0.9938 ** age * (female ? 1.012 : 1)
}

function valuesByDate(series: AnalyteSeries[], code: string) {
  const s = series.find((x) => x.code === code)
  const map = new Map<string, number>()
  s?.points.forEach((p) => isNum(p.value) && map.set(p.date, p.value))
  return map
}

export function computeDerived(
  series: AnalyteSeries[],
  ctx: { sex: Sex | null; ageAt: (date: string) => number | null },
): DerivedIndex[] {
  const tc = valuesByDate(series, "total_cholesterol")
  const hdl = valuesByDate(series, "hdl")
  const tg = valuesByDate(series, "triglycerides")
  const glu = valuesByDate(series, "glucose")
  const ins = valuesByDate(series, "insulin")
  const ast = valuesByDate(series, "ast")
  const alt = valuesByDate(series, "alt")
  const crea = valuesByDate(series, "creatinine")
  const egfrReported = valuesByDate(series, "egfr")

  const combine = (a: Map<string, number>, b: Map<string, number>, f: (x: number, y: number) => number | null) =>
    [...a.entries()]
      .filter(([d]) => b.has(d))
      .map(([date, x]) => ({ date, value: f(x, b.get(date) as number) }))
      .filter((p): p is { date: string; value: number } => isNum(p.value))
      .sort((p, q) => p.date.localeCompare(q.date))

  const female = ctx.sex === "female"
  const out: DerivedIndex[] = [
    {
      code: "non_hdl",
      name: "Colesterolo non-HDL",
      unit: "mg/dL",
      digits: 0,
      description: "Tutto il colesterolo potenzialmente aterogeno (totale − HDL).",
      refLow: null,
      refHigh: 145,
      points: combine(tc, hdl, (x, y) => x - y),
    },
    {
      code: "tc_hdl",
      name: "Colesterolo totale / HDL",
      unit: "",
      digits: 2,
      description: "Indice di Castelli: sotto 4,5 (uomo) o 4 (donna) è favorevole.",
      refLow: null,
      refHigh: female ? 4 : 4.5,
      points: combine(tc, hdl, (x, y) => (y > 0 ? x / y : null)),
    },
    {
      code: "tg_hdl",
      name: "Trigliceridi / HDL",
      unit: "",
      digits: 2,
      description: "Marcatore indiretto di sensibilità insulinica: sotto 2 è ottimale, sopra 3 da approfondire.",
      refLow: null,
      refHigh: 3,
      points: combine(tg, hdl, (x, y) => (y > 0 ? x / y : null)),
    },
    {
      code: "homa_ir",
      name: "HOMA-IR",
      unit: "",
      digits: 2,
      description: "Resistenza insulinica da glicemia e insulina a digiuno: sotto 2,5 nella norma.",
      refLow: null,
      refHigh: 2.5,
      points: combine(glu, ins, (g, i) => (g * i) / 405),
    },
    {
      code: "ast_alt",
      name: "AST / ALT",
      unit: "",
      digits: 2,
      description: "Rapporto di De Ritis: valori alti con AST elevata possono dipendere dall'allenamento intenso.",
      refLow: 0.8,
      refHigh: 1.5,
      points: combine(ast, alt, (a, b) => (b > 0 ? a / b : null)),
    },
  ]

  if (egfrReported.size === 0 && ctx.sex && crea.size > 0) {
    out.push({
      code: "egfr_calc",
      name: "eGFR (calcolato)",
      unit: "mL/min/1,73m²",
      digits: 0,
      description: "CKD-EPI 2021 dalla creatinina. Con molta massa muscolare può sottostimare la funzione renale.",
      refLow: 90,
      refHigh: null,
      points: [...crea.entries()]
        .map(([date, c]) => {
          const age = ctx.ageAt(date)
          return { date, value: age === null ? null : ckdEpi2021(c, age, ctx.sex as Sex) }
        })
        .filter((p): p is { date: string; value: number } => isNum(p.value))
        .sort((a, b) => a.date.localeCompare(b.date)),
    })
  }

  return out.filter((d) => d.points.length > 0)
}

export function derivedFlag(d: DerivedIndex) {
  const last = d.points[d.points.length - 1]
  return last ? flagOf(last.value, d.refLow, d.refHigh) : "unknown"
}
