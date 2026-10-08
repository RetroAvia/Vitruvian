/**
 * Tecniche di allenamento, generazione delle serie previste, progressione dei
 * carichi (doppia progressione) e calcolo dei dischi per il bilanciere.
 */
import { formatNumber, isNum } from "@/lib/format"

import type { CompactSet, SchemeStep, SetType, Technique, TrainingExercise } from "../types"

export const TECHNIQUES: Record<Technique, { label: string; short: string; description: string }> = {
  straight: { label: "Serie classiche", short: "Classiche", description: "Stesso carico e stesso intervallo di ripetizioni in tutte le serie." },
  pyramid: { label: "Piramide crescente", short: "Piramide", description: "Si parte leggeri con più ripetizioni e si sale di carico scendendo di ripetizioni (es. 12-10-8-6)." },
  reverse_pyramid: { label: "Piramide inversa", short: "Piramide inv.", description: "Prima la serie più pesante a energie piene, poi −10% di carico e +2 ripetizioni a ogni serie." },
  drop_set: { label: "Drop set", short: "Drop set", description: "Nell'ultima serie, a cedimento tecnico, scali il 20% del carico e continui senza recupero (2 volte)." },
  rest_pause: { label: "Rest-pause", short: "Rest-pause", description: "Ultima serie a cedimento tecnico, 15 secondi di pausa e altre ripetizioni con lo stesso carico (2 volte)." },
  myo_reps: { label: "Myo-reps", short: "Myo-reps", description: "Una serie di attivazione da 12–15 ripetizioni, poi mini-serie da 3–5 con 15 secondi di pausa." },
  cluster: { label: "Cluster set", short: "Cluster", description: "Ogni serie è divisa in blocchi (es. 3+3+3) con 15–20 secondi di pausa: carichi più alti con buona tecnica." },
  amrap: { label: "AMRAP finale", short: "AMRAP", description: "Nell'ultima serie fai quante più ripetizioni possibili con buona tecnica: misura i progressi." },
  emom: { label: "EMOM", short: "EMOM", description: "Every Minute On the Minute: a ogni minuto esegui le ripetizioni previste e recuperi il tempo che resta." },
  tempo: { label: "Tempo controllato", short: "Tempo", description: "Cadenza prescritta (es. 3-1-1-0: 3 secondi in discesa, 1 di pausa, 1 in salita): più tensione con meno carico." },
}

export interface PlannedSet {
  label: string
  /** testo obiettivo, es. "8–10" o "AMRAP" */
  target: string
  reps: number | null
  weight: number | null
  type: SetType
  /** recupero dopo questa serie (secondi) */
  rest: number
}

/** Arrotonda a incrementi realistici: 2,5 kg con il bilanciere/macchine, 1 kg sotto i 20 kg. */
export function roundLoad(kg: number): number {
  if (kg <= 0) return 0
  return kg < 20 ? Math.round(kg) : Math.round(kg / 2.5) * 2.5
}

const kg = (x: number) => formatNumber(x, x % 1 ? 1 : 0)
const rng = (a: number | null, b: number | null) => (a && b && a !== b ? `${a}–${b}` : a ? String(a) : b ? String(b) : "")

/**
 * Serie previste per un esercizio, in base a tecnica e carico di lavoro.
 * Il carico di lavoro è quello della serie principale (suggerito dalla progressione).
 */
