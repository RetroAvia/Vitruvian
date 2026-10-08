/**
 * Emoji semplici per riconoscere a colpo d'occhio alimenti, pasti, esercizi
 * e integratori. Solo decorative: nel markup vanno sempre con aria-hidden.
 */
import type { MealSlot } from "@/types/domain"

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")

/** Regole in ordine: vince la prima che corrisponde (le più specifiche prima). */
const FOOD_RULES: Array<[RegExp, string]> = [
  [/\b(caffe|espresso|cappuccino)\b/, "☕"],
  [/\b(te|the|tisana|infuso)\b/, "🍵"],
  [/\bacqua\b/, "💧"],
  [/\b(succo|centrifugat|estratto)/, "🧃"],
  [/\b(spremuta|aranc|mandarin|clementin)/, "🍊"],
  [/\b(whey|shake|proteine in polvere|frullato|smoothie)\b/, "🥤"],
  [/\b(yogurt|skyr|kefir)\b/, "🥣"],
  [/\b(porridge|avena|muesli|granola|cereali|corn ?flakes)/, "🥣"],
  [/\b(parmigian|grana|mozzarell|ricotta|formagg|fiocchi di latte|feta|scamorza|emmental|provola|philadelphia|stracchino|caciotta|pecorino|fontina|primo sale|burrata)/, "🧀"],
  [/\blatte\b/, "🥛"],
  [/\b(uov[ao]|album|frittata|omelette)/, "🥚"],
  [/\b(gamber|scamp|mazzancoll)/, "🦐"],
  [/\b(polp[oi]\b|polip|calamar|seppi)/, "🦑"],
  [/\b(salmon|tonn|merluzz|pesce|orata|branzin|spigol|sgombr|alic|acciug|sardin|trota|baccala|platessa|nasello|halibut|rana pescatrice|sogliola|cozze|vongole)/, "🐟"],
  [/\b(pollo|tacchino|petto di|fesa)/, "🍗"],
  [/\b(prosciutt|salam|speck|mortadell|bresaola|wurstel|salsicc|pancett|coppa)/, "🥓"],
  [/\b(polpett[ae] di (ceci|lenticch|legumi|fagiol))/, "🫘"],
  [/\b(manzo|vitell|bistecc|hamburger|carne|maial|agnell|filetto|macinato|polpett|tagliata|roast)/, "🥩"],
  [/\b(pizza)\b/, "🍕"],
  [/\b(spaghett|penne|fusilli|rigaton|pasta|maccheron|tagliatell|linguin|farfalle|gnocchi|lasagn|ravioli|orecchiett)/, "🍝"],
  [/\b(riso|risott|basmati|venere|sushi)/, "🍚"],
  [/\b(pancake|crepe)/, "🥞"],
  [/\b(cornett|croissant|brioche)/, "🥐"],
  [/\b(biscott|frollin|cookie)/, "🍪"],
  [/\b(pan\b|pane|panin|fett[ae] biscottat|cracker|gallett|piadin|friselle|grissin|toast|bauletto|wasa|tortill|focacc)/, "🍞"],
  [/\b(patat)/, "🥔"],
  [/\b(ceci|lenticch|fagiol|piselli|edamame|lupin|fave|hummus|soia|tofu|tempeh)/, "🫘"],
  [/\b(broccol|cavolfior|cavol|verza|cime di rapa)/, "🥦"],
  [/\b(melanzan)/, "🍆"],
  [/\b(peperon)/, "🫑"],
  [/\b(zucchin|cetriol)/, "🥒"],
  [/\b(carot)/, "🥕"],
  [/\b(pomodor|passata|pelati)/, "🍅"],
  [/\b(fungh|champignon)/, "🍄"],
  [/\b(mais)\b/, "🌽"],
  [/\b(insalat|lattug|rucol|spinac|valerian|songino|bietol|radicchi|cicori|indivia|minestrone|verdur|ortagg|contorno)/, "🥬"],
  [/\b(zupp|vellutat|minestr|brodo)/, "🍲"],
  [/\b(avocado)/, "🥑"],
  [/\b(banan)/, "🍌"],
  [/\b(mela|mele)\b/, "🍎"],
  [/\b(pera|pere)\b/, "🍐"],
  [/\b(fragol)/, "🍓"],
  [/\b(mirtill|frutti di bosco|lampon|more)\b/, "🫐"],
  [/\b(kiwi)/, "🥝"],
  [/\b(uva)\b/, "🍇"],
  [/\b(ananas)/, "🍍"],
  [/\b(pesch[ae]|pesca|albicocc|prugn|susin)/, "🍑"],
  [/\b(anguria|cocomero|melone)/, "🍉"],
  [/\b(limon)/, "🍋"],
  [/\b(frutta secca|noci|nocciol|mandorl|arachid|anacard|pistacch|semi|burro di)/, "🥜"],
  [/\b(frutt[aoi]|macedonia)/, "🍎"],
  [/\b(olio|extravergine|evo)\b/, "🫒"],
  [/\b(cioccolat|cacao|barrett|nutella)/, "🍫"],
  [/\b(miele|marmellat|confettur)/, "🍯"],
  [/\b(gelato|sorbetto)/, "🍨"],
  [/\b(torta|dolce|crostat|merendin)/, "🍰"],
  [/\b(vino|prosecco|spumante)/, "🍷"],
  [/\b(birra)/, "🍺"],
]

/** Emoji di un alimento dal nome ("Pasta integrale" → 🍝); 🍽️ se non riconosciuto. */
export function foodEmoji(name: string): string {
  const n = norm(name)
  for (const [re, e] of FOOD_RULES) if (re.test(n)) return e
  return "🍽️"
}

export const MEAL_SLOT_EMOJI: Record<MealSlot, string> = {
  breakfast: "☕",
  morning_snack: "🍎",
  lunch: "🍝",
  afternoon_snack: "🥪",
  dinner: "🍽️",
  evening_snack: "🌙",
  pre_workout: "⚡",
  post_workout: "💪",
  other: "🍴",
}

const SUPPLEMENT_RULES: Array<[RegExp, string]> = [
  [/\b(creatin)/, "⚡"],
  [/\b(whey|protein|caseina|isolat)/, "🥤"],
  [/\b(omega|olio di pesce|krill|epa|dha)\b/, "🐟"],
  [/\b(vitamina d|vit\.? ?d|colecalciferol|d3)\b/, "☀️"],
  [/\b(caffein|pre[- ]?workout)/, "☕"],
  [/\b(eaa|bcaa|aminoacid|glutammin|citrullin|beta[- ]?alanin|arginin|carnitin)/, "🧪"],
  [/\b(collagen)/, "🦴"],
  [/\b(magnesi|zinco|ferro|potassio|calcio|sali minerali|elettrolit)/, "🧂"],
  [/\b(melatonin|ashwagandha|camomill|valerian)/, "😴"],
  [/\b(probiotic|fermenti)/, "🦠"],
]

export function supplementEmoji(name: string): string {
  const n = norm(name)
  for (const [re, e] of SUPPLEMENT_RULES) if (re.test(n)) return e
  return "💊"
}
