/**
 * Classificazione degli alimenti del piano per gruppi (parole chiave in italiano)
 * e profilo settimanale: porzioni di verdura, legumi, pesce, carne rossa…
 * Serve al motore dei consigli per suggerimenti alimentari concreti.
 */
import { isNum } from "@/lib/format"

import type { DayWithMeals } from "../types"
import { dayTotals, mealTotals } from "./totals"

export type FoodGroup =
  | "vegetables"
  | "fruit"
  | "legumes"
  | "fish"
  | "oily_fish"
  | "red_meat"
  | "processed_meat"
  | "poultry"
  | "eggs"
  | "dairy"
  | "whole_grains"
  | "refined_grains"
  | "nuts_seeds"
  | "olive_oil"
  | "sweets"
  | "alcohol"

export const FOOD_GROUP_LABELS: Record<FoodGroup, string> = {
  vegetables: "Verdura",
  fruit: "Frutta",
  legumes: "Legumi",
  fish: "Pesce",
  oily_fish: "Pesce azzurro / grasso",
  red_meat: "Carne rossa",
  processed_meat: "Salumi e carni lavorate",
  poultry: "Carne bianca",
  eggs: "Uova",
  dairy: "Latte e derivati",
  whole_grains: "Cereali integrali",
  refined_grains: "Cereali raffinati",
  nuts_seeds: "Frutta secca e semi",
  olive_oil: "Olio extravergine",
  sweets: "Dolci",
  alcohol: "Alcolici",
}

/** Ordine di valutazione: le regole più specifiche prima. */
const RULES: Array<[FoodGroup, RegExp]> = [
  ["processed_meat", /\b(prosciutt|bresaol|salam|speck|mortadell|wurstel|würstel|pancett|salsicc|coppa|cotechin|affettat|hamburger di manzo)/],
  ["oily_fish", /\b(salmon|sgombr|alic|acciug|sardin|aringh|trota|tonno fresco|pesce spada|ricciola)/],
  ["fish", /\b(pesce|merluzz|nasell|orata|branzin|spigol|sogliol|tonno|platess|baccal|gamber|calamar|polp|seppi|cozz|vongol|crostace|surimi|halibut|dentice)/],
  ["red_meat", /\b(manzo|vitell|maial|agnell|cavall|bovin|fesa di vitello|fiorentina|bistecca|macinato|carpaccio|roast beef|lonza|filetto di manzo|tagliata)/],
  ["poultry", /\b(pollo|tacchin|petto di|fesa di tacchino|faraon|anatra)/],
  ["eggs", /\b(uov[oa]|album|tuorl|frittat|omelette)/],
  ["legumes", /\b(legum|ceci|lenticch|fagiol|piselli|fave|lupin|soia|edamame|tofu|tempeh|hummus|cicerchi)/],
  ["nuts_seeds", /\b(noci|nocciol|mandorl|anacard|pistacch|arachid|semi di|chia|lino|burro di arachidi|frutta secca|pinoli|noce)/],
  ["olive_oil", /\b(olio (extra|evo|d.oliva)|evo\b|olio extravergine)/],
  ["dairy", /\b(latte|yogurt|skyr|kefir|formagg|ricott|mozzarell|parmigian|grana|fiocchi di latte|stracchin|feta|quark|scamorz|emmental|caciotta|pecorin)/],
  ["whole_grains", /\b(integral|avena|fiocchi d.avena|farro|orzo|grano saraceno|quinoa|segale|miglio|riso (nero|rosso|venere|basmati integrale)|pane di segale|crusca|amaranto)/],
  ["refined_grains", /\b(pasta|riso|pane|gallett|crackers?|grissin|fette biscottate|gnocchi|cous ?cous|piadin|focacc|pizza|corn ?flakes|cereali|tortill|bagel)/],
  ["sweets", /\b(cioccolat|biscott|merendin|torta|gelato|marmellat|miele|zucchero|nutella|crema spalmabile|dolce|croissant|cornetto|brioche|caramell)/],
  ["alcohol", /\b(vino|birra|spritz|cocktail|liquor|amaro|prosecco|whisk|vodka|gin\b|rum\b)/],
  ["fruit", /\b(mela|mele|pera|pere|banan|arancia|arance|kiwi|frutti di bosco|mirtill|fragol|lampon|uva|pesca|pesche|albicocc|anguria|melone|ananas|mandarin|clementin|ciliegi|prugn|fichi|frutta|mango|pompelm|melagran|cachi|datteri)/],
  ["vegetables", /\b(verdur|insalat|lattug|rucol|spinac|zucchin|broccol|cavol|carot|pomodor|peperon|melanzan|finocch|cetriol|asparag|fagiolini|bietol|carciof|verza|radicchi|funghi|cipoll|sedano|zucca|minestrone|ortaggi|cicori|valerian|cavolfior|cavolini|catalogna|friariell|songino)/],
]

