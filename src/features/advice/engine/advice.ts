/**
 * Motore dei consigli: incrocia visite, obiettivi, dieta, analisi del sangue,
 * integratori e referti per produrre suggerimenti concreti e motivati.
 *
 * Ogni regola è indipendente, guarda solo i dati che ha a disposizione e
 * produce un consiglio con: priorità, perché (i dati che lo giustificano)
 * e cosa fare (azione specifica, misurabile). Funzione pura e testabile.
 *
 * Fonti principali: linee guida CREA 2018 (porzioni settimanali), ISSN 2017
 * (proteine), ESC/EAS 2019 e ESC 2024 (lipidi e pressione), EFSA (UL).
 */
import type { BiometricReport } from "@/features/biometrics/engine/report"
import type { DataQuality, GoalForecast } from "@/features/biometrics/engine/forecast"
import { bodyFatBand, whtrBand } from "@/features/biometrics/engine/reference"
import type { LabReportSummary } from "@/features/labs/engine/report"
import type { AnalyteSeries } from "@/features/labs/engine/series"
import type { MedicalAnalysis } from "@/features/medical/engine/analysis"
import type { EnergyBalance } from "@/features/nutrition/engine/balance"
import type { FoodProfile } from "@/features/nutrition/engine/foods"
import type { NutrientTotal } from "@/features/supplements/engine/analysis"
import { ACTIVITY_LEVELS } from "@/config/constants"
import type { TrainingReport } from "@/features/training/engine/report"
import { resolveNutrient } from "@/features/supplements/engine/nutrients"
import { daysBetween, formatDate, formatNumber, formatSigned, isNum } from "@/lib/format"
import type { Profile, Supplement } from "@/types/domain"

export type AdviceCategory = "goals" | "body" | "training" | "nutrition" | "labs" | "supplements" | "heart" | "checkups"
export type AdvicePriority = "high" | "medium" | "low"

export const ADVICE_CATEGORY_LABELS: Record<AdviceCategory, string> = {
  goals: "Obiettivi",
  body: "Composizione",
  training: "Allenamento",
  nutrition: "Alimentazione",
  labs: "Analisi",
  supplements: "Integratori",
  heart: "Cuore e pressione",
  checkups: "Controlli",
}

export interface Advice {
  id: string
  category: AdviceCategory
  priority: AdvicePriority
  title: string
  /** I dati che giustificano il consiglio */
  why: string
  /** Azione concreta */
  action: string
  /** true = conferma di qualcosa che va bene (rinforzo positivo) */
  positive?: boolean
  link?: { href: string; label: string }
}

export interface AdviceInput {
  today: string
  profile: Profile | null
  bio: BiometricReport | null
  forecasts: GoalForecast[]
  quality: DataQuality | null
  labs: LabReportSummary | null
  balance: EnergyBalance | null
  food: FoodProfile | null
  planName: string | null
  mealAdherence: number | null
  supplements: Supplement[]
  supTotals: NutrientTotal[]
  medical: MedicalAnalysis | null
  /** report del motore allenamento (assente se la sezione non è usata) */
  training?: TrainingReport | null
}

const PRIORITY_ORDER: Record<AdvicePriority, number> = { high: 0, medium: 1, low: 2 }

/* --------------------------------- Helper ---------------------------------- */

function lab(labs: LabReportSummary | null, code: string): AnalyteSeries | null {
  const s = labs?.series.find((x) => x.code === code)
  return s && isNum(s.latest.value) ? s : null
}

function usesNutrient(supplements: Supplement[], code: string) {
  return supplements.filter(
    (s) => s.is_active && s.ingredients.some((i) => (resolveNutrient(i.code) ?? resolveNutrient(i.name))?.code === code),
  )
}

function derived(labs: LabReportSummary | null, code: string): number | null {
  const d = labs?.derived.find((x) => x.code === code)
  const v = d?.points[d.points.length - 1]?.value
  return isNum(v) ? v : null
}

const n0 = (v: number | null | undefined) => formatNumber(v, 0)
const n1 = (v: number | null | undefined) => formatNumber(v, 1)

/* --------------------------------- Motore ---------------------------------- */

function wantsMuscleGoal(profile: Profile | null, forecasts: GoalForecast[]) {
  return isNum(profile?.target_ffm_kg) || forecasts.some((f) => f.key === "ffm")
}

