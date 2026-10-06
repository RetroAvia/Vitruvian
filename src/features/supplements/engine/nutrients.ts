/**
 * Catalogo dei principi attivi degli integratori con fabbisogni e limiti di sicurezza
 * per l'adulto (EFSA — Dietary Reference Values e Tolerable Upper Intake Levels,
 * aggiornamenti 2023–2024; per caffeina e omega-3 i livelli "sicuri" EFSA; per la
 * melatonina il limite del Ministero della Salute per gli integratori).
 *
 * ri  = assunzione di riferimento giornaliera (PRI o AI) da TUTTE le fonti
 * ul  = livello massimo tollerabile; con `ulSupplementOnly` vale per i soli integratori
 * basis = come confrontare con l'UL: "avg" (media settimanale, nutrienti di deposito)
 *         o "day" (giorno di assunzione, effetti acuti)
 */
export type NutrientUnit = "mg" | "µg" | "g"

export interface NutrientDef {
  code: string
  name: string
  unit: NutrientUnit
  ri?: number
  riF?: number
  ul?: number
  ulSupplementOnly?: boolean
  basis: "avg" | "day"
  /** codici alternativi che l'IA o l'utente potrebbero usare */
  aliases?: string[]
  note?: string
  group: "vitamin" | "mineral" | "fatty_acid" | "performance" | "other"
}