export function planSets(ex: Pick<TrainingExercise, "sets" | "reps_min" | "reps_max" | "rest_seconds" | "technique" | "set_scheme" | "duration_min">, work: number | null, strength = false): PlannedSet[] {
  const n = Math.max(1, ex.sets ?? 3)
  const rmin = ex.reps_min ?? ex.reps_max ?? null
  const rmax = ex.reps_max ?? ex.reps_min ?? null
  const rest = ex.rest_seconds ?? (strength ? 150 : 90)
  const w = (pct: number) => (isNum(work) ? roundLoad(work * pct) : null)
  const out: PlannedSet[] = []
  const scheme: SchemeStep[] | null = ex.set_scheme && ex.set_scheme.length ? ex.set_scheme : null

  if (scheme) {
    scheme.forEach((s, i) => out.push({ label: `Serie ${i + 1}`, target: String(s.reps), reps: s.reps, weight: w((s.load_pct ?? 100) / 100), type: 0, rest }))
    return out
  }

  switch (ex.technique) {
    case "pyramid": {
      const top = rmin ?? 6
      for (let i = 0; i < n; i++) {
        const reps = top + (n - 1 - i) * 2
        out.push({ label: `Serie ${i + 1}`, target: String(reps), reps, weight: w(0.8 + (0.2 * i) / Math.max(n - 1, 1)), type: 0, rest })
      }
      return out
    }
    case "reverse_pyramid": {
      const first = rmin ?? 6
      for (let i = 0; i < n; i++) {
        const reps = first + i * 2
        out.push({ label: `Serie ${i + 1}`, target: String(reps), reps, weight: w(1 - 0.1 * i), type: 0, rest })
      }
      return out
    }
    case "drop_set":
      for (let i = 0; i < n; i++) out.push({ label: `Serie ${i + 1}`, target: rng(rmin, rmax), reps: rmin, weight: w(1), type: 0, rest: i === n - 1 ? 0 : rest })
      out.push({ label: "Drop 1", target: "cedimento", reps: null, weight: w(0.8), type: 2, rest: 0 })
      out.push({ label: "Drop 2", target: "cedimento", reps: null, weight: w(0.64), type: 2, rest })
      return out
    case "rest_pause":
      for (let i = 0; i < n; i++) out.push({ label: `Serie ${i + 1}`, target: i === n - 1 ? "cedimento tecnico" : rng(rmin, rmax), reps: rmin, weight: w(1), type: i === n - 1 ? 4 : 0, rest: i === n - 1 ? 15 : rest })
      out.push({ label: "Pausa 1", target: "+ rip.", reps: null, weight: w(1), type: 3, rest: 15 })
      out.push({ label: "Pausa 2", target: "+ rip.", reps: null, weight: w(1), type: 3, rest })
      return out
    case "myo_reps": {
      const a = Math.max(rmax ?? 12, 12)
      out.push({ label: "Attivazione", target: rng(a, a + 3), reps: a, weight: w(1), type: 0, rest: 15 })
      for (let i = 1; i < Math.max(n, 4); i++) out.push({ label: `Mini ${i}`, target: "3–5", reps: 4, weight: w(1), type: 3, rest: i === Math.max(n, 4) - 1 ? rest : 15 })
      return out
    }
    case "amrap":
      for (let i = 0; i < n; i++) out.push({ label: i === n - 1 ? "AMRAP" : `Serie ${i + 1}`, target: i === n - 1 ? "max rip." : rng(rmin, rmax), reps: rmin, weight: w(1), type: i === n - 1 ? 4 : 0, rest })
      return out
    case "emom":
      for (let i = 0; i < n; i++) out.push({ label: `Minuto ${i + 1}`, target: rng(rmin, rmax), reps: rmin, weight: w(1), type: 0, rest: 60 })
      return out
    case "cluster": {
      const block = Math.max(2, Math.round((rmin ?? 6) / 3))
      for (let i = 0; i < n; i++) out.push({ label: `Serie ${i + 1}`, target: `${block}+${block}+${block}`, reps: block * 3, weight: w(1), type: 0, rest })
      return out
    }
    default:
      for (let i = 0; i < n; i++) out.push({ label: `Serie ${i + 1}`, target: rng(rmin, rmax), reps: rmin, weight: w(1), type: 0, rest })
      return out
  }
}

/* ------------------------------ Progressione ------------------------------ */

export interface Suggestion {
  weight: number | null
  direction: "up" | "same" | "down" | "new"
  reason: string
}