export function buildAdvice(input: AdviceInput): Advice[] {
  const { today, profile, bio, forecasts, labs, balance, food, supplements, supTotals, medical } = input
  const out: Advice[] = []
  const add = (a: Advice) => out.push(a)

  const weight = bio?.latest?.weight_kg ?? null
  const ffm = bio?.latestBia?.ffm_kg ?? null
  const sex = profile?.sex ?? null
  const active = supplements.filter((s) => s.is_active)
  const supProtein = supTotals.find((t) => t.def.code === "protein")?.perDay ?? 0
  const recomp = bio?.lastRecomp ?? null
  const ldl = lab(labs, "ldl")
  const tg = lab(labs, "triglycerides")
  const hdl = lab(labs, "hdl")
  const uric = lab(labs, "uric_acid")
  const ggt = lab(labs, "ggt")
  const alt = lab(labs, "alt")
  const fishWeek = food ? food.weekly.fish + food.weekly.oily_fish : null
  const omega3Sup = usesNutrient(supplements, "omega3").length + usesNutrient(supplements, "epa").length > 0

  /* ============================== OBIETTIVI ============================== */
  for (const f of forecasts) {
    const unit = f.unit === "%" ? " punti %" : ` ${f.unit}`
    const rate = `${formatSigned(f.perMonth, f.digits)}${unit}/mese`
    if (f.direction === "reached") {
      add({ id: `goal-${f.key}`, category: "goals", priority: "low", positive: true, title: `${f.label}: obiettivo raggiunto`, why: `Ultimo valore ${n1(f.current)} ${f.unit}, obiettivo ${n1(f.target)} ${f.unit}.`, action: "Imposta un nuovo obiettivo o passa al mantenimento.", link: { href: "/settings#obiettivi", label: "Obiettivi" } })
    } else if (f.direction === "toward") {
      const late = f.onTrackForDate === false
      add({
        id: `goal-${f.key}`,
        category: "goals",
        priority: late ? "medium" : "low",
        positive: !late && f.pace !== "too_fast",
        title: f.eta ? `${f.label}: arrivo stimato ${formatDate(f.eta, "medium")}` : `${f.label}: nella direzione giusta, ma lontano`,
        why: `Tendenza ${rate} (${f.points} misure, affidabilità ${f.confidence === "high" ? "alta" : f.confidence === "medium" ? "media" : "bassa"}). Mancano ${formatSigned(f.remaining, f.digits)}${unit}.${late && profile?.target_date ? ` La data obiettivo è il ${formatDate(profile.target_date, "medium")}.` : ""}`,
        action: late ? `A questo ritmo arrivi dopo la data prevista: serve una variazione di circa ${formatSigned(f.remaining / Math.max(daysBetween(today, profile?.target_date ?? today) / 30.4, 0.5), f.digits)}${unit}/mese, oppure sposta la data.` : f.paceNote || "Continua così.",
      })
    } else if (f.direction === "away") {
      add({
        id: `goal-${f.key}`,
        category: "goals",
        priority: "high",
        title: `${f.label}: ti stai allontanando dall'obiettivo`,
        why: `Tendenza ${rate} mentre l'obiettivo richiede ${formatSigned(f.remaining, f.digits)}${unit}.`,
        action: f.key === "weight" || f.key === "fat_pct" || f.key === "waist"
          ? "Rivedi con il nutrizionista l'apporto calorico: anche 200–300 kcal al giorno fanno la differenza in un mese."
          : "Per far crescere la massa magra servono surplus leggero, proteine ≥ 1,6 g/kg e allenamento progressivo.",
      })
    } else if (f.direction === "flat") {
      add({ id: `goal-${f.key}`, category: "goals", priority: "medium", title: `${f.label}: fermo da settimane`, why: `Variazione ${rate}: il valore è stabile, mancano ${formatSigned(f.remaining, f.digits)}${unit}.`, action: "Uno stallo di oltre 3–4 settimane è il momento giusto per piccoli aggiustamenti (calorie, passi giornalieri, carichi in palestra)." })
    }
    if (f.pace === "too_fast" && f.direction !== "away") {
      add({ id: `pace-${f.key}`, category: "goals", priority: "high", title: `${f.label}: ritmo troppo rapido`, why: f.paceNote, action: f.key === "weight" ? "Aumenta leggermente le calorie (100–200 kcal) e mantieni le proteine alte per proteggere la massa magra." : "Verifica la misura alla prossima visita, nelle stesse condizioni (mattino, a digiuno, dopo il bagno)." })
    }
  }

  /* ============================= COMPOSIZIONE ============================= */
  if (recomp && recomp.type !== "insufficient") {
    const surplus = balance && (balance.status === "surplus" || balance.status === "surplus_high")
    if (recomp.type === "dirty_bulk" || recomp.type === "fat_gain" || recomp.type === "worsening") {
      const target = isNum(balance?.tdee) ? Math.round(((balance.tdee as number) * 1.05) / 50) * 50 : null
      add({
        id: "fat-gain",
        category: "body",
        priority: recomp.type === "worsening" ? "high" : "medium",
        title: recomp.type === "worsening" ? "Più grasso e meno massa magra nell'ultimo periodo" : "L'ultimo aumento è soprattutto grasso",
        why: `Grasso ${formatSigned(recomp.dFatKg, 1)} kg, massa magra ${formatSigned(recomp.dFfmKg, 1)} kg in ${recomp.days ?? "?"} giorni.${surplus && isNum(balance?.delta) ? ` Il piano è in surplus di ${formatSigned(balance.delta, 0)} kcal.` : ""}`,
        action: surplus && target
          ? `Porta il surplus al 5% (circa ${n0(target)} kcal) riducendo soprattutto grassi da condimenti e snack, non le proteine.`
          : "Il piano non risulta in surplus: controlla extra fuori piano (bevande, condimenti, weekend) e la costanza nella checklist pasti.",
        link: { href: "/nutrition", label: "Nutrizione" },
      })
    }
    if (recomp.type === "lean_loss_alert" || recomp.type === "mixed_loss") {
      add({
        id: "lean-loss",
        category: "body",
        priority: recomp.type === "lean_loss_alert" ? "high" : "medium",
        title: "Stai perdendo massa magra",
        why: `Massa magra ${formatSigned(recomp.dFfmKg, 1)} kg nell'ultimo intervallo${balance?.status === "deficit_aggressive" ? `, con un deficit marcato (${formatSigned(balance.pct, 0)}%)` : ""}.`,
        action: `Proteine a 2,0–2,2 g/kg${isNum(weight) ? ` (${n0(weight * 2)}–${n0(weight * 2.2)} g/giorno)` : ""}, deficit non oltre il 20% e allenamento con i pesi almeno 3 volte a settimana.`,
      })
    }
    if (recomp.type === "dehydration") {
      add({ id: "hydration", category: "body", priority: "medium", title: "Idratazione da migliorare", why: "Il calo di massa magra è accompagnato da un calo sproporzionato di acqua corporea.", action: `Bevi circa ${isNum(weight) ? n1((weight * 35) / 1000) : "2,5"} L al giorno (35 mL/kg) più 0,5–1 L nei giorni di allenamento; presentati alla BIA idratato e a digiuno.` })
    }
    if (recomp.tone === "good") {
      add({ id: "recomp-good", category: "body", priority: "low", positive: true, title: recomp.title, why: `Grasso ${formatSigned(recomp.dFatKg, 1)} kg, massa magra ${formatSigned(recomp.dFfmKg, 1)} kg.`, action: "La strategia attuale funziona: non cambiare più di una variabile alla volta." })
    }
  }

  const latest = bio?.latest
  if (latest && isNum(latest.waist_to_height)) {
    const b = whtrBand(latest.waist_to_height)
    if (b.band !== "optimal" && b.band !== "low") {
      add({ id: "whtr", category: "body", priority: latest.waist_to_height >= 0.6 ? "high" : "medium", title: `Vita/altezza ${formatNumber(latest.waist_to_height, 2)}: grasso addominale da ridurre`, why: "Sopra 0,5 aumenta il rischio cardiometabolico anche con un peso normale.", action: "Obiettivo: vita inferiore a metà dell'altezza. Riduci zuccheri e alcol, aumenta passi (8–10.000/giorno) e fibre." })
    }
  }
  if (bio?.latestBia && isNum(bio.latestBia.fat_mass_pct)) {
    const b = bodyFatBand(bio.latestBia.fat_mass_pct, sex, bio.age)
    if (b.band === "low") {
      add({ id: "fat-low", category: "body", priority: "medium", title: `Massa grassa molto bassa (${n1(bio.latestBia.fat_mass_pct)}%)`, why: "Sotto la soglia salutare aumentano il rischio di carenze, cali ormonali e infortuni.", action: "Evita deficit prolungati; se sei in definizione programma una fase di mantenimento." })
    }
  }
  if (input.quality && input.quality.score < 60) {
    const weak = input.quality.factors.filter((f) => !f.ok).map((f) => f.label.toLowerCase())
    add({ id: "quality", category: "checkups", priority: "low", title: `Affidabilità dei dati ${input.quality.label.toLowerCase()} (${input.quality.score}/100)`, why: `Punti deboli: ${weak.join(", ")}.`, action: "Misure ogni 3–6 settimane, sempre con lo stesso strumento e nelle stesse condizioni, rendono trend e previsioni molto più precisi.", link: { href: "/checkups", label: "Visite" } })
  }

  /* ============================== ALIMENTAZIONE ============================= */
  if (food && food.daysInPlan > 0) {
    // Proteine (piano + integratori)
    if (isNum(food.avgProtein) && isNum(weight)) {
      const total = food.avgProtein + supProtein
      const gkg = total / weight
      if (gkg < 1.6) {
        const missing = Math.max(0, 1.8 * weight - total)
        add({
          id: "protein-low",
          category: "nutrition",
          priority: recomp && ["lean_loss_alert", "mixed_loss"].includes(recomp.type) ? "high" : "medium",
          title: `Proteine a ${formatNumber(gkg, 1)} g/kg: aggiungine circa ${n0(missing)} g al giorno`,
          why: `Piano ${n0(food.avgProtein)} g${supProtein > 0 ? ` + ${n0(supProtein)} g da integratori` : ""} per ${n1(weight)} kg. Per chi si allena l'intervallo efficace è 1,6–2,2 g/kg.`,
          action: "Esempi da ~20 g: 170 g di yogurt greco, 200 g di albumi, 100 g di petto di pollo o tonno al naturale, 150 g di legumi cotti + 30 g di parmigiano.",
        })
      } else if (gkg <= 2.4) {
        add({ id: "protein-ok", category: "nutrition", priority: "low", positive: true, title: `Proteine adeguate: ${formatNumber(gkg, 1)} g/kg`, why: `${n0(total)} g al giorno${isNum(ffm) ? ` (${formatNumber(total / ffm, 1)} g/kg di massa magra)` : ""}.`, action: "Mantieni l'apporto anche nei giorni di riposo: è lì che il muscolo si ricostruisce." })
      }
    }
    if (food.mainMeals >= 3 && food.lowProteinMeals / food.mainMeals >= 0.34) {
      add({ id: "protein-dist", category: "nutrition", priority: "low", title: "Proteine concentrate in pochi pasti", why: `${food.lowProteinMeals} pasti principali su ${food.mainMeals} hanno meno di 20 g di proteine.`, action: "Distribuisci 25–40 g di proteine in ciascuno dei 3–4 pasti: stimola meglio la sintesi muscolare rispetto a un unico pasto abbondante." })
    }
    // Fibre
    if (isNum(food.avgFiber) && food.avgFiber > 0 && food.avgFiber < 25) {
      add({
        id: "fiber",
        category: "nutrition",
        priority: ldl && ldl.latest.flag === "high" ? "high" : "medium",
        title: `Fibre a ${n0(food.avgFiber)} g al giorno (obiettivo ≥ 25–30 g)`,
        why: `Le fibre migliorano sazietà, glicemia e colesterolo${ldl && ldl.latest.flag === "high" ? ` — il tuo LDL è ${n0(ldl.latest.value)} mg/dL` : ""}.`,
        action: "Aggiungi una porzione di legumi al giorno, frutta con la buccia e passa a pane e pasta integrali; 30–40 g di fiocchi d'avena a colazione danno beta-glucani che abbassano l'LDL.",
      })
    }
    const w = food.weekly
    const ex = (g: keyof FoodProfile["examples"]) => (food.examples[g]?.length ? ` (es. ${food.examples[g]?.slice(0, 2).join(", ")})` : "")
    if (w.vegetables < 10) {
      add({ id: "veg", category: "nutrition", priority: "medium", title: `Verdura: circa ${n0(w.vegetables)} porzioni a settimana`, why: "Le linee guida indicano almeno 2 porzioni al giorno (14 a settimana).", action: "Aggiungi un contorno di verdura sia a pranzo sia a cena: ad esempio 200 g di verdure cotte o una ciotola di insalata mista." })
    }
    if (w.fruit < 10) {
      add({ id: "fruit", category: "nutrition", priority: "low", title: `Frutta: circa ${n0(w.fruit)} porzioni a settimana`, why: "Obiettivo 2–3 porzioni al giorno: vitamine, potassio e polifenoli.", action: "Usa la frutta come spuntino o post-allenamento (banana, frutti di bosco, kiwi)." })
    }
    if (w.legumes < 3) {
      add({ id: "legumes", category: "nutrition", priority: ldl?.latest.flag === "high" ? "medium" : "low", title: `Legumi: ${n0(w.legumes)} volte a settimana`, why: "Consigliati almeno 3 volte a settimana: proteine, fibre e minerali con pochi grassi.", action: "Sostituisci 2–3 secondi di carne con ceci, lenticchie o fagioli (anche in pasta e legumi)." })
    }
    if (fishWeek !== null && fishWeek < 2) {
      add({ id: "fish", category: "nutrition", priority: omega3Sup ? "low" : "medium", title: `Pesce: ${n0(fishWeek)} volte a settimana`, why: `Obiettivo 2–3 volte, di cui almeno una pesce azzurro o salmone per gli omega-3${omega3Sup ? " (prendi già un integratore di omega-3)" : ""}.`, action: "Inserisci salmone, sgombro, sardine o alici 1–2 volte a settimana al posto di carne o formaggi." })
    } else if (fishWeek !== null && fishWeek >= 3 && omega3Sup) {
      add({ id: "omega3-redundant", category: "supplements", priority: "low", title: "Omega-3: dieta già ricca di pesce", why: `${n0(fishWeek)} porzioni di pesce a settimana nel piano.`, action: "L'integratore di omega-3 potrebbe essere superfluo: valutalo con il nutrizionista, soprattutto se il pesce azzurro è frequente." })
    }
    if (w.red_meat > 3) {
      add({ id: "red-meat", category: "nutrition", priority: ldl?.latest.flag === "high" || uric?.latest.flag === "high" ? "medium" : "low", title: `Carne rossa ${n0(w.red_meat)} volte a settimana`, why: "Indicazione: non più di 2–3 porzioni a settimana.", action: `Sostituisci ${n0(w.red_meat - 2)} porzioni con pesce, pollame o legumi${ex("red_meat")}.` })
    }
    if (w.processed_meat > 1) {
      add({ id: "processed", category: "nutrition", priority: "medium", title: `Salumi ${n0(w.processed_meat)} volte a settimana`, why: "Le carni lavorate sono ricche di sale e grassi saturi; il consumo frequente è associato a rischio cardiovascolare e intestinale.", action: `Limita a 1 volta a settimana: bresaola e prosciutto magro restano le opzioni migliori${ex("processed_meat")}.` })
    }
    if (w.refined_grains >= 7 && w.whole_grains < w.refined_grains / 2) {
      add({ id: "whole-grains", category: "nutrition", priority: "low", title: "Cereali per lo più raffinati", why: `Circa ${n0(w.refined_grains)} porzioni di cereali raffinati e ${n0(w.whole_grains)} integrali a settimana.`, action: "Rendi integrale almeno metà delle porzioni (pasta, pane, riso): più fibre e glicemia più stabile a parità di calorie." })
    }
    if (w.nuts_seeds < 3) {
      add({ id: "nuts", category: "nutrition", priority: hdl?.latest.flag === "low" ? "medium" : "low", title: "Poca frutta secca", why: "Una manciata (30 g) 3–5 volte a settimana migliora il profilo lipidico.", action: "Usa noci, mandorle o pistacchi come spuntino, contando le calorie (≈ 180 kcal ogni 30 g)." })
    }
    if (w.alcohol > 0) {
      const liver = (ggt && ggt.latest.flag === "high") || (alt && alt.latest.flag === "high")
      add({ id: "alcohol", category: "nutrition", priority: liver || tg?.latest.flag === "high" ? "high" : "low", title: "Alcolici presenti nel piano", why: liver ? "GGT o ALT sopra il range: il fegato è sotto sforzo." : "L'alcol aggiunge calorie vuote e rallenta il recupero muscolare.", action: "Limita a occasioni sporadiche; nei giorni di allenamento evitalo del tutto." })
    }
    if (balance?.belowBmr) {
      add({ id: "below-bmr", category: "nutrition", priority: "high", title: "Calorie del piano sotto il metabolismo basale", why: `${n0(balance.planKcal)} kcal contro un BMR di ${n0(balance.bmr)} kcal.`, action: "Un deficit così ampio favorisce la perdita di muscolo: chiedi al nutrizionista se è voluto e per quanto tempo." })
    }
    if (isNum(input.mealAdherence) && input.mealAdherence < 70) {
      add({ id: "meal-adherence", category: "nutrition", priority: "medium", title: `Piano seguito al ${input.mealAdherence}%`, why: "Con un'aderenza sotto il 70% i risultati dipendono più dagli extra che dal piano.", action: "Identifica i pasti che salti più spesso e prepara alternative semplici (meal prep la domenica, spuntini proteici pronti).", link: { href: "/nutrition", label: "Checklist pasti" } })
    }
  } else if (bio?.latest) {
    add({ id: "no-diet", category: "nutrition", priority: "low", title: "Nessun piano alimentare caricato", why: "Senza dieta i consigli alimentari restano generici.", action: "Importa il piano del nutrizionista con l'AI Bridge per ricevere suggerimenti sulle porzioni e sui macronutrienti.", link: { href: "/bridge?tab=diet", label: "Importa dieta" } })
  }

  /* ============================ ANALISI DEL SANGUE ============================ */
  const vitD = lab(labs, "vitamin_d")
  const dSup = usesNutrient(supplements, "vitamin_d")
  const dTot = supTotals.find((t) => t.def.code === "vitamin_d")
  if (vitD && isNum(vitD.latest.value)) {
    const v = vitD.latest.value
    if (v < 20 && dSup.length === 0) add({ id: "vitd-low", category: "labs", priority: "high", title: `Vitamina D carente (${n0(v)} ng/mL)`, why: "Sotto 20 ng/mL: rischio per ossa, muscoli e difese immunitarie.", action: "Parla con il medico di un'integrazione (spesso 1.000–2.000 UI al giorno o equivalente settimanale) e ricontrolla dopo 3 mesi." })
    else if (v < 30 && dSup.length > 0) add({ id: "vitd-low-sup", category: "supplements", priority: "medium", title: `Vitamina D ancora bassa (${n0(v)} ng/mL) nonostante l'integratore`, why: `Assumi ${isNum(dTot?.avg) ? `${n0((dTot?.avg ?? 0) * 40)} UI/giorno in media` : "vitamina D"}${vitD.latest.date < (dSup[0]?.start_date ?? "0000") ? ", ma l'esame è precedente all'inizio" : ""}.`, action: "Verifica costanza e assunzione con un pasto contenente grassi; il dosaggio va rivisto con il medico." })
    else if (v < 30) add({ id: "vitd-insuf", category: "labs", priority: "medium", title: `Vitamina D insufficiente (${n0(v)} ng/mL)`, why: "Valore ottimale 30–60 ng/mL.", action: "Esposizione al sole (braccia e gambe, 15–20 minuti nelle ore centrali da aprile a ottobre) e pesce grasso; d'inverno valuta un integratore con il medico." })
    else if (v > 80 && dSup.length > 0) add({ id: "vitd-high", category: "supplements", priority: v > 100 ? "high" : "medium", title: `Vitamina D alta (${n0(v)} ng/mL) con integratore in corso`, why: "Sopra 100 ng/mL c'è rischio di ipercalcemia.", action: "Riduci o sospendi l'integrazione e ricontrolla vitamina D e calcio." })
    else if (v >= 30 && v <= 80) add({ id: "vitd-ok", category: "labs", priority: "low", positive: true, title: `Vitamina D nel range ottimale (${n0(v)} ng/mL)`, why: `Esame del ${formatDate(vitD.latest.date, "medium")}.`, action: dSup.length > 0 ? "L'integrazione attuale funziona: mantienila." : "Mantieni esposizione solare e alimentazione attuali." })
  } else if (dSup.length > 0) {
    add({ id: "vitd-check", category: "supplements", priority: "low", title: "Prendi vitamina D ma non hai un dosaggio recente", why: "Senza esame non si sa se la dose è giusta.", action: "Alla prossima analisi aggiungi 25-OH vitamina D (dopo almeno 3 mesi di integrazione)." })
  }

  const ferritin = lab(labs, "ferritin")
  const ironSup = usesNutrient(supplements, "iron")
  if (ferritin && isNum(ferritin.latest.value)) {
    const v = ferritin.latest.value
    if (v < 30) add({ id: "ferritin-low", category: "labs", priority: v < 15 ? "high" : "medium", title: `Riserve di ferro basse (ferritina ${n0(v)} ng/mL)`, why: "Sotto 30 ng/mL le scorte sono ridotte anche se l'emoglobina è normale: stanchezza e minor resistenza.", action: "Carne rossa magra o legumi con una fonte di vitamina C (peperoni, agrumi, kiwi), lontano da caffè e tè. Chiedi al medico se integrare." })
    else if (v > (sex === "female" ? 200 : 300) && ironSup.length > 0) add({ id: "ferritin-high-sup", category: "supplements", priority: "high", title: `Ferritina alta (${n0(v)} ng/mL) e integri ferro`, why: "Il ferro in eccesso si accumula e non viene eliminato.", action: `Sospendi ${ironSup.map((s) => s.name).join(", ")} e parlane con il medico.` })
    else if (v >= 50 && ironSup.length > 0) add({ id: "iron-no-need", category: "supplements", priority: "medium", title: "Integri ferro senza carenza", why: `Ferritina ${n0(v)} ng/mL: le riserve sono adeguate.`, action: `Valuta con il medico se sospendere ${ironSup.map((s) => s.name).join(", ")}: il ferro in eccesso non viene eliminato.` })
  } else if (ironSup.length > 0) {
    add({ id: "iron-blind", category: "supplements", priority: "medium", title: "Integri ferro senza ferritina misurata", why: "Il ferro andrebbe integrato solo con una carenza documentata.", action: "Fai emocromo, ferritina e saturazione della transferrina prima di proseguire." })
  }

  const nonHdl = derived(labs, "non_hdl")
  if ((ldl && ldl.latest.flag === "high") || (isNum(nonHdl) && nonHdl > 145)) {
    const dLdl = ldl && isNum(ldl.delta) ? ` (${formatSigned(ldl.delta, 0)} rispetto al precedente)` : ""
    add({
      id: "ldl",
      category: "labs",
      priority: "high",
      title: `Colesterolo LDL alto${ldl ? `: ${n0(ldl.latest.value)} mg/dL` : ""}`,
      why: `Oltre il riferimento del laboratorio${dLdl}. È il principale fattore di rischio cardiovascolare modificabile.`,
      action: [
        "Fibre solubili: avena, orzo, legumi ogni giorno",
        food && food.weekly.processed_meat + food.weekly.red_meat > 3 ? "riduci salumi e carne rossa" : null,
        "formaggi stagionati al massimo 2 volte a settimana",
        "grassi da olio extravergine, frutta secca e pesce azzurro",
      ].filter(Boolean).join("; ") + ". Ricontrolla dopo 3 mesi.",
    })
  }
  const tgHdl = derived(labs, "tg_hdl")
  if ((tg && tg.latest.flag === "high") || (isNum(tgHdl) && tgHdl > 3)) {
    add({ id: "tg", category: "labs", priority: "medium", title: `Trigliceridi${tg ? ` ${n0(tg.latest.value)} mg/dL` : ""} / rapporto TG/HDL elevato`, why: "Indice di sensibilità insulinica ridotta.", action: "Riduci zuccheri semplici, succhi, alcol e farinacei raffinati la sera; più pesce azzurro e attività aerobica (150 min/settimana)." })
  }
  if (hdl && hdl.latest.flag === "low") {
    add({ id: "hdl", category: "labs", priority: "medium", title: `HDL basso (${n0(hdl.latest.value)} mg/dL)`, why: "L'HDL protegge le arterie; aumenta con attività aerobica e grassi buoni.", action: "Inserisci 2–3 sedute aerobiche a settimana, olio extravergine a crudo e frutta secca; evita il fumo." })
  }
  const glucose = lab(labs, "glucose")
  const hba1c = lab(labs, "hba1c")
  const homa = derived(labs, "homa_ir")
  if ((glucose && glucose.latest.flag === "high") || (hba1c && hba1c.latest.flag === "high") || (isNum(homa) && homa > 2.5)) {
    add({ id: "glycemia", category: "labs", priority: "high", title: "Metabolismo degli zuccheri da migliorare", why: [glucose?.latest.flag === "high" ? `glicemia ${n0(glucose.latest.value)} mg/dL` : null, hba1c?.latest.flag === "high" ? `HbA1c ${n0(hba1c.latest.value)} mmol/mol` : null, isNum(homa) && homa > 2.5 ? `HOMA-IR ${formatNumber(homa, 1)}` : null].filter(Boolean).join(", ") + ".", action: "Carboidrati integrali e sempre accompagnati da proteine/fibre, camminata di 10–15 minuti dopo i pasti, riduzione del grasso addominale. Ricontrolla con il medico." })
  }
  const creat = lab(labs, "creatinine")
  const creatineSup = usesNutrient(supplements, "creatine")
  if (creat && creat.latest.flag === "high") {
    add({
      id: "creatinine",
      category: "labs",
      priority: creatineSup.length > 0 ? "low" : "medium",
      title: `Creatinina alta (${formatNumber(creat.latest.value, 2)} mg/dL)`,
      why: creatineSup.length > 0
        ? "Prendi creatina: aumenta la creatinina nel sangue senza indicare un danno renale. Anche molta massa muscolare e allenamenti intensi la alzano."
        : "Può dipendere da massa muscolare, allenamento intenso o disidratazione, ma va interpretata.",
      action: creatineSup.length > 0
        ? "Al prossimo controllo chiedi la cistatina C (non influenzata dalla creatina) oppure sospendi la creatina 3–4 settimane prima dell'esame."
        : "Ripeti l'esame idratato e senza allenamento intenso nelle 48 ore precedenti; se resta alta parlane con il medico.",
    })
  }
  const urea = lab(labs, "urea")
  if (urea && urea.latest.flag === "high") {
    add({ id: "urea", category: "labs", priority: "low", title: `Azotemia alta (${n0(urea.latest.value)} mg/dL)`, why: "Comune con diete molto proteiche o poca acqua.", action: `Bevi di più (almeno ${isNum(weight) ? n1((weight * 35) / 1000) : "2,5"} L al giorno) e verifica di non superare 2,2–2,5 g/kg di proteine.` })
  }
  if (uric && uric.latest.flag === "high") {
    add({ id: "uric", category: "labs", priority: "medium", title: `Acido urico alto (${formatNumber(uric.latest.value, 1)} mg/dL)`, why: "Aumenta il rischio di gotta e calcoli.", action: "Riduci salumi, frattaglie, carne rossa, birra e bibite zuccherate; aumenta acqua, latticini magri e verdure." })
  }
  if ((alt && alt.latest.flag === "high") || lab(labs, "ast")?.latest.flag === "high") {
    const cpk = lab(labs, "cpk")
    add({ id: "liver", category: "labs", priority: "medium", title: "Transaminasi sopra il range", why: cpk?.latest.flag === "high" ? "Anche il CPK è alto: probabile origine muscolare (allenamento intenso nei giorni prima)." : "Possono salire per allenamento intenso, alcol, farmaci o fegato grasso.", action: "Ripeti l'esame dopo 3–4 giorni senza allenamenti pesanti e senza alcol; se restano alte, parlane con il medico." })
  }
  const b12 = lab(labs, "vitamin_b12")
  if (b12 && b12.latest.flag === "low") {
    add({ id: "b12", category: "labs", priority: "medium", title: `Vitamina B12 bassa (${n0(b12.latest.value)} pg/mL)`, why: "Necessaria per globuli rossi e sistema nervoso.", action: usesNutrient(supplements, "vitamin_b12").length > 0 ? "Stai già integrando: verifica la dose con il medico e ricontrolla." : "Pesce, uova, latticini e carne ne sono ricchi; con valori bassi il medico valuterà un'integrazione." })
  }
  const tsh = lab(labs, "tsh")
  const biotin = supTotals.find((t) => t.def.code === "biotin")
  if (tsh && tsh.latest.flag !== "normal" && tsh.latest.flag !== "unknown" && biotin && biotin.perDay >= 1000) {
    add({ id: "tsh-biotin", category: "labs", priority: "medium", title: "TSH fuori range: possibile interferenza della biotina", why: "Le dosi alte di biotina falsano i dosaggi ormonali tiroidei.", action: "Sospendi la biotina 3 giorni e ripeti TSH ed FT4 prima di qualsiasi conclusione." })
  }
  const crp = lab(labs, "crp")
  if (crp && crp.latest.flag === "high") {
    add({ id: "crp", category: "labs", priority: "low", title: `PCR elevata (${formatNumber(crp.latest.value, 1)} mg/L)`, why: "Indica infiammazione: può dipendere da un'infezione in corso o da un allenamento molto intenso.", action: "Ripetila quando stai bene e a riposo da 48 ore; se resta alta parlane con il medico." })
  }
  const hb = lab(labs, "hemoglobin")
  if (hb && hb.latest.flag === "low") {
    add({ id: "hb", category: "labs", priority: "high", title: `Emoglobina bassa (${n1(hb.latest.value)} g/dL)`, why: "Riduce l'ossigeno disponibile per i muscoli: affaticamento e calo di prestazione.", action: "Va indagata con il medico (ferro, B12, folati)." })
  }
  if (labs && labs.latestDate) {
    const age = daysBetween(labs.latestDate, today)
    if (age > 365) add({ id: "labs-due", category: "checkups", priority: "medium", title: `Ultime analisi ${Math.round(age / 30)} mesi fa`, why: "Per chi si allena e usa integratori è utile un controllo annuale.", action: `Pannello consigliato: emocromo, glicemia, profilo lipidico, ALT/AST/GGT, creatinina con eGFR, ferritina, vitamina D, TSH${biotin ? ". Sospendi la biotina 3 giorni prima" : ""}.`, link: { href: "/bridge?tab=labs", label: "Importa analisi" } })
  } else if (bio?.latest) {
    add({ id: "labs-none", category: "checkups", priority: "low", title: "Nessuna analisi del sangue registrata", why: "I consigli su ferro, vitamina D, colesterolo e integratori diventano molto più precisi con le analisi.", action: "Importa l'ultimo referto con l'AI Bridge.", link: { href: "/bridge?tab=labs", label: "Importa analisi" } })
  }

  /* ============================== INTEGRATORI ============================== */
  for (const t of supTotals) {
    if (t.status === "over") {
      add({ id: `ul-${t.def.code}`, category: "supplements", priority: "high", title: `${t.def.name} oltre il limite di sicurezza`, why: `${formatNumber(t.compare, t.def.unit === "g" ? 1 : 0)} ${t.def.unit} contro un massimo di ${formatNumber(t.def.ul, 0)} ${t.def.unit}. Da: ${t.sources.map((s) => s.supplementName).join(", ")}.`, action: "Riduci la dose o elimina il prodotto ridondante.", link: { href: "/supplements", label: "Integratori" } })
    }
  }
  const caffeine = supTotals.find((t) => t.def.code === "caffeine")
  if (caffeine && caffeine.perDay >= 200) {
    add({ id: "caffeine", category: "supplements", priority: "low", title: `${n0(caffeine.perDay)} mg di caffeina dagli integratori`, why: "Il limite di 400 mg al giorno include caffè, tè ed energy drink.", action: `Con questa dose restano circa ${Math.max(0, Math.floor((400 - caffeine.perDay) / 70))} caffè al giorno; nessuna caffeina nelle 6 ore prima di dormire.` })
  }
  const wantsMuscle = forecasts.some((f) => f.key === "ffm") || (recomp && ["lean_gain", "lean_bulk", "recomp"].includes(recomp.type)) || isNum(profile?.target_ffm_kg)
  if (wantsMuscle && creatineSup.length === 0 && (active.length > 0 || (input.training?.logged.sessionsPerWeek ?? 0) >= 2)) {
    add({ id: "creatine-suggest", category: "supplements", priority: "low", title: "Creatina: l'integratore con più evidenze per la massa magra", why: "Hai un obiettivo di massa magra e non risulta tra i tuoi integratori.", action: "Creatina monoidrato 3–5 g al giorno, tutti i giorni, in qualsiasi momento. Valutala con il nutrizionista; ricorda che alza la creatinina nelle analisi." })
  }
  if (active.length > 0 && active.every((s) => s.ingredients.length === 0)) {
    add({ id: "sup-no-ingredients", category: "supplements", priority: "low", title: "Composizione degli integratori mancante", why: "Senza ingredienti non è possibile controllare dosi e interazioni.", action: "Importa le etichette con l'AI Bridge o aggiungi gli ingredienti a mano.", link: { href: "/bridge?tab=supplements", label: "Importa" } })
  }

  /* ============================ CUORE E REFERTI ============================ */
  if (medical) {
    for (const i of medical.insights) {
      if (i.kind === "strength" || i.kind === "info") continue
      if (i.id.startsWith("due-")) continue
      add({
        id: `med-${i.id}`,
        category: "heart",
        priority: i.kind === "alert" ? "high" : "medium",
        title: i.title,
        why: i.detail,
        action: i.id === "bp"
          ? `Sale sotto 5 g al giorno (attenzione a salumi, formaggi stagionati, pane e piatti pronti), più verdura, frutta e legumi per il potassio, 150 minuti di attività aerobica a settimana${caffeine && caffeine.perDay >= 200 ? ", riduci gli stimolanti pre-allenamento" : ""}. Misura la pressione a casa per una settimana.`
          : i.id === "qtc-long"
            ? `Mostra l'ECG al cardiologo${caffeine ? ", evita stimolanti ed energy drink" : ""} e fai controllare potassio e magnesio.`
            : "Rileggi il referto con il medico e segui le indicazioni riportate.",
        link: { href: "/reports", label: "Referti" },
      })
    }
    for (const u of medical.upcoming) {
      if (u.status === "overdue" || u.status === "soon") {
        add({ id: `due-${u.kind}`, category: "checkups", priority: u.status === "overdue" ? "medium" : "low", title: u.status === "overdue" ? `${u.label}: controllo scaduto` : `${u.label} tra ${u.daysLeft} giorni`, why: `Ultimo il ${formatDate(u.lastDate, "medium")}; scadenza ${formatDate(u.dueDate, "medium")}${u.fromReport ? " (indicata dal medico)" : ""}.`, action: "Prenota il controllo e, dopo la visita, importa il referto con l'AI Bridge.", link: { href: "/reports", label: "Referti" } })
      }
    }
    const sys = medical.series.find((s) => s.code === "systolic")
    if (sys && sys.points.length >= 2) {
      const first = sys.points[0]
      const last = sys.points[sys.points.length - 1]
      if (first && last && last.value - first.value >= 10) {
        add({ id: "bp-trend", category: "heart", priority: "medium", title: `Pressione sistolica in aumento (${formatSigned(last.value - first.value, 0)} mmHg)`, why: `Dal ${formatDate(first.date, "medium")} al ${formatDate(last.date, "medium")}.`, action: "Controlla sale, alcol, peso e stimolanti; misurala a casa regolarmente." })
      }
    }
  }

  /* =============================== ALLENAMENTO =============================== */
  const tr = input.training
  if (tr?.hasData) {
    const ffmTrend = forecasts.find((f) => f.key === "ffm")
    for (const w of tr.physique.weaknesses.slice(0, 3)) {
      const add1 = w.exercises.find((e) => !e.inPlan)
      const inPlan = w.exercises.filter((e) => e.inPlan)
      add({
        id: `tr-weak-${w.muscle}`,
        category: "training",
        priority: w.score >= 3 ? "medium" : "low",
        title: `${w.label}: punto da potenziare`,
        why: w.reasons.join("; ") + ".",
        action: `Porta i ${w.label.toLowerCase()} a circa ${w.targetSets} serie a settimana su 2 sedute${inPlan.length ? `: aumenta le serie di ${inPlan.map((e) => e.name).join(", ")}` : ""}${add1 ? `${inPlan.length ? " e aggiungi" : ": aggiungi"} ${add1.name}` : ""}.`,
        link: { href: "/training", label: "Allenamento" },
      })
    }
    for (const b of tr.physique.balance.filter((x) => x.tone === "warn").slice(0, 3)) {
      add({ id: `tr-bal-${b.key}`, category: "training", priority: b.key === "push-pull" || b.key === "hinge" ? "medium" : "low", title: b.title, why: "Dalla distribuzione delle serie nella scheda / nelle sessioni.", action: b.detail, link: { href: "/training", label: "Allenamento" } })
    }
    for (const a of tr.physique.asymmetries.filter((x) => x.relevant)) {
      add({ id: `tr-asym-${a.site}`, category: "training", priority: "low", title: `${a.label}: lato ${a.weaker} più piccolo di ${formatNumber(a.diff, 1)} cm`, why: `Sinistro ${formatNumber(a.left, 1)} cm, destro ${formatNumber(a.right, 1)} cm.`, action: "Usa manubri ed esercizi monolaterali, inizia dal lato debole e fermati alle sue ripetizioni." })
    }
    if (tr.adherence !== null && tr.adherence < 70 && tr.logged.sessions > 0) {
      add({ id: "tr-adherence", category: "training", priority: "medium", title: `Allenamenti svolti al ${tr.adherence}%`, why: `${formatNumber(tr.logged.sessionsPerWeek, 1)} sessioni a settimana contro ${tr.plan?.sessionsPerWeek ?? "?"} previste nelle ultime 4 settimane.`, action: "Se la scheda è troppo impegnativa per la tua settimana, meglio una versione da un giorno in meno che saltare sedute: la costanza vale più del volume." })
    }
    const stalled = tr.progress.filter((p) => p.status === "stall" && p.sessions >= 4)
    const regress = tr.progress.filter((p) => p.status === "regress" && p.sessions >= 4)
    if (regress.length >= 2 || (stalled.length >= 3 && isNum(tr.logged.avgRpe) && tr.logged.avgRpe >= 8.5)) {
      add({
        id: "tr-deload",
        category: "training",
        priority: "medium",
        title: regress.length >= 2 ? "Carichi in calo: segnali di affaticamento" : "Più esercizi fermi con sessioni molto dure",
        why: `${[...regress, ...stalled].slice(0, 4).map((p) => p.name).join(", ")}${balance?.status === "deficit_aggressive" ? `; il piano alimentare è in deficit marcato (${formatSigned(balance.pct, 0)}%)` : ""}.`,
        action: `Fai una settimana di scarico (metà delle serie, stessi carichi), dormi 7–9 ore${balance && (balance.status === "deficit" || balance.status === "deficit_aggressive") ? " e valuta con il nutrizionista di ridurre il deficit" : ""}, poi riprendi con +2,5% sui carichi.`,
      })
    } else if (stalled.length > 0) {
      add({ id: "tr-stall", category: "training", priority: "low", title: `${stalled.length === 1 ? stalled[0]?.name : `${stalled.length} esercizi`} senza progressi da oltre 5 settimane`, why: stalled.map((p) => `${p.name} (record ${formatNumber(p.best.value, 1)} ${p.kind === "load" ? "kg stimati" : "rip."})`).join(", ") + ".", action: "Doppia progressione: resta sul carico finché non chiudi tutte le serie al massimo delle ripetizioni, poi aumenta del 2,5–5%. In alternativa cambia variante dell'esercizio." })
    }
    if (tr.prs.length > 0) {
      add({ id: "tr-prs", category: "training", priority: "low", positive: true, title: `${tr.prs.length} ${tr.prs.length === 1 ? "record" : "record personali"} nell'ultimo mese`, why: tr.prs.slice(0, 4).map((p) => p.name).join(", ") + ".", action: "La programmazione funziona: mantieni la progressione graduale dei carichi." })
    }
    // Allenamento ↔ composizione corporea ↔ dieta
    const weeklySets = tr.plan ? tr.plan.totalSets : Object.values(tr.logged.perMuscle).reduce((a, b) => a + b, 0)
    if (ffmTrend && ffmTrend.perMonth < 0.1 && weeklySets >= 60 && food && isNum(food.avgProtein) && isNum(weight) && (food.avgProtein + supProtein) / weight < 1.6) {
      add({ id: "tr-ffm-protein", category: "training", priority: "medium", title: "Ti alleni tanto ma la massa magra non sale", why: `Circa ${n0(weeklySets)} serie a settimana, massa magra ${formatSigned(ffmTrend.perMonth, 1)} kg/mese e proteine sotto 1,6 g/kg.`, action: "Il volume c'è: il collo di bottiglia è il recupero. Porta le proteine a 1,8–2,0 g/kg e verifica di non essere in deficit." })
    } else if (ffmTrend && ffmTrend.perMonth < 0.1 && weeklySets > 0 && weeklySets < 40 && (wantsMuscleGoal(profile, forecasts))) {
      add({ id: "tr-ffm-volume", category: "training", priority: "medium", title: "Volume basso per far crescere la massa magra", why: `Circa ${n0(weeklySets)} serie a settimana in totale e massa magra stabile (${formatSigned(ffmTrend.perMonth, 1)} kg/mese).`, action: "Aumenta gradualmente fino a 10–15 serie settimanali per i gruppi principali, aggiungendo 1–2 serie a settimana." })
    }
    const cardio = Math.max(tr.logged.cardioMinPerWeek, tr.plan?.cardioMin ?? 0)
    const fatUp = recomp && ["fat_gain", "dirty_bulk", "worsening"].includes(recomp.type)
    const bpHigh = medical?.insights.some((i) => i.id === "bp" && i.kind !== "strength")
    if (cardio < 90 && (fatUp || bpHigh || (ldl && ldl.latest.flag === "high"))) {
      add({ id: "tr-cardio", category: "training", priority: "medium", title: `Cardio: ${n0(cardio)} minuti a settimana`, why: [fatUp ? "aumento di grasso nell'ultimo periodo" : null, bpHigh ? "pressione sopra l'ottimale" : null, ldl?.latest.flag === "high" ? "LDL alto" : null].filter(Boolean).join(", ") + ".", action: "Aggiungi 150 minuti a settimana di attività moderata (camminata veloce, bici) o 2 sedute da 25 minuti dopo i pesi: non compromette la crescita muscolare." })
    }
    // livello di attività del profilo coerente con gli allenamenti reali → TDEE corretto
    if (profile && tr.logged.sessions >= 4) {
      const spw = tr.logged.sessionsPerWeek
      const real = spw < 0.75 ? "sedentary" : spw < 2.75 ? "light" : spw < 5.25 ? "moderate" : "active"
      const order = ["sedentary", "light", "moderate", "active", "very_active"]
      const diff = order.indexOf(real) - order.indexOf(profile.activity_level)
      // sottostimato di un livello, o sovrastimato di due (il profilo include anche il lavoro)
      if (diff >= 1 || diff <= -2) {
        add({ id: "tr-activity", category: "training", priority: "low", title: `Livello di attività da aggiornare: “${ACTIVITY_LEVELS[real as keyof typeof ACTIVITY_LEVELS].label}”`, why: `Nelle ultime 4 settimane ${formatNumber(spw, 1)} allenamenti a settimana, mentre nel profilo è indicato “${ACTIVITY_LEVELS[profile.activity_level].label}”.`, action: "Aggiornalo in Impostazioni: il fabbisogno calorico stimato (TDEE) e quindi il bilancio della dieta diventano più precisi.", link: { href: "/settings", label: "Profilo" } })
      }
    }
  } else if (bio?.latest) {
    add({ id: "tr-none", category: "training", priority: "low", title: "Allenamento non ancora collegato", why: "Senza scheda e sessioni non è possibile capire quali distretti sono indietro.", action: "Importa la scheda e il diario con l'AI Bridge: l'app incrocia volume per muscolo e circonferenze.", link: { href: "/bridge?tab=training", label: "Importa scheda" } })
  }

  /* ================================ CONTROLLI ================================ */
  if (bio && isNum(bio.daysSinceLatest) && bio.daysSinceLatest > 45) {
    add({ id: "checkup-due", category: "checkups", priority: bio.daysSinceLatest > 90 ? "medium" : "low", title: `Ultima visita ${bio.daysSinceLatest} giorni fa`, why: "Con controlli ogni 3–6 settimane i trend e le previsioni restano affidabili.", action: "Programma la prossima misurazione BIA, nelle stesse condizioni delle precedenti.", link: { href: "/checkups?new=1", label: "Nuova visita" } })
  }

  // dedup per id (la prima occorrenza vince) e ordinamento
  const seen = new Set<string>()
  return out
    .filter((a) => (seen.has(a.id) ? false : (seen.add(a.id), true)))
    .sort((a, b) => Number(Boolean(a.positive)) - Number(Boolean(b.positive)) || PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority])
}