export function classifyFood(name: string): FoodGroup | null {
  const n = ` ${name.toLowerCase()}`
  for (const [g, re] of RULES) if (re.test(n)) return g
  return null
}

export interface FoodProfile {
  /** porzioni stimate a settimana per gruppo */
  weekly: Record<FoodGroup, number>
  /** alimenti più frequenti per gruppo (per spiegare i consigli) */
  examples: Partial<Record<FoodGroup, string[]>>
  avgKcal: number | null
  avgProtein: number | null
  avgFiber: number | null
  avgFat: number | null
  avgCarbs: number | null
  /** pasti con meno di 20 g di proteine sul totale dei pasti principali */
  lowProteinMeals: number
  mainMeals: number
  daysInPlan: number
  unclassified: number
}

const MAIN_SLOTS = new Set(["breakfast", "lunch", "dinner"])

export function foodProfile(days: DayWithMeals[]): FoodProfile {
  const weekly = Object.fromEntries(Object.keys(FOOD_GROUP_LABELS).map((k) => [k, 0])) as Record<FoodGroup, number>
  const ex: Record<string, Map<string, number>> = {}
  let unclassified = 0
  let lowProteinMeals = 0
  let mainMeals = 0
  const totals = days.map(dayTotals)

  for (const day of days) {
    for (const meal of day.meals) {
      // alternative "oppure": ogni alternativa conta 1/n
      const groupSize = new Map<number, number>()
      for (const it of meal.items) if (it.alternative_group !== null) groupSize.set(it.alternative_group, (groupSize.get(it.alternative_group) ?? 0) + 1)
      const seen = new Set<FoodGroup>()
      for (const it of meal.items) {
        const g = classifyFood(it.food_name)
        if (!g) {
          unclassified++
          continue
        }
        const w = it.alternative_group !== null ? 1 / (groupSize.get(it.alternative_group) ?? 1) : 1
        // una porzione per gruppo per pasto (due verdure nello stesso piatto = 1 porzione abbondante)
        if (!seen.has(g)) weekly[g] += w
        seen.add(g)
        const m = (ex[g] ??= new Map())
        const key = it.food_name.trim().toLowerCase()
        m.set(key, (m.get(key) ?? 0) + 1)
      }
      if (MAIN_SLOTS.has(meal.slot)) {
        mainMeals++
        const t = mealTotals(meal)
        if (t.protein_g > 0 && t.protein_g < 20) lowProteinMeals++
      }
    }
  }

  // piano con meno di 7 giorni → scala a una settimana
  const scale = days.length > 0 && days.length < 7 ? 7 / days.length : 1
  for (const k of Object.keys(weekly) as FoodGroup[]) weekly[k] = Math.round(weekly[k] * scale * 10) / 10

  const examples: FoodProfile["examples"] = {}
  for (const [g, m] of Object.entries(ex)) {
    examples[g as FoodGroup] = [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([n]) => n)
  }

  const avg = (f: (t: (typeof totals)[number]) => number) => {
    const vals = totals.map(f).filter((v) => v > 0)
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
  }

  return {
    weekly,
    examples,
    avgKcal: avg((t) => t.kcal),
    avgProtein: avg((t) => t.protein_g),
    avgFiber: avg((t) => t.fiber_g),
    avgFat: avg((t) => t.fat_g),
    avgCarbs: avg((t) => t.carbs_g),
    lowProteinMeals,
    mainMeals,
    daysInPlan: days.length,
    unclassified,
  }
}

export function hasProfileData(p: FoodProfile | null): p is FoodProfile {
  return Boolean(p && p.daysInPlan > 0 && (isNum(p.avgKcal) || Object.values(p.weekly).some((v) => v > 0)))
}
