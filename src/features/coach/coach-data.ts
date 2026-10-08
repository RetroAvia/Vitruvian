/**
 * "Fascicolo" dei dati personali per l'IA esterna: profilo, composizione,
 * circonferenze, analisi, referti, integratori, allenamento e alimentazione.
 * Testo semplice e compatto (poche migliaia di caratteri): si incolla nel prompt
 * o si scarica come file. Nessun dato identificativo oltre al nome scelto.
 */
import { ACTIVITY_LEVELS, MEAL_SLOT_LABELS, MEDICAL_KIND_LABELS, MEDICAL_OUTCOME_LABELS } from "@/config/constants"
import type { AdviceInput } from "@/features/advice/engine/advice"
import { formatMetric, HEALTH_METRICS } from "@/features/health/engine/health"
import { mealText } from "@/features/nutrition/engine/meal-text"
import { mealTotals } from "@/features/nutrition/engine/totals"
import type { DayWithMeals } from "@/features/nutrition/types"
import { setsLabel } from "@/features/training/engine/analysis"
import { MUSCLES } from "@/features/training/engine/catalog"
import { latestSites, SITE_LABELS } from "@/features/training/engine/physique"
import { formatDate, formatNumber, isNum } from "@/lib/format"

export interface SnapshotSections {
  body: boolean
  labs: boolean
  medical: boolean
  supplements: boolean
  training: boolean
  diet: boolean
}

export const SECTION_LABELS: Record<keyof SnapshotSections, string> = {
  body: "Corpo e composizione",
  labs: "Analisi del sangue",
  medical: "Referti medici",
  supplements: "Integratori",
  training: "Allenamento attuale",
  diet: "Dieta attuale",
}

const n = (v: number | null | undefined, d = 1) => (isNum(v) ? formatNumber(v, d) : "n.d.")