/* ------------------------------ Punteggio salute ------------------------------ */

export interface HealthScore {
  score: number | null
  parts: Array<{ key: string; label: string; score: number; weight: number; detail: string }>
}

/**
 * Indice sintetico 0–100 (solo orientativo): media pesata dei domini disponibili.
 * I domini senza dati non penalizzano.
 */
export function healthScore(input: AdviceInput): HealthScore {
  const parts: HealthScore["parts"] = []
  const { bio, labs, food, medical, profile } = input

  if (bio?.latestBia && isNum(bio.latestBia.fat_mass_pct)) {
    const b = bodyFatBand(bio.latestBia.fat_mass_pct, profile?.sex ?? null, bio.age)
    let s = b.band === "optimal" ? 90 : b.band === "elevated" ? 65 : b.band === "low" ? 60 : 35
    if (bio.latest && isNum(bio.latest.waist_to_height)) s = (s + (bio.latest.waist_to_height < 0.5 ? 95 : bio.latest.waist_to_height < 0.6 ? 60 : 30)) / 2
    parts.push({ key: "body", label: "Composizione", score: Math.round(s), weight: 3, detail: `${b.label}${isNum(bio.latest?.waist_to_height) ? `, vita/altezza ${formatNumber(bio.latest?.waist_to_height, 2)}` : ""}` })
  }
  if (labs && labs.series.length > 0) {
    const latest = labs.series.filter((s) => s.latest.date === labs.latestDate && s.latest.flag !== "unknown")
    if (latest.length > 0) {
      const ok = latest.filter((s) => s.latest.flag === "normal").length
      parts.push({ key: "labs", label: "Analisi", score: Math.round((ok / latest.length) * 100), weight: 3, detail: `${ok}/${latest.length} esami nel range` })
    }
  }
  if (food && food.daysInPlan > 0) {
    let s = 50
    const w = food.weekly
    if (w.vegetables >= 14) s += 12
    else if (w.vegetables >= 7) s += 6
    if (w.fruit >= 14) s += 8
    if (w.legumes >= 3) s += 8
    if (w.fish + w.oily_fish >= 2) s += 8
    if (isNum(food.avgFiber) && food.avgFiber >= 25) s += 8
    if (w.processed_meat > 1) s -= 8
    if (w.red_meat > 3) s -= 6
    if (w.alcohol > 0) s -= 6
    parts.push({ key: "food", label: "Alimentazione", score: Math.max(0, Math.min(100, Math.round(s))), weight: 2, detail: `${formatNumber(w.vegetables, 0)} porzioni di verdura, ${formatNumber(w.fish + w.oily_fish, 0)} di pesce a settimana` })
  }
  if (medical && medical.latestByKind.size > 0) {
    const rs = [...medical.latestByKind.values()]
    const s = rs.reduce((a, r) => a + (r.outcome === "normal" ? 100 : r.outcome === "borderline" ? 60 : r.outcome === "abnormal" ? 20 : 75), 0) / rs.length
    parts.push({ key: "heart", label: "Referti", score: Math.round(s), weight: 2, detail: `${rs.filter((r) => r.outcome === "normal").length}/${rs.length} referti nella norma` })
  }
  const tr = input.training
  if (tr?.hasData && (tr.adherence !== null || tr.logged.sessions > 0)) {
    const adh = tr.adherence ?? Math.min(100, Math.round((tr.logged.sessionsPerWeek / 3) * 100))
    const balancePenalty = tr.physique.balance.filter((b) => b.tone === "warn").length * 6
    const s = Math.max(0, Math.min(100, Math.round(adh * 0.7 + 30 - balancePenalty)))
    parts.push({ key: "training", label: "Allenamento", score: s, weight: 2, detail: `${formatNumber(tr.logged.sessionsPerWeek, 1)} sessioni/settimana${tr.adherence !== null ? `, costanza ${tr.adherence}%` : ""}` })
  }
  if (input.quality) {
    parts.push({ key: "consistency", label: "Costanza", score: input.quality.score, weight: 1, detail: `Affidabilità dati ${input.quality.label.toLowerCase()}` })
  }
  const tw = parts.reduce((a, p) => a + p.weight, 0)
  return { score: tw > 0 ? Math.round(parts.reduce((a, p) => a + p.score * p.weight, 0) / tw) : null, parts }
}
