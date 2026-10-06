/**
 * Motore integratori: dosi giornaliere per principio attivo, confronto con
 * fabbisogni e limiti di sicurezza, interazioni e regole di assunzione,
 * aderenza alla checklist. Funzioni pure.
 */
import type { Insight } from "@/features/biometrics/engine/insights"
import { SUPPLEMENT_TIMINGS, type SupplementTiming } from "@/config/constants"
import { formatNumber, isNum, shiftISO } from "@/lib/format"
import type { Json } from "@/types/database.types"
import type { Sex, Supplement, SupplementIngredient, SupplementLog } from "@/types/domain"

import { NUTRIENTS, resolveNutrient, toCanonical, type NutrientDef } from "./nutrients"

/* ------------------------------ Normalizzazione ----------------------------- */

export function parseIngredients(j: Json | unknown): SupplementIngredient[] {
  if (!Array.isArray(j)) return []
  const out: SupplementIngredient[] = []
  for (const x of j) {
    if (!x || typeof x !== "object") continue
    const o = x as Record<string, unknown>
    const name = typeof o.name === "string" ? o.name.trim() : ""
    const code = typeof o.code === "string" && o.code.trim() ? o.code.trim() : name
    if (!code) continue
    const raw = o.amount
    const amount =
      typeof raw === "number" && Number.isFinite(raw)
        ? raw
        : typeof raw === "string" && raw.trim() !== "" && Number.isFinite(Number(raw.replace(",", ".")))
          ? Number(raw.replace(",", "."))
          : null
    out.push({ code, name: name || code, amount, unit: typeof o.unit === "string" && o.unit.trim() ? o.unit.trim() : null })
  }
  return out
}

/* ---------------------------- Frequenza e calendario ------------------------- */

/** Frazione di giorni in cui l'integratore viene assunto (per la media settimanale). */
export function frequencyFactor(s: Pick<Supplement, "frequency" | "days_per_week">): number {
  switch (s.frequency) {
    case "daily":
    case "cycle":
      return 1
    case "training_days":
      return (s.days_per_week ?? 4) / 7
    case "weekly":
      return (s.days_per_week ?? 1) / 7
    case "as_needed":
      return 0
  }
}

/** true se l'integratore va spuntato nella checklist di quel giorno. */
export function isScheduled(s: Supplement, iso: string): boolean {
  if (!s.is_active) return false
  if (s.start_date && iso < s.start_date) return false
  if (s.end_date && iso > s.end_date) return false
  return s.frequency !== "as_needed"
}

export function timingOrder(t: string): number {
  const keys = Object.keys(SUPPLEMENT_TIMINGS)
  const i = keys.indexOf(t)
  return i === -1 ? 99 : i
}

export function primaryTiming(s: Supplement): SupplementTiming | "any" {
  const t = [...s.timing].sort((a, b) => timingOrder(a) - timingOrder(b))[0]
  return t && t in SUPPLEMENT_TIMINGS ? (t as SupplementTiming) : "any"
}

/* --------------------------------- Totali ---------------------------------- */

export interface NutrientContribution {
  supplementId: string
  supplementName: string
  perDay: number
  avg: number
}

export interface NutrientTotal {
  def: NutrientDef
  /** quantità nel giorno di assunzione (somma di tutti i prodotti) */
  perDay: number
  /** media giornaliera sulla settimana */
  avg: number
  /** valore confrontato con l'UL (in base a def.basis) */
  compare: number
  /** % del riferimento giornaliero (media) */
  pctRi: number | null
  /** % del limite massimo */
  pctUl: number | null
  status: "ok" | "near" | "over" | "none"
  sources: NutrientContribution[]
}

export interface UnknownIngredient {
  supplementName: string
  name: string
  amount: number | null
  unit: string | null
}