export const NUTRIENTS: NutrientDef[] = [
  // Vitamine liposolubili
  { code: "vitamin_d", name: "Vitamina D", unit: "µg", ri: 15, ul: 100, basis: "avg", group: "vitamin", aliases: ["vitamin_d3", "vitamin_d2", "cholecalciferol", "colecalciferolo", "vit_d", "vitamina_d", "vitamina_d3"], note: "Liposolubile: assumila con un pasto che contiene grassi." },
  { code: "vitamin_a", name: "Vitamina A (retinolo)", unit: "µg", ri: 750, riF: 650, ul: 3000, basis: "avg", group: "vitamin", aliases: ["retinol", "retinolo", "vitamina_a"] },
  { code: "vitamin_e", name: "Vitamina E", unit: "mg", ri: 13, riF: 11, ul: 300, basis: "avg", group: "vitamin", aliases: ["tocopherol", "tocoferolo", "vitamina_e"] },
  { code: "vitamin_k", name: "Vitamina K", unit: "µg", ri: 70, basis: "avg", group: "vitamin", aliases: ["vitamin_k2", "vitamin_k1", "menaquinone", "mk7", "mk_7", "vitamina_k", "vitamina_k2"], note: "Interagisce con gli anticoagulanti (warfarin)." },
  // Idrosolubili
  { code: "vitamin_c", name: "Vitamina C", unit: "mg", ri: 110, riF: 95, basis: "day", group: "vitamin", aliases: ["ascorbic_acid", "acido_ascorbico", "vitamina_c"], note: "Oltre 1 g al giorno aumenta il rischio di disturbi intestinali e, in chi è predisposto, di calcoli renali." },
  { code: "vitamin_b1", name: "Vitamina B1 (tiamina)", unit: "mg", ri: 1.1, basis: "avg", group: "vitamin", aliases: ["thiamine", "tiamina"] },
  { code: "vitamin_b2", name: "Vitamina B2 (riboflavina)", unit: "mg", ri: 1.6, basis: "avg", group: "vitamin", aliases: ["riboflavin", "riboflavina"] },
  { code: "niacin", name: "Niacina (B3)", unit: "mg", ri: 16, riF: 13, basis: "day", group: "vitamin", aliases: ["vitamin_b3", "nicotinamide", "niacinamide"], note: "UL 10 mg come acido nicotinico (vampate), 900 mg come nicotinamide." },
  { code: "vitamin_b5", name: "Acido pantotenico (B5)", unit: "mg", ri: 5, basis: "avg", group: "vitamin", aliases: ["pantothenic_acid", "acido_pantotenico"] },
  { code: "vitamin_b6", name: "Vitamina B6", unit: "mg", ri: 1.7, riF: 1.6, ul: 12, basis: "avg", group: "vitamin", aliases: ["pyridoxine", "piridossina"], note: "Dosi alte e prolungate possono dare formicolii (neuropatia)." },
  { code: "biotin", name: "Biotina (B8)", unit: "µg", ri: 40, basis: "avg", group: "vitamin", aliases: ["vitamin_b7", "vitamin_b8", "biotina"], note: "Sopra ~1 mg falsa alcuni esami del sangue (tiroide, troponina): sospendila 2–3 giorni prima del prelievo." },
  { code: "folate", name: "Folati / acido folico (B9)", unit: "µg", ri: 330, ul: 1000, ulSupplementOnly: true, basis: "avg", group: "vitamin", aliases: ["folic_acid", "acido_folico", "vitamin_b9", "methylfolate", "metilfolato"] },
  { code: "vitamin_b12", name: "Vitamina B12", unit: "µg", ri: 4, basis: "avg", group: "vitamin", aliases: ["cobalamin", "cyanocobalamin", "methylcobalamin", "cobalamina", "cianocobalamina", "metilcobalamina"] },
  // Minerali
  { code: "calcium", name: "Calcio", unit: "mg", ri: 950, ul: 2500, basis: "day", group: "mineral", aliases: ["calcio"] },
  { code: "magnesium", name: "Magnesio", unit: "mg", ri: 350, riF: 300, ul: 250, ulSupplementOnly: true, basis: "day", group: "mineral", aliases: ["magnesio"], note: "L'UL di 250 mg riguarda il SOLO magnesio da integratori (effetto lassativo)." },
  { code: "zinc", name: "Zinco", unit: "mg", ri: 11, riF: 8, ul: 25, basis: "avg", group: "mineral", aliases: ["zinco"], note: "Dosi alte prolungate riducono l'assorbimento del rame." },
  { code: "iron", name: "Ferro", unit: "mg", ri: 11, riF: 16, ul: 40, basis: "day", group: "mineral", aliases: ["ferro", "ferrous", "ferroso"], note: "Assumilo lontano da calcio, caffè e tè; con vitamina C si assorbe meglio." },
  { code: "selenium", name: "Selenio", unit: "µg", ri: 70, ul: 255, basis: "avg", group: "mineral", aliases: ["selenio"] },
  { code: "iodine", name: "Iodio", unit: "µg", ri: 150, ul: 600, basis: "avg", group: "mineral", aliases: ["iodio"] },
  { code: "copper", name: "Rame", unit: "mg", ri: 1.6, riF: 1.3, ul: 5, basis: "avg", group: "mineral", aliases: ["rame"] },
  { code: "potassium", name: "Potassio", unit: "mg", ri: 3500, basis: "day", group: "mineral", aliases: ["potassio"], note: "Con farmaci per la pressione o problemi renali chiedi al medico prima di integrarlo." },
  { code: "sodium", name: "Sodio", unit: "mg", basis: "day", group: "mineral", aliases: ["sodio"] },
  { code: "chromium", name: "Cromo", unit: "µg", ri: 40, basis: "avg", group: "mineral", aliases: ["cromo"] },
  { code: "manganese", name: "Manganese", unit: "mg", ri: 3, basis: "avg", group: "mineral" },
  // Acidi grassi
  { code: "omega3", name: "Omega-3 (EPA + DHA)", unit: "mg", ri: 250, ul: 5000, basis: "day", group: "fatty_acid", aliases: ["epa_dha", "omega_3", "fish_oil", "olio_di_pesce"], note: "Fino a 5 g/giorno di EPA+DHA considerati sicuri dall'EFSA." },
  { code: "epa", name: "EPA", unit: "mg", basis: "day", group: "fatty_acid" },
  { code: "dha", name: "DHA", unit: "mg", basis: "day", group: "fatty_acid" },
  // Prestazione
  { code: "creatine", name: "Creatina monoidrato", unit: "g", ri: 3, basis: "day", group: "performance", aliases: ["creatina", "creatine_monohydrate"], note: "3–5 g/giorno; aumenta la creatinina nel sangue senza indicare danno renale." },
  { code: "caffeine", name: "Caffeina", unit: "mg", ul: 400, basis: "day", group: "performance", aliases: ["caffeina", "caffeine_anhydrous"], note: "EFSA: fino a 400 mg/giorno (200 mg per singola dose) da tutte le fonti, caffè compreso." },
  { code: "beta_alanine", name: "Beta-alanina", unit: "g", basis: "day", group: "performance", aliases: ["beta_alanina"], note: "Il formicolio è innocuo; dosi frazionate lo riducono." },
  { code: "citrulline", name: "Citrullina", unit: "g", basis: "day", group: "performance", aliases: ["l_citrulline", "citrulline_malate", "citrullina"] },
  { code: "protein", name: "Proteine", unit: "g", basis: "day", group: "performance", aliases: ["whey", "whey_protein", "proteine", "protein_powder", "isolate"] },
  { code: "eaa", name: "Aminoacidi essenziali / BCAA", unit: "g", basis: "day", group: "performance", aliases: ["bcaa", "essential_amino_acids", "aminoacidi"] },
  { code: "electrolytes", name: "Elettroliti", unit: "g", basis: "day", group: "performance" },
  { code: "carbohydrates", name: "Carboidrati", unit: "g", basis: "day", group: "performance", aliases: ["carbs", "maltodextrin", "maltodestrine", "carboidrati"] },
  // Altro
  { code: "melatonin", name: "Melatonina", unit: "mg", ul: 1, ulSupplementOnly: true, basis: "day", group: "other", aliases: ["melatonina"], note: "In Italia gli integratori possono contenere al massimo 1 mg al giorno." },
  { code: "ashwagandha", name: "Ashwagandha", unit: "mg", basis: "day", group: "other", aliases: ["withania"], note: "Segnalati rari casi di danno epatico e interazioni con farmaci per la tiroide: evita l'uso continuativo senza parere medico." },
  { code: "collagen", name: "Collagene", unit: "g", basis: "day", group: "other", aliases: ["collagene", "collagen_peptides"] },
  { code: "fiber", name: "Fibre (psillio, inulina…)", unit: "g", basis: "day", group: "other", aliases: ["psyllium", "psillio", "inulin", "inulina", "fibre"] },
  { code: "probiotics", name: "Probiotici", unit: "g", basis: "day", group: "other", aliases: ["probiotici"] },
  { code: "coq10", name: "Coenzima Q10", unit: "mg", basis: "day", group: "other", aliases: ["coenzyme_q10", "ubiquinol", "ubiquinone"] },
  { code: "glutamine", name: "Glutammina", unit: "g", basis: "day", group: "other", aliases: ["glutammina", "l_glutamine"] },
  { code: "l_carnitine", name: "L-carnitina", unit: "g", basis: "day", group: "other", aliases: ["carnitine", "carnitina"] },
]