export function buildSnapshot(input: AdviceInput, diet: DayWithMeals[] | null, sections: SnapshotSections): string {
  const out: string[] = []
  const p = input.profile
  const bio = input.bio
  const L = bio?.latest
  const B = bio?.latestBia

  out.push("## PROFILO")
  out.push(`- Sesso: ${p?.sex === "female" ? "donna" : p?.sex === "male" ? "uomo" : "n.d."} · età: ${bio?.age ?? "n.d."} anni · altezza: ${n(p?.height_cm, 0)} cm`)
  out.push(`- Livello di attività quotidiana: ${p?.activity_level ? ACTIVITY_LEVELS[p.activity_level].label : "n.d."}`)
  if (p?.goal) out.push(`- Obiettivo dichiarato: ${p.goal}`)
  const targets = [
    isNum(p?.target_weight_kg) ? `peso ${n(p?.target_weight_kg)} kg` : null,
    isNum(p?.target_fat_pct) ? `massa grassa ${n(p?.target_fat_pct)}%` : null,
    isNum(p?.target_waist_cm) ? `vita ${n(p?.target_waist_cm)} cm` : null,
    isNum(p?.target_ffm_kg) ? `massa magra ${n(p?.target_ffm_kg)} kg` : null,
  ].filter(Boolean)
  if (targets.length) out.push(`- Obiettivi numerici: ${targets.join(", ")}${p?.target_date ? ` entro il ${formatDate(p.target_date, "long")}` : ""}`)

  if (sections.body && L) {
    out.push("", `## COMPOSIZIONE CORPOREA (ultima misura ${formatDate(L.checkup_date, "long")})`)
    out.push(`- Peso ${n(L.weight_kg)} kg · BMI ${n(L.bmi)}`)
    if (B) {
      out.push(`- Massa grassa ${n(B.fat_mass_pct)}% (${n(B.fat_mass_kg)} kg) · massa magra ${n(B.ffm_kg)} kg · FFMI ${n(B.ffmi)}`)
      out.push(`- Metabolismo basale (BIA) ${n(B.bmr_kcal, 0)} kcal · acqua ${n(B.total_body_water_pct)}% · grasso viscerale ${n(B.visceral_fat)}`)
    }
    if (bio?.energy.tdee) out.push(`- Fabbisogno stimato (TDEE) ${n(bio.energy.tdee, 0)} kcal/giorno`)
    const { values } = latestSites(bio?.chronological ?? [])
    const sites = Object.entries(values)
      .filter(([k]) => k in SITE_LABELS)
      .map(([k, v]) => `${SITE_LABELS[k]} ${n(v)} cm`)
    if (sites.length) out.push(`- Circonferenze: ${sites.join(", ")}`)
    if (isNum(L.waist_to_height)) out.push(`- Vita/altezza ${n(L.waist_to_height, 2)}`)
    // andamento: prima misura dell'ultimo anno vs ultima
    const year = (bio?.chronological ?? []).filter((c) => c.checkup_date >= `${Number(L.checkup_date.slice(0, 4)) - 1}${L.checkup_date.slice(4)}`)
    const first = year[0]
    if (first && first.id !== L.id) {
      const d = (a: number | null, b: number | null) => (isNum(a) && isNum(b) ? `${b - a >= 0 ? "+" : ""}${formatNumber(b - a, 1)}` : "n.d.")
      out.push(`- Variazione da ${formatDate(first.checkup_date, "medium")}: peso ${d(first.weight_kg, L.weight_kg)} kg, massa grassa ${d(first.fat_mass_kg, B?.fat_mass_kg ?? null)} kg, massa magra ${d(first.ffm_kg, B?.ffm_kg ?? null)} kg, vita ${d(first.waist_cm, L.waist_cm)} cm`)
    }
    for (const f of input.forecasts) {
      out.push(`- Tendenza ${f.label.toLowerCase()}: ${f.direction === "reached" ? "obiettivo raggiunto" : f.direction === "toward" ? "verso l'obiettivo" : f.direction === "away" ? "si allontana dall'obiettivo" : "stabile"} (${formatNumber(f.perMonth, 2)} ${f.unit}/mese)`)
    }
  }

  const hs = input.health
  if (sections.body && hs) {
    const parts = (["steps", "sleep_min", "resting_hr", "active_kcal", "hrv_ms"] as const)
      .filter((m) => hs[m].avg7 !== null)
      .map((m) => `${HEALTH_METRICS[m].label.toLowerCase()} ${formatMetric(m, hs[m].avg7)}`)
    if (parts.length) out.push("", "## ATTIVITÀ QUOTIDIANA (Apple Salute, media ultimi 7 giorni)", `- ${parts.join(" · ")}`)
  }

  if (sections.labs && input.labs) {
    const labs = input.labs
    const out1 = labs.series.filter((s) => s.latest.flag === "high" || s.latest.flag === "low")
    out.push("", `## ANALISI DEL SANGUE (ultimo referto ${formatDate(labs.latestDate, "long")})`)
    if (out1.length) out.push(`- Fuori range: ${out1.map((s) => `${s.name} ${n(s.latest.value, s.digits)} ${s.unit ?? ""} (${s.latest.flag === "high" ? "alto" : "basso"}, rif. ${refText(s.latest.refLow, s.latest.refHigh, s.digits)})`).join("; ")}`)
    else out.push("- Tutti i valori nella norma")
    const inRange = labs.series.filter((s) => s.latest.date === labs.latestDate && s.latest.flag !== "high" && s.latest.flag !== "low" && isNum(s.latest.value))
    if (inRange.length) out.push(`- Nella norma: ${inRange.slice(0, 40).map((s) => `${s.name} ${n(s.latest.value, s.digits)}`).join(", ")}`)
  }

  if (sections.medical && input.medical && input.medical.reports.length) {
    out.push("", "## REFERTI MEDICI")
    for (const r of input.medical.reports.slice(0, 6)) {
      out.push(`- ${formatDate(r.report_date, "medium")} · ${MEDICAL_KIND_LABELS[r.kind]}: ${MEDICAL_OUTCOME_LABELS[r.outcome].toLowerCase()}${r.conclusion ? ` — ${r.conclusion}` : ""}`)
    }
  }

  if (sections.supplements) {
    const active = input.supplements.filter((s) => s.is_active)
    if (active.length) {
      out.push("", "## INTEGRATORI IN USO")
      for (const s of active) out.push(`- ${s.name}${s.brand ? ` (${s.brand})` : ""}${s.dose_label ? ` · ${s.dose_label}` : ""}${s.purpose ? ` · per ${s.purpose}` : ""}`)
    }
  }

  const tr = input.training
  if (sections.training && tr && tr.hasData) {
    out.push("", "## ALLENAMENTO ATTUALE")
    if (tr.tree) {
      out.push(`- Scheda attiva: ${tr.tree.plan.name} (${tr.tree.days.length} giorni)`)
      for (const d of tr.tree.days) out.push(`  - ${d.label}: ${d.exercises.map((e) => `${e.name} ${setsLabel(e)}`).join("; ")}`)
    }
    if (tr.logged.sessions > 0) out.push(`- Ultime 4 settimane: ${n(tr.logged.sessionsPerWeek)} sessioni/settimana${isNum(tr.logged.avgDuration) ? `, durata media ${n(tr.logged.avgDuration, 0)} min` : ""}${isNum(tr.logged.avgRpe) ? `, fatica media RPE ${n(tr.logged.avgRpe)}` : ""}`)
    const loads = tr.progress.filter((x) => x.kind === "load" && isNum(x.last.best.weight)).slice(0, 15)
    if (loads.length) out.push(`- Carichi recenti (miglior serie): ${loads.map((x) => `${x.name} ${n(x.last.best.weight)} kg × ${x.last.best.reps}`).join("; ")}`)
    const weak = tr.physique.weaknesses.slice(0, 5)
    if (weak.length) out.push(`- Distretti da potenziare secondo l'app: ${weak.map((w) => MUSCLES[w.muscle]).join(", ")}`)
  }

  if (sections.diet && diet && diet.length) {
    out.push("", `## DIETA ATTUALE${input.planName ? ` (${input.planName})` : ""}`)
    for (const d of diet.slice(0, 7)) {
      out.push(`- ${d.label}:`)
      for (const m of d.meals) {
        const t = mealTotals(m)
        out.push(`  - ${m.label ?? MEAL_SLOT_LABELS[m.slot]} (${n(t.kcal, 0)} kcal): ${mealText(m.items)}`)
      }
    }
    if (input.mealAdherence !== null) out.push(`- Aderenza alla dieta (14 giorni): ${input.mealAdherence}%`)
  }

  return out.join("\n")
}

function refText(lo: number | null, hi: number | null, digits: number) {
  if (isNum(lo) && isNum(hi)) return `${formatNumber(lo, digits)}–${formatNumber(hi, digits)}`
  if (isNum(lo)) return `> ${formatNumber(lo, digits)}`
  if (isNum(hi)) return `< ${formatNumber(hi, digits)}`
  return "n.d."
}