export function computeTotals(supplements: Supplement[], sex: Sex | null) {
  const active = supplements.filter((s) => s.is_active)
  const map = new Map<string, NutrientTotal>()
  const unknown: UnknownIngredient[] = []

  for (const s of active) {
    const f = frequencyFactor(s)
    for (const ing of s.ingredients) {
      const def = resolveNutrient(ing.code) ?? resolveNutrient(ing.name)
      if (!def || !isNum(ing.amount)) {
        unknown.push({ supplementName: s.name, name: ing.name, amount: ing.amount, unit: ing.unit })
        continue
      }
      const canon = toCanonical(ing.amount, ing.unit, def)
      if (!isNum(canon)) {
        unknown.push({ supplementName: s.name, name: ing.name, amount: ing.amount, unit: ing.unit })
        continue
      }
      const perDay = canon * s.servings_per_day
      const t = map.get(def.code) ?? { def, perDay: 0, avg: 0, compare: 0, pctRi: null, pctUl: null, status: "none" as const, sources: [] }
      t.perDay += perDay
      t.avg += perDay * f
      t.sources.push({ supplementId: s.id, supplementName: s.name, perDay, avg: perDay * f })
      map.set(def.code, t)
    }
  }

  // EPA + DHA dichiarati separatamente → sommati negli omega-3 se il totale non c'è
  const epa = map.get("epa")
  const dha = map.get("dha")
  if (!map.has("omega3") && (epa || dha)) {
    const def = NUTRIENTS.find((n) => n.code === "omega3") as NutrientDef
    map.set("omega3", {
      def,
      perDay: (epa?.perDay ?? 0) + (dha?.perDay ?? 0),
      avg: (epa?.avg ?? 0) + (dha?.avg ?? 0),
      compare: 0,
      pctRi: null,
      pctUl: null,
      status: "none",
      sources: [...(epa?.sources ?? []), ...(dha?.sources ?? [])],
    })
  }
  map.delete("epa")
  map.delete("dha")

  const totals = [...map.values()].map((t) => {
    const ri = sex === "female" ? (t.def.riF ?? t.def.ri) : t.def.ri
    const compare = t.def.basis === "avg" ? t.avg : t.perDay
    const pctRi = isNum(ri) && ri > 0 ? (t.avg / ri) * 100 : null
    const pctUl = isNum(t.def.ul) && t.def.ul > 0 ? (compare / t.def.ul) * 100 : null
    const status: NutrientTotal["status"] = !isNum(pctUl) ? "none" : pctUl > 100 ? "over" : pctUl >= 80 ? "near" : "ok"
    return { ...t, compare, pctRi, pctUl, status }
  })

  totals.sort((a, b) => (b.pctUl ?? -1) - (a.pctUl ?? -1) || a.def.name.localeCompare(b.def.name))
  return { totals, unknown, active }
}

export function totalOf(totals: NutrientTotal[], code: string): NutrientTotal | undefined {
  return totals.find((t) => t.def.code === code)
}

/* ------------------------------- Aderenza ----------------------------------- */

export interface SupplementAdherence {
  /** % di dosi programmate e spuntate negli ultimi N giorni */
  pct: number | null
  scheduled: number
  taken: number
  streak: number
  days: Array<{ date: string; scheduled: number; taken: number }>
}

export function supplementAdherence(supplements: Supplement[], logs: SupplementLog[], today: string, span = 14): SupplementAdherence {
  const taken = new Set(logs.filter((l) => l.taken).map((l) => `${l.supplement_id}|${l.log_date}`))
  const firstLog = logs.reduce<string | null>((min, l) => (!min || l.log_date < min ? l.log_date : min), null)
  const days: SupplementAdherence["days"] = []
  for (let i = span - 1; i >= 0; i--) {
    const date = shiftISO(today, -i)
    // prima del primo utilizzo della checklist non contiamo i giorni come "saltati"
    if (!firstLog || date < firstLog) {
      days.push({ date, scheduled: 0, taken: 0 })
      continue
    }
    const sched = supplements.filter((s) => s.frequency === "daily" || s.frequency === "cycle").filter((s) => isScheduled(s, date))
    days.push({ date, scheduled: sched.length, taken: sched.filter((s) => taken.has(`${s.id}|${date}`)).length })
  }
  const scheduled = days.reduce((n, d) => n + d.scheduled, 0)
  const tk = days.reduce((n, d) => n + d.taken, 0)
  let streak = 0
  for (let i = days.length - 1; i >= 0; i--) {
    const d = days[i] as (typeof days)[number]
    if (d.date === today && d.taken < d.scheduled) continue // oggi non è ancora finito
    if (d.scheduled > 0 && d.taken >= d.scheduled) streak++
    else if (d.scheduled > 0) break
  }
  return { pct: scheduled > 0 ? Math.round((tk / scheduled) * 100) : null, scheduled, taken: tk, streak, days }
}

/* ------------------------- Interazioni e regole d'uso ------------------------ */

const FAT_SOLUBLE = new Set(["vitamin_d", "vitamin_a", "vitamin_e", "vitamin_k", "omega3", "coq10"])
const MEAL_TIMINGS = new Set(["breakfast", "lunch", "dinner", "with_meal"])

function hasNutrient(s: Supplement, code: string) {
  return s.ingredients.some((i) => (resolveNutrient(i.code) ?? resolveNutrient(i.name))?.code === code)
}