const BY_CODE = new Map<string, NutrientDef>()
for (const n of NUTRIENTS) {
  BY_CODE.set(n.code, n)
  for (const a of n.aliases ?? []) BY_CODE.set(a, n)
}

/** Normalizza un codice (snake_case) e lo risolve nel catalogo, se possibile. */
export function resolveNutrient(code: string): NutrientDef | undefined {
  const c = code
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
  return BY_CODE.get(c)
}

const UNIT_FACTOR: Record<string, { base: "mass"; toMg: number }> = {
  g: { base: "mass", toMg: 1000 },
  mg: { base: "mass", toMg: 1 },
  "µg": { base: "mass", toMg: 0.001 },
  ug: { base: "mass", toMg: 0.001 },
  mcg: { base: "mass", toMg: 0.001 },
}

/**
 * Converte una quantità nell'unità canonica del nutriente.
 * Gestisce le UI (unità internazionali) di vitamina D, A ed E.
 * Restituisce null se la conversione non è possibile.
 */
export function toCanonical(amount: number, unit: string | null | undefined, n: NutrientDef): number | null {
  const u = (unit ?? n.unit).trim().toLowerCase().replace("μ", "µ")
  if (u === "iu" || u === "ui" || u === "u.i." || u === "ie") {
    if (n.code === "vitamin_d") return amount / 40 // 40 UI = 1 µg
    if (n.code === "vitamin_a") return amount * 0.3 // 1 UI retinolo = 0,3 µg
    if (n.code === "vitamin_e") return amount * 0.67 // d-alfa-tocoferolo naturale
    return null
  }
  const from = UNIT_FACTOR[u]
  const to = UNIT_FACTOR[n.unit === "µg" ? "µg" : n.unit]
  if (!from || !to) return u === n.unit.toLowerCase() ? amount : null
  return (amount * from.toMg) / to.toMg
}

/** Formatta l'unità per la visualizzazione. */
export function unitLabel(u: NutrientUnit) {
  return u
}