/**
 * Doppia progressione: resti sul carico finché chiudi TUTTE le serie al massimo
 * dell'intervallo di ripetizioni, poi aumenti. Se resti sotto il minimo, scali.
 */
export function suggestLoad(
  last: CompactSet[] | null,
  target: { reps_min: number | null; reps_max: number | null; load_kg?: number | null },
  opts: { strength: boolean },
): Suggestion {
  const working = (last ?? []).filter((s) => s[3] === 0 || s[3] === 4)
  const weights = working.map((s) => s[1]).filter((x): x is number => isNum(x) && x > 0)
  if (working.length === 0 || weights.length === 0) {
    return isNum(target.load_kg)
      ? { weight: target.load_kg, direction: "new", reason: "Carico indicato nella scheda." }
      : { weight: null, direction: "new", reason: "Prima volta: scegli un carico che ti lasci 2 ripetizioni di riserva." }
  }
  const work = Math.max(...weights)
  const top = working.filter((s) => s[1] === work)
  const rmax = target.reps_max ?? target.reps_min
  const rmin = target.reps_min ?? target.reps_max
  const step = work >= 40 || opts.strength ? 2.5 : work >= 8 ? 2 : 1
  if (!rmax || !rmin) {
    return { weight: work, direction: "same", reason: `Ultima volta ${kg(work)} kg × ${top.map((s) => s[0]).join("/")}: prova a fare una ripetizione in più.` }
  }
  const allTop = top.every((s) => s[0] >= rmax) && top.every((s) => !isNum(s[2]) || (s[2] as number) <= 9)
  const avg = top.reduce((a, s) => a + s[0], 0) / top.length
  if (allTop) {
    return { weight: roundLoad(work + step) || work + step, direction: "up", reason: `Hai chiuso tutte le serie a ${rmax} ripetizioni con ${kg(work)} kg: aumenta di ${kg(step)} kg.` }
  }
  if (avg < rmin - 1) {
    const down = roundLoad(work * 0.95)
    return { weight: down, direction: "down", reason: `Ultima volta in media ${formatNumber(avg, 1)} ripetizioni, sotto il minimo di ${rmin}: scala a ${kg(down)} kg e ricostruisci.` }
  }
  return { weight: work, direction: "same", reason: `Resta a ${kg(work)} kg e punta a ${rmax} ripetizioni in tutte le serie (ultima volta ${top.map((s) => s[0]).join("/")}).` }
}

/* --------------------------------- Dischi --------------------------------- */

export const BARBELL_EXERCISES = new Set([
  "bench_press",
  "incline_bench_press",
  "decline_bench_press",
  "close_grip_bench_press",
  "back_squat",
  "front_squat",
  "deadlift",
  "romanian_deadlift",
  "overhead_press",
  "barbell_row",
  "hip_thrust",
  "good_morning",
])

const PLATES = [25, 20, 15, 10, 5, 2.5, 1.25]

/** Dischi per lato (bilanciere olimpico da 20 kg). */
export function platesPerSide(total: number, bar = 20): { plates: number[]; remainder: number } | null {
  if (!isNum(total) || total < bar) return null
  let side = (total - bar) / 2
  const plates: number[] = []
  for (const p of PLATES) {
    while (side >= p - 1e-9) {
      plates.push(p)
      side -= p
    }
  }
  return { plates, remainder: Math.round(side * 2 * 100) / 100 }
}

/** Serie di riscaldamento suggerite prima della prima serie pesante. */
export function warmupSets(work: number | null, strength: boolean): PlannedSet[] {
  if (!strength || !isNum(work) || work < 40) return []
  return [
    { label: "Riscaldamento", target: "10", reps: 10, weight: roundLoad(Math.max(20, work * 0.4)), type: 1, rest: 60 },
    { label: "Riscaldamento", target: "5", reps: 5, weight: roundLoad(work * 0.6), type: 1, rest: 60 },
    { label: "Riscaldamento", target: "2", reps: 2, weight: roundLoad(work * 0.8), type: 1, rest: 90 },
  ]
}