export function supplementInsights(supplements: Supplement[], totals: NutrientTotal[]): Insight[] {
  const out: Insight[] = []
  const active = supplements.filter((s) => s.is_active)

  for (const t of totals) {
    if (t.status === "over") {
      out.push({
        id: `ul-${t.def.code}`,
        kind: "alert",
        title: `${t.def.name}: ${formatNumber(t.compare, t.def.unit === "g" ? 1 : 0)} ${t.def.unit} oltre il limite di sicurezza`,
        detail: `Limite ${formatNumber(t.def.ul, 0)} ${t.def.unit}${t.def.ulSupplementOnly ? " (solo integratori)" : ""}${t.def.basis === "avg" ? " come media giornaliera" : " al giorno"}. Fonti: ${t.sources.map((s) => s.supplementName).join(", ")}.${t.def.note ? ` ${t.def.note}` : ""}`,
      })
    } else if (t.status === "near") {
      out.push({
        id: `near-${t.def.code}`,
        kind: "watch",
        title: `${t.def.name} vicino al limite (${formatNumber(t.pctUl, 0)}%)`,
        detail: `Considera anche ciò che arriva dagli alimenti${t.def.code === "caffeine" ? " (un espresso ≈ 60–80 mg di caffeina)" : ""}.`,
      })
    }
    if (t.sources.length >= 2) {
      out.push({
        id: `dup-${t.def.code}`,
        kind: "info",
        title: `${t.def.name} da ${t.sources.length} prodotti`,
        detail: `${t.sources.map((s) => `${s.supplementName} (${formatNumber(s.perDay, t.def.unit === "g" ? 1 : 0)} ${t.def.unit})`).join(" + ")}. Verifica che il doppio apporto sia voluto.`,
      })
    }
  }

  // Ferro con calcio/zinco/magnesio nello stesso momento
  const iron = active.filter((s) => hasNutrient(s, "iron"))
  for (const fe of iron) {
    const clash = active.filter(
      (s) => s.id !== fe.id && ["calcium", "zinc", "magnesium"].some((c) => hasNutrient(s, c)) && s.timing.some((t) => fe.timing.includes(t)),
    )
    if (clash.length > 0) {
      out.push({
        id: `iron-clash-${fe.id}`,
        kind: "watch",
        title: `${fe.name} insieme a ${clash.map((c) => c.name).join(", ")}`,
        detail: "Calcio, zinco e magnesio competono con il ferro: distanziali di almeno 2 ore. Il ferro si assorbe meglio a stomaco vuoto con vitamina C, lontano da caffè e tè.",
      })
    }
  }

  // Liposolubili a stomaco vuoto
  for (const s of active) {
    const fat = s.ingredients.some((i) => FAT_SOLUBLE.has((resolveNutrient(i.code) ?? resolveNutrient(i.name))?.code ?? ""))
    if (fat && s.timing.length > 0 && !s.timing.some((t) => MEAL_TIMINGS.has(t))) {
      out.push({
        id: `fat-${s.id}`,
        kind: "info",
        title: `${s.name}: meglio con un pasto`,
        detail: "Vitamine liposolubili e omega-3 si assorbono fino al 30–50% in più se assunti con un pasto che contiene grassi.",
      })
    }
  }

  // Caffeina la sera
  for (const s of active) {
    if (hasNutrient(s, "caffeine") && s.timing.some((t) => t === "dinner" || t === "bedtime")) {
      out.push({
        id: `caf-night-${s.id}`,
        kind: "watch",
        title: `${s.name} contiene caffeina ed è previsto la sera`,
        detail: "La caffeina resta attiva per 5–6 ore e peggiora la qualità del sonno, quindi il recupero. Se ti alleni la sera valuta una versione senza stimolanti.",
      })
    }
  }

  // Zinco alto senza rame
  const zinc = totalOf(totals, "zinc")
  if (zinc && zinc.avg >= 25 && !totalOf(totals, "copper")) {
    out.push({
      id: "zinc-copper",
      kind: "watch",
      title: `Zinco ${formatNumber(zinc.avg, 0)} mg/giorno senza rame`,
      detail: "Assunzioni prolungate di zinco ad alte dosi possono causare carenza di rame. Riduci la dose o fai controllare rame e ceruloplasmina.",
    })
  }

  // Biotina ad alte dosi
  const biotin = totalOf(totals, "biotin")
  if (biotin && biotin.perDay >= 1000) {
    out.push({
      id: "biotin-labs",
      kind: "watch",
      title: "Biotina ad alto dosaggio: attenzione alle analisi",
      detail: "Oltre 1 mg di biotina altera esami come TSH, FT4 e troponina. Sospendila 2–3 giorni prima del prelievo.",
    })
  }

  // Prodotti senza composizione: esclusi dai controlli di dose
  const empty = active.filter((s) => s.ingredients.length === 0)
  if (empty.length > 0) {
    out.push({
      id: "no-ingredients",
      kind: "info",
      title: `${empty.length} ${empty.length === 1 ? "integratore senza" : "integratori senza"} composizione`,
      detail: `${empty.map((s) => s.name).join(", ")}: aggiungi gli ingredienti (dall'etichetta) per includerli nei controlli di dose.`,
    })
  }

  const order = { alert: 0, watch: 1, strength: 2, info: 3 } as const
  return out.sort((a, b) => order[a.kind] - order[b.kind])
}

/** Raggruppa gli integratori di oggi per momento di assunzione. */
export function todaySchedule(supplements: Supplement[], iso: string) {
  const groups = new Map<string, Supplement[]>()
  for (const s of supplements) {
    if (!isScheduled(s, iso)) continue
    const t = primaryTiming(s)
    groups.set(t, [...(groups.get(t) ?? []), s])
  }
  return [...groups.entries()]
    .sort(([a], [b]) => timingOrder(a) - timingOrder(b))
    .map(([timing, items]) => ({
      timing,
      label: timing in SUPPLEMENT_TIMINGS ? SUPPLEMENT_TIMINGS[timing as SupplementTiming] : "In qualsiasi momento",
      items: items.sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)),
    }))
}
