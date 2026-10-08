"use client"

import * as DialogPrimitive from "@radix-ui/react-dialog"
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronLeft,
  ChevronRight,
  CloudOff,
  Copy,
  History,
  Flame,
  Info,
  LoaderCircle,
  Minus,
  Pause,
  Pencil,
  Plus,
  Repeat2,
  RotateCcw,
  Trash2,
  Trophy,
  X,
} from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"

import { MuscleFigure } from "@/components/body/muscle-figure"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Emoji } from "@/components/shared/emoji"
import { parseDecimal } from "@/features/checkups/schemas/checkup-form"
import { formatNumber, formatSigned, isNum, relativeDay, todayISO } from "@/lib/format"
import { playSound } from "@/lib/sound"
import { cn } from "@/lib/utils"

import { useSaveWorkout, useWorkoutDetail } from "../api/training"
import { e1rm, exerciseEmoji, exerciseProgress, lastPerformance, previousSet, resolveExercise, type ExerciseProgress, type LastPerformance } from "../engine/analysis"
import { MUSCLES, type Muscle } from "../engine/catalog"
import { exerciseCues } from "../engine/exercise-info"
import { BARBELL_EXERCISES, planSets, platesPerSide, suggestLoad, TECHNIQUES, warmupSets, type Suggestion } from "../engine/techniques"
import { isNetworkError, newId, queueWorkout, readDraftRaw, writeDraftRaw } from "../session/storage"
import { useRestNotifications } from "../session/rest-push"
import { useWorkoutSession } from "../session/workout-session"
import type { CompactSet, SetType, Technique, TrainingDay, TrainingExercise, Workout, WorkoutPayload, WorkoutSummary } from "../types"
import { ExercisePicker, type PickedExercise } from "./exercise-picker"
import { Elapsed, RestTimer, useWakeLock, type RestState } from "./player-timers"

/* --------------------------------- Stato --------------------------------- */

interface PSet {
  label: string
  target: string
  reps: string
  weight: string
  rpe: string
  done: boolean
  type: SetType
  rest: number
}

interface PExercise {
  key: string
  code: string
  name: string
  primary: Muscle | null
  secondary: Muscle[]
  cardio: boolean
  strength: boolean
  technique: Technique
  notes: string | null
  superset: number | null
  rest: number
  repsMin: number | null
  repsMax: number | null
  sets: PSet[]
  minutes: string
  suggestion: Suggestion | null
  last: LastPerformance | null
}

interface Draft {
  version: 3
  /** sessione salvata in modifica (null = nuova) */
  id: string | null
  /** id generato sul telefono per le nuove sessioni: invio idempotente anche offline */
  clientId: string
  rest: RestState | null
  date: string
  title: string
  planDayId: string | null
  startedAt: number
  notes: string
  sessionRpe: string
  duration: string
  current: number
  exercises: PExercise[]
  /** colonna RPE visibile (facoltativa per lasciare spazio a "Precedente") */
  showRpe?: boolean
}

const SET_BADGE: Partial<Record<number, string>> = { 1: "R", 2: "D", 3: "RP", 4: "F" }
/** numero progressivo tra le serie allenanti */
const workingIndex = (sets: Array<{ type: SetType }>, i: number) => sets.slice(0, i + 1).filter((x) => x.type === 0).length
const fmtKg = (v: number) => formatNumber(v, v % 1 ? (v * 10) % 1 ? 2 : 1 : 0)
/** "80 × 8" (o solo ripetizioni a corpo libero) */
const fmtSet = (s: CompactSet) => (s[1] ? `${fmtKg(s[1])} × ${s[0]}` : `${s[0]} rip.`)
const num = (v: number | null | undefined) => (isNum(v) ? String(v).replace(".", ",") : "")
let seq = 0
const newKey = () => `k${Date.now().toString(36)}${(seq++).toString(36)}`

/** Bozza salvata (nuova sessione o modifica di una salvata). */
function readDraft(userId: string, edit = false): Draft | null {
  const d = readDraftRaw(userId, edit) as (Partial<Omit<Draft, "version">> & { version?: number }) | null
  if (!d || (d.version !== 2 && d.version !== 3) || !Array.isArray(d.exercises)) return null
  return { ...(d as Draft), version: 3, clientId: d.clientId ?? newId(), rest: d.rest && d.rest.until > Date.now() ? d.rest : null }
}

interface Ctx {
  recent: Workout[]
  summaries: WorkoutSummary[]
  date: string
}

function fromPlan(e: TrainingExercise, ctx: Ctx): PExercise {
  const r = resolveExercise(e.exercise_code, e.name, e)
  const last = lastPerformance(r.code, ctx.recent, ctx.summaries, ctx.date)
  const suggestion = r.pattern === "cardio" ? null : suggestLoad(last?.sets ?? null, { reps_min: e.reps_min, reps_max: e.reps_max, load_kg: e.load_kg }, { strength: r.strength })
  const planned = r.pattern === "cardio" ? [] : planSets(e, suggestion?.weight ?? null, r.strength)
  return {
    key: newKey(),
    code: r.code,
    name: e.name,
    primary: r.primary,
    secondary: r.secondary,
    cardio: r.pattern === "cardio",
    strength: r.strength,
    technique: e.technique,
    notes: e.notes,
    superset: e.superset_group,
    rest: e.rest_seconds ?? (r.strength ? 150 : 90),
    repsMin: e.reps_min,
    repsMax: e.reps_max,
    sets: planned.map((p) => ({ label: p.label, target: p.target, reps: "", weight: num(p.weight), rpe: "", done: false, type: p.type, rest: p.rest })),
    minutes: r.pattern === "cardio" ? num(e.duration_min) : "",
    suggestion,
    last,
  }
}

function fromPicked(p: PickedExercise, ctx: Ctx): PExercise {
  const r = resolveExercise(p.code, p.name, { muscle_primary: p.primary, muscles_secondary: p.secondary, pattern: p.pattern })
  const last = lastPerformance(r.code, ctx.recent, ctx.summaries, ctx.date)
  const suggestion = p.pattern === "cardio" ? null : suggestLoad(last?.sets ?? null, { reps_min: null, reps_max: null }, { strength: r.strength })
  const count = Math.max(last?.sets.length ?? 3, 1)
  return {
    key: newKey(),
    code: p.code,
    name: p.name,
    primary: p.primary,
    secondary: p.secondary,
    cardio: p.pattern === "cardio",
    strength: r.strength,
    technique: "straight",
    notes: null,
    superset: null,
    rest: r.strength ? 150 : 90,
    repsMin: null,
    repsMax: null,
    sets: p.pattern === "cardio" ? [] : Array.from({ length: count }, (_, i) => ({ label: `Serie ${i + 1}`, target: last?.sets[i]?.[0] ? String(last.sets[i]?.[0]) : "", reps: "", weight: num(suggestion?.weight ?? last?.sets[i]?.[1] ?? null), rpe: "", done: false, type: 0 as SetType, rest: r.strength ? 150 : 90 })),
    minutes: "",
    suggestion,
    last,
  }
}

function fromWorkout(w: Workout, ctx: Ctx): PExercise[] {
  return w.exercises.map((e) => {
    const r = resolveExercise(e.c, e.n)
    return {
      key: newKey(),
      code: e.c,
      name: e.n,
      primary: r.primary,
      secondary: r.secondary,
      cardio: r.pattern === "cardio",
      strength: r.strength,
      technique: "straight" as Technique,
      notes: null,
      superset: null,
      rest: r.strength ? 150 : 90,
      repsMin: null,
      repsMax: null,
      sets: (e.s ?? []).map((s, i) => ({ label: s[3] === 1 ? "Riscaldamento" : s[3] === 2 ? "Drop" : s[3] === 3 ? "Rest-pause" : `Serie ${i + 1}`, target: "", reps: num(s[0]), weight: num(s[1]), rpe: num(s[2]), done: true, type: s[3], rest: 90 })),
      minutes: num(e.m ?? null),
      suggestion: null,
      last: lastPerformance(r.code, ctx.recent.filter((x) => x.id !== w.id), ctx.summaries.filter((x) => x.id !== w.id), w.workout_date),
    }
  })
}

/** "Ripeti sessione": stessi esercizi e serie, carichi di partenza = quelli dell'ultima volta. */
function repeatWorkout(w: Workout, ctx: Ctx): PExercise[] {
  return w.exercises.map((e) => {
    const r = resolveExercise(e.c, e.n)
    const last = lastPerformance(r.code, ctx.recent, ctx.summaries, ctx.date)
    const suggestion = r.pattern === "cardio" ? null : suggestLoad(e.s ?? null, { reps_min: null, reps_max: null }, { strength: r.strength })
    const rest = r.strength ? 150 : 90
    let n = 0
    return {
      key: newKey(),
      code: e.c,
      name: e.n,
      primary: r.primary,
      secondary: r.secondary,
      cardio: r.pattern === "cardio",
      strength: r.strength,
      technique: "straight" as Technique,
      notes: null,
      superset: null,
      rest,
      repsMin: null,
      repsMax: null,
      sets: (e.s ?? []).map((s) => ({
        label: s[3] === 1 ? "Riscaldamento" : s[3] === 2 ? "Drop" : s[3] === 3 ? "Rest-pause" : `Serie ${++n}`,
        target: String(s[0]),
        reps: "",
        weight: num(s[1]),
        rpe: "",
        done: false,
        type: s[3],
        rest: s[3] === 2 || s[3] === 3 ? 15 : s[3] === 1 ? 60 : rest,
      })),
      minutes: num(e.m ?? null),
      suggestion,
      last,
    }
  })
}

const TYPE_NAME: Record<SetType, "normal" | "warmup" | "drop" | "rest_pause" | "failure"> = { 0: "normal", 1: "warmup", 2: "drop", 3: "rest_pause", 4: "failure" }

/* ------------------------------- Componente ------------------------------- */

interface Result {
  minutes: number | null
  sets: number
  volume: number
  prs: string[]
  changes: Array<{ name: string; pct: number }>
  /** salvata sul telefono, in attesa di rete */
  queued: boolean
  /** id della sessione salvata (per riaprirla in modifica) */
  id: string
}

export function WorkoutPlayer({
  userId,
  open,
  onOpenChange,
  ready = true,
  day,
  editId,
  repeatId = null,
  recent,
  summaries,
}: {
  userId: string
  open: boolean
  onOpenChange: (o: boolean) => void
  /** false finché i dati per costruire la sessione (es. scheda di oggi) non sono pronti */
  ready?: boolean
  day: TrainingDay | null
  editId: string | null
  repeatId?: string | null
  recent: Workout[]
  summaries: WorkoutSummary[]
}) {
  const save = useSaveWorkout()
  const detailQ = useWorkoutDetail(open ? (editId ?? repeatId) : null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [restored, setRestored] = useState(false)
  const [saving, setSaving] = useState(false)
  /** foglio di conferma: concludere o chiudere/annullare */
  const [ask, setAsk] = useState<"finish" | "close" | null>(null)
  const rest = draft?.rest ?? null
  const setRest = useCallback((r: RestState | null) => setDraft((d) => (d ? { ...d, rest: r } : d)), [])
  const [picker, setPicker] = useState(false)
  /** esercizio da sostituire (macchina occupata): chiave nel registro */
  const [replacing, setReplacing] = useState<{ key: string; muscle: Muscle | null } | null>(null)
  const [showCues, setShowCues] = useState(false)
  const [result, setResult] = useState<Result | null>(null)

  useWakeLock(open && !result)

  // notifiche sul blocco schermo: esercizio, serie fatte e prossima serie
  const restInfo = useMemo(() => {
    if (!draft || !rest) return null
    const ex = draft.exercises[draft.current]
    if (!ex) return null
    const done = ex.sets.filter((x) => x.done).length
    const next = ex.sets.find((x) => !x.done)
    const after = draft.exercises[draft.current + 1]
    const nextTxt = next
      ? `prossima: ${next.reps || next.target || "?"} rip.${next.weight ? ` × ${next.weight} kg` : ""}`
      : after
        ? `poi: ${after.name}`
        : "ultimo esercizio"
    return `${ex.name} · ${done}/${ex.sets.length} serie · ${nextTxt}`
  }, [draft, rest])
  useRestNotifications(userId, rest, restInfo, open && !result && !draft?.id)

  const build = useCallback((): Draft | null => {
    const date = todayISO()
    const ctx: Ctx = { recent, summaries, date }
    if (editId) {
      const w = detailQ.data
      if (!w) return null
      return { version: 3, id: w.id, clientId: w.id, rest: null, date: w.workout_date, title: w.title, planDayId: w.plan_day_id, startedAt: Date.now(), notes: w.notes ?? "", sessionRpe: num(w.session_rpe), duration: num(w.duration_min), current: 0, exercises: fromWorkout(w, { ...ctx, date: w.workout_date }) }
    }
    if (repeatId) {
      const w = detailQ.data
      if (!w) return null
      return { version: 3, id: null, clientId: newId(), rest: null, date, title: w.title, planDayId: w.plan_day_id, startedAt: Date.now(), notes: "", sessionRpe: "", duration: "", current: 0, exercises: repeatWorkout(w, ctx) }
    }
    return {
      version: 3,
      id: null,
      clientId: newId(),
      rest: null,
      date,
      title: day?.label ?? "Sessione libera",
      planDayId: day?.id ?? null,
      startedAt: Date.now(),
      notes: "",
      sessionRpe: "",
      duration: "",
      current: 0,
      exercises: (day?.exercises ?? []).map((e) => fromPlan(e, ctx)),
    }
  }, [editId, repeatId, detailQ.data, day, recent, summaries])

  // apertura: bozza in corso (solo nuove sessioni) o costruzione dalla scheda
  useEffect(() => {
    if (!open) {
      setResult(null)
      setDraft(null)
      return
    }
    if (draft && (draft.id === editId || (!editId && !draft.id))) return
    const saved = readDraft(userId, Boolean(editId))
    if (saved && (editId ? saved.id === editId : !saved.id)) {
      setDraft(saved)
      setRestored(true)
      return
    }
    if (!ready) return
    const d = build()
    if (d) {
      setDraft(d)
      setRestored(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo all'apertura / al caricamento della sessione
  }, [open, editId, repeatId, ready, detailQ.data])

  // salvataggio continuo della bozza (anche timer di recupero e posizione), modifiche comprese
  const warnedQuota = useRef(false)
  useEffect(() => {
    if (!open || !draft || result) return
    if (!writeDraftRaw(userId, draft, Boolean(draft.id)) && !warnedQuota.current) {
      warnedQuota.current = true
      toast.warning("Memoria del browser piena", { description: "La bozza non viene salvata sul dispositivo: non chiudere l'app fino alla fine." })
    }
  }, [draft, open, result, userId])

  // il risultato di un salvataggio concluso a registro chiuso non deve ricomparire
  const openRef = useRef(open)
  openRef.current = open

  const update = (fn: (d: Draft) => Draft) => setDraft((d) => (d ? fn(d) : d))
  const updateEx = (key: string, fn: (e: PExercise) => PExercise) => update((d) => ({ ...d, exercises: d.exercises.map((e) => (e.key === key ? fn(e) : e)) }))
  const updateSet = (key: string, i: number, patch: Partial<PSet>) => updateEx(key, (e) => ({ ...e, sets: e.sets.map((s, j) => (j === i ? { ...s, ...patch } : s)) }))

  const ex = draft?.exercises[draft.current] ?? null
  const totalSets = draft?.exercises.reduce((n, e) => n + e.sets.length, 0) ?? 0
  const doneSets = draft?.exercises.reduce((n, e) => n + e.sets.filter((s) => s.done).length, 0) ?? 0

  function go(i: number) {
    if (!draft) return
    update((d) => ({ ...d, current: Math.max(0, Math.min(d.exercises.length - 1, i)) }))
    setShowCues(false)
  }

  function toggleSet(e: PExercise, i: number) {
    const s = e.sets[i]
    if (!s || !draft) return
    const done = !s.done
    const firstTarget = s.target.match(/\d+/)?.[0] ?? ""
    const prev = previousSet(e.last, e.sets.map((x) => x.type), i)
    updateSet(e.key, i, {
      done,
      reps: done && !s.reps ? firstTarget || (prev?.[0] ? String(prev[0]) : "") : s.reps,
      weight: done && !s.weight && prev?.[1] ? num(prev[1]) : s.weight,
    })
    playSound(done ? "check" : "uncheck")
    if (!done) return

    // superserie: passa subito all'esercizio collegato, recupero solo a fine giro
    const idx = draft.exercises.findIndex((x) => x.key === e.key)
    if (e.superset !== null) {
      const group = draft.exercises.map((x, j) => ({ x, j })).filter(({ x }) => x.superset === e.superset)
      const pos = group.findIndex(({ j }) => j === idx)
      const nextInGroup = group[pos + 1]
      if (nextInGroup) {
        update((d) => ({ ...d, current: nextInGroup.j }))
        return
      }
      const first = group[0]
      if (first && first.j !== idx && first.x.sets.some((x) => !x.done)) update((d) => ({ ...d, current: first.j }))
    }
    const restS = s.rest ?? e.rest
    if (restS > 0) setRest({ until: Date.now() + restS * 1000, total: restS, label: e.sets.slice(i + 1).find((x) => !x.done)?.label ?? draft.exercises[idx + 1]?.name ?? "Ultima serie fatta" })
    // tutte le serie fatte → esercizio successivo
    const allDone = e.sets.every((x, j) => (j === i ? true : x.done))
    if (allDone && e.superset === null && idx < draft.exercises.length - 1) setTimeout(() => go(idx + 1), 400)
  }

  /** Sostituisce un esercizio non ancora iniziato mantenendo serie, ripetizioni e recuperi della scheda. */
  function replacePicked(p: PickedExercise, key: string) {
    const ctx: Ctx = { recent, summaries, date: draft?.date ?? todayISO() }
    update((d) => ({
      ...d,
      exercises: d.exercises.map((x) => {
        if (x.key !== key) return x
        const n = fromPicked(p, ctx)
        if (n.cardio || x.cardio) return { ...n, key: x.key }
        const sets = x.sets.map((st, i) => ({ ...st, done: false, reps: "", rpe: "", weight: n.sets[Math.min(i, n.sets.length - 1)]?.weight ?? "" }))
        return { ...n, key: x.key, sets, rest: x.rest, superset: x.superset, repsMin: x.repsMin, repsMax: x.repsMax, technique: x.technique, notes: x.notes }
      }),
    }))
    toast.success(`Sostituito con ${p.name}`)
  }

  function addPicked(p: PickedExercise) {
    const ctx: Ctx = { recent, summaries, date: draft?.date ?? todayISO() }
    update((d) => ({ ...d, exercises: [...d.exercises, fromPicked(p, ctx)], current: d.exercises.length }))
    playSound("tap")
  }

  const previousBest = useMemo(() => new Map(exerciseProgress(summaries.filter((w) => w.id !== draft?.id), todayISO()).map((p) => [p.code, p])), [summaries, draft?.id])

  /** "Fine": chiede conferma (un tocco per sbaglio non chiude la sessione); le modifiche si salvano subito */
  function requestFinish() {
    if (!draft || saving) return
    if (draft.id) void onFinish()
    else setAsk("finish")
  }

  async function onFinish() {
    if (!draft || saving) return
    // se hai spuntato le serie fatte, si salvano solo quelle (le altre erano solo precompilate)
    const ticked = draft.exercises.some((e) => e.sets.some((s) => s.done))
    const clamp = (v: number | null, max: number) => (isNum(v) && v > 0 ? Math.min(v, max) : null)
    const exercises: WorkoutPayload["exercises"] = draft.exercises
      .map((e) => ({
        code: e.code,
        name: e.name,
        sets: e.cardio
          ? isNum(parseDecimal(e.minutes)) && (parseDecimal(e.minutes) as number) > 0
            ? [{ reps: null, weight_kg: null, duration_min: parseDecimal(e.minutes) as number }]
            : []
          : e.sets
              .filter((s) => !ticked || draft.id || s.done)
              .map((s) => ({ reps: parseDecimal(s.reps), weight_kg: parseDecimal(s.weight), rpe: parseDecimal(s.rpe), type: TYPE_NAME[s.type] }))
              .filter((s) => isNum(s.reps) && s.reps > 0)
              .map((s) => ({ reps: Math.min(Math.round(s.reps as number), 999), weight_kg: clamp(s.weight_kg, 999), rpe: clamp(s.rpe, 10), type: s.type })),
      }))
      .filter((e) => e.sets.length > 0)
    if (exercises.length === 0) {
      playSound("error")
      toast.error("Nessuna serie da salvare", { description: "Inserisci le ripetizioni di almeno una serie." })
      return
    }
    const elapsed = Math.round((Date.now() - draft.startedAt) / 60_000)
    const duration = parseDecimal(draft.duration)
    const minutes = isNum(duration) && duration > 0 ? Math.min(Math.round(duration), 600) : !draft.id && elapsed >= 5 && elapsed <= 300 ? elapsed : null
    const payload: WorkoutPayload & { id: string } = {
      id: draft.id ?? draft.clientId,
      is_new: !draft.id,
      workout_date: draft.date,
      plan_day_id: draft.planDayId,
      title: draft.title.trim() || "Allenamento",
      duration_min: minutes,
      session_rpe: clamp(parseDecimal(draft.sessionRpe), 10),
      notes: draft.notes.trim() || null,
      exercises,
    }
    setSaving(true)
    let queued = false
    try {
      try {
        if (typeof navigator !== "undefined" && navigator.onLine === false) throw new Error("offline")
        await save.mutateAsync(payload)
      } catch (err) {
        // senza rete la sessione resta sul telefono e parte da sola appena torna la connessione
        if (!(isNetworkError(err) || (err instanceof Error && err.message === "offline")) || !queueWorkout(userId, payload)) throw err
        queued = true
      }
      // riepilogo: record e confronto con l'ultima volta
      const prs: string[] = []
      const changes: Result["changes"] = []
      let sets = 0
      let volume = 0
      for (const e of exercises) {
        const working = e.sets.filter((s) => s.type !== "warmup")
        sets += working.length
        volume += working.reduce((a, s) => a + (s.weight_kg ?? 0) * (s.reps ?? 0), 0)
        const code = resolveExercise(e.code, e.name).code
        const best = Math.max(0, ...working.map((s) => e1rm(s.weight_kg, s.reps) ?? 0))
        const prev = previousBest.get(code)
        if (prev?.kind === "load" && best > prev.best.value + 0.01) prs.push(e.name)
        const p = draft.exercises.find((x) => x.code === e.code)?.last
        const lastBest = p ? Math.max(0, ...p.sets.map((s) => e1rm(s[1], s[0]) ?? 0)) : 0
        if (best > 0 && lastBest > 0) changes.push({ name: e.name, pct: ((best - lastBest) / lastBest) * 100 })
      }
      writeDraftRaw(userId, null, Boolean(draft.id))
      playSound(prs.length ? "celebrate" : "success")
      if (openRef.current) setResult({ minutes, sets, volume, prs, changes, queued, id: payload.id })
      else toast.success("Allenamento salvato")
    } catch (err) {
      playSound("error")
      toast.error("Salvataggio non riuscito", { description: `${err instanceof Error ? err.message : ""} La sessione resta salvata sul telefono: riprova.`.trim() })
    } finally {
      setSaving(false)
    }
  }

  function discard() {
    if (!ready) return
    writeDraftRaw(userId, null, Boolean(editId))
    setDraft(build())
    setRestored(false)
  }

  const showRpe = Boolean(draft?.showRpe)
  const gridCols = showRpe ? "grid-cols-[28px_minmax(0,1fr)_64px_52px_44px_44px]" : "grid-cols-[28px_minmax(0,1fr)_72px_60px_44px]"
  const types = ex?.sets.map((s) => s.type) ?? []
  const activeSet = ex?.sets.findIndex((s) => !s.done) ?? -1

  /** Copia carichi e ripetizioni della volta precedente in tutte le serie non ancora fatte. */
  function copyLast(e: PExercise) {
    const t = e.sets.map((x) => x.type)
    updateEx(e.key, (x) => ({
      ...x,
      sets: x.sets.map((s, i) => {
        const p = previousSet(e.last, t, i)
        return s.done || !p ? s : { ...s, weight: isNum(p[1]) ? num(p[1]) : s.weight, reps: p[0] ? String(p[0]) : s.reps }
      }),
    }))
    playSound("tap")
  }

  const nextWeight = ex?.sets.find((s) => !s.done && s.type !== 1)?.weight
  const plates = ex && BARBELL_EXERCISES.has(ex.code) ? platesPerSide(parseDecimal(nextWeight ?? "") ?? 0) : null

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(o) => (!o && saving ? undefined : onOpenChange(o))}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm" />
        <DialogPrimitive.Content
          onInteractOutside={(e) => e.preventDefault()}
          className="fixed inset-0 z-50 flex flex-col bg-background outline-none sm:inset-4 sm:mx-auto sm:max-w-3xl sm:rounded-3xl sm:border sm:shadow-2xl"
        >
          <DialogPrimitive.Title className="sr-only">Allenamento in corso</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">Registro delle serie con timer di recupero</DialogPrimitive.Description>

          {result ? (
            <ResultScreen
              result={result}
              onClose={() => onOpenChange(false)}
              onEdit={() => {
                const id = result.id
                onOpenChange(false)
                setTimeout(() => useWorkoutSession.getState().start({ kind: "edit", id }), 80)
              }}
            />
          ) : !draft ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
              {detailQ.isError || (detailQ.fetchStatus === "paused" && !detailQ.data) ? (
                <>
                  <CloudOff className="size-8 text-muted-foreground" />
                  <p className="max-w-xs text-sm text-muted-foreground">
                    {detailQ.isError ? "Sessione non trovata: forse è stata eliminata." : "Questa sessione non è salvata sul dispositivo: serve la connessione per aprirla."}
                  </p>
                </>
              ) : (
                <LoaderCircle className="size-6 animate-spin text-muted-foreground" />
              )}
              <DialogPrimitive.Close asChild>
                <Button variant="outline" className="rounded-xl">
                  <X className="size-4" /> Chiudi
                </Button>
              </DialogPrimitive.Close>
            </div>
          ) : (
            <>
              {/* Barra superiore */}
              <header className="border-b px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] sm:pt-4">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => (saving ? undefined : draft.id ? onOpenChange(false) : setAsk("close"))}
                    disabled={saving}
                    className="grid size-10 shrink-0 place-items-center rounded-xl text-muted-foreground hover:bg-accent"
                    aria-label={draft.id ? "Chiudi la modifica (resta salvata come bozza)" : "Pausa o annulla l'allenamento"}
                  >
                    <X className="size-5" />
                  </button>
                  <div className="min-w-0 flex-1">
                    <input
                      value={draft.title}
                      onChange={(e) => update((d) => ({ ...d, title: e.target.value }))}
                      aria-label="Titolo della sessione"
                      className="w-full truncate bg-transparent text-base font-semibold outline-none"
                    />
                    <p className="text-xs text-muted-foreground">
                      {draft.id ? "Modifica" : <Elapsed since={draft.startedAt} />} · {doneSets}/{totalSets} serie
                      {restored && (
                        <button type="button" onClick={discard} className="ml-2 inline-flex items-center gap-1 text-neon">
                          <RotateCcw className="size-3" /> {draft.id ? "annulla modifiche" : "ricomincia"}
                        </button>
                      )}
                    </p>
                  </div>
                  <Button className="rounded-xl" onClick={requestFinish} disabled={saving}>
                    {saving ? <LoaderCircle className="size-4 animate-spin" /> : <Check className="size-4" />}
                    {draft.id ? "Salva" : "Fine"}
                  </Button>
                </div>
                <div className="mt-3 h-1 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-neon transition-[width] duration-500" style={{ width: `${totalSets ? (doneSets / totalSets) * 100 : 0}%` }} />
                </div>
                {/* Esercizi */}
                <div className="-mx-4 mt-3 flex gap-1.5 overflow-x-auto px-4 [scrollbar-width:none]">
                  {draft.exercises.map((e, i) => {
                    const d = e.sets.filter((s) => s.done).length
                    const complete = e.cardio ? Boolean(e.minutes) : d === e.sets.length && d > 0
                    return (
                      <button
                        key={e.key}
                        type="button"
                        onClick={() => go(i)}
                        className={cn(
                          "flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors",
                          i === draft.current ? "border-neon/50 bg-neon/10 text-neon" : complete ? "border-gain/30 text-gain" : "text-muted-foreground",
                        )}
                      >
                        {complete && <Check className="size-3" />}
                        {e.superset !== null && <span className="text-[10px] text-bia">SS{e.superset}</span>}
                        <span aria-hidden>{exerciseEmoji(e.code, e.name, { muscle_primary: e.primary, pattern: e.cardio ? "cardio" : undefined })}</span>
                        <span className="max-w-[140px] truncate">{e.name}</span>
                        {!e.cardio && e.sets.length > 0 && !complete && <span className="tabular opacity-70">{d}/{e.sets.length}</span>}
                      </button>
                    )
                  })}
                  <button type="button" onClick={() => setPicker(true)} className="flex h-8 shrink-0 items-center gap-1 rounded-full border border-dashed px-3 text-xs text-muted-foreground hover:text-foreground">
                    <Plus className="size-3" /> Esercizio
                  </button>
                </div>
              </header>

              {/* Esercizio corrente */}
              <main className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
                {!ex ? (
                  <div className="grid h-full place-items-center text-center">
                    <div>
                      <p className="text-sm text-muted-foreground">Sessione libera: aggiungi il primo esercizio.</p>
                      <Button className="mt-3 rounded-xl" onClick={() => setPicker(true)}>
                        <Plus className="size-4" /> Aggiungi esercizio
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div key={ex.key} className="animate-page-in space-y-4">
                    <div className="flex gap-4">
                      <div className="h-28 w-14 shrink-0 rounded-2xl bg-accent/30 p-1.5">
                        <MuscleFigure primary={ex.primary} secondary={ex.secondary} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h2 className="text-lg font-semibold leading-tight"><Emoji e={exerciseEmoji(ex.code, ex.name, { muscle_primary: ex.primary, pattern: ex.cardio ? "cardio" : undefined })} className="mr-1" />{ex.name}</h2>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {ex.primary ? MUSCLES[ex.primary] : ex.cardio ? "Cardio" : "Esercizio personale"}
                          {ex.secondary.length > 0 && ` · ${ex.secondary.map((m) => MUSCLES[m].toLowerCase()).join(", ")}`}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {ex.technique !== "straight" && (
                            <span className="rounded-full bg-bia/15 px-2 py-0.5 text-[11px] font-medium text-bia" title={TECHNIQUES[ex.technique].description}>
                              {TECHNIQUES[ex.technique].label}
                            </span>
                          )}
                          {ex.repsMin && <span className="rounded-full bg-accent/60 px-2 py-0.5 text-[11px]">{ex.repsMin}{ex.repsMax && ex.repsMax !== ex.repsMin ? `–${ex.repsMax}` : ""} rip.</span>}
                          {!ex.cardio && <span className="rounded-full bg-accent/60 px-2 py-0.5 text-[11px]">recupero {Math.floor(ex.rest / 60)}:{String(ex.rest % 60).padStart(2, "0")}</span>}
                          <button type="button" onClick={() => setShowCues((v) => !v)} className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] text-neon hover:bg-neon/10">
                            <Info className="size-3" /> Tecnica
                          </button>
                        </div>
                      </div>
                    </div>

                    {showCues && (
                      <ul className="animate-page-in surface-inset space-y-1 rounded-xl p-3 text-xs">
                        {exerciseCues(ex.code, resolveExercise(ex.code, ex.name).pattern).map((c) => (
                          <li key={c}>• {c}</li>
                        ))}
                        {ex.technique !== "straight" && <li className="pt-1 text-muted-foreground">{TECHNIQUES[ex.technique].description}</li>}
                        {ex.notes && <li className="pt-1 italic text-muted-foreground">{ex.notes}</li>}
                      </ul>
                    )}

                    {ex.suggestion && ex.suggestion.direction !== "new" && (
                      <div
                        className={cn(
                          "flex gap-2.5 rounded-xl p-3 text-xs ring-1 ring-inset",
                          ex.suggestion.direction === "up" ? "bg-gain/[0.07] ring-gain/25" : ex.suggestion.direction === "down" ? "bg-warn/[0.07] ring-warn/25" : "bg-neon/[0.05] ring-neon/20",
                        )}
                      >
                        {ex.suggestion.direction === "up" ? <ArrowUp className="size-4 shrink-0 text-gain" /> : ex.suggestion.direction === "down" ? <ArrowDown className="size-4 shrink-0 text-warn" /> : <Flame className="size-4 shrink-0 text-neon" />}
                        <span>{ex.suggestion.reason}</span>
                      </div>
                    )}
                    {ex.last && !ex.cardio && <LastTime last={ex.last} best={previousBest.get(ex.code) ?? null} onCopy={() => copyLast(ex)} />}

                    {ex.cardio ? (
                      <label className="flex items-center gap-3 text-sm">
                        Minuti
                        <Input inputMode="decimal" value={ex.minutes} onChange={(e) => updateEx(ex.key, (x) => ({ ...x, minutes: e.target.value }))} className="h-12 w-28 rounded-xl text-center text-lg tabular" />
                        {ex.last?.sets[0]?.[0] ? <span className="text-xs text-muted-foreground">ultima volta {ex.last.sets[0][0]} min</span> : null}
                      </label>
                    ) : (
                      <div>
                        <div className={cn("grid items-center gap-1.5 px-1 pb-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground", gridCols)}>
                          <span className="text-center">#</span>
                          <span>Precedente</span>
                          <span className="text-center">kg</span>
                          <span className="text-center">rip.</span>
                          {showRpe && <span className="text-center">RPE</span>}
                          <span className="sr-only">Fatto</span>
                        </div>
                        <div className="space-y-1.5">
                          {ex.sets.map((s, i) => {
                            const prev = previousSet(ex.last, types, i)
                            const active = i === activeSet
                            return (
                              <div
                                key={i}
                                className={cn(
                                  "grid items-center gap-1.5 rounded-xl p-1 transition-colors",
                                  gridCols,
                                  s.done ? "bg-gain/[0.08]" : active ? "bg-neon/[0.06] ring-1 ring-inset ring-neon/25" : "",
                                )}
                              >
                                <span
                                  title={s.label}
                                  className={cn(
                                    "grid size-7 place-items-center justify-self-center rounded-lg text-[11px] font-semibold tabular",
                                    s.type === 1 ? "bg-warn/15 text-warn" : s.type >= 2 && s.type <= 3 ? "bg-bia/15 text-bia" : s.type === 4 ? "bg-danger/15 text-danger" : "bg-accent/60",
                                  )}
                                >
                                  {SET_BADGE[s.type] ?? workingIndex(ex.sets, i)}
                                </span>
                                <button
                                  type="button"
                                  disabled={!prev || s.done}
                                  onClick={() => prev && updateSet(ex.key, i, { weight: isNum(prev[1]) ? num(prev[1]) : s.weight, reps: prev[0] ? String(prev[0]) : s.reps })}
                                  className="min-w-0 rounded-lg px-1 py-0.5 text-left transition-colors enabled:hover:bg-accent/60 enabled:active:bg-accent"
                                  aria-label={prev ? `Copia la serie precedente: ${fmtSet(prev)}` : "Nessun dato precedente"}
                                >
                                  <span className={cn("block truncate text-sm tabular", prev ? "text-foreground/80" : "text-muted-foreground/50")}>{prev ? fmtSet(prev) : "—"}</span>
                                  {s.target && <span className="block truncate text-[10px] text-muted-foreground">obiettivo {s.target}</span>}
                                </button>
                                <Input
                                  aria-label={`${s.label}: carico`}
                                  inputMode="decimal"
                                  placeholder={prev?.[1] ? num(prev[1]) : "0"}
                                  value={s.weight}
                                  onChange={(e) => updateSet(ex.key, i, { weight: e.target.value })}
                                  className="h-11 rounded-xl px-1 text-center text-base font-medium tabular"
                                />
                                <Input
                                  aria-label={`${s.label}: ripetizioni`}
                                  inputMode="numeric"
                                  placeholder={s.target.match(/\d+/)?.[0] ?? (prev?.[0] ? String(prev[0]) : "–")}
                                  value={s.reps}
                                  onChange={(e) => updateSet(ex.key, i, { reps: e.target.value.replace(/[^\d]/g, "") })}
                                  className="h-11 rounded-xl px-1 text-center text-base font-medium tabular"
                                />
                                {showRpe && <Input aria-label={`${s.label}: RPE`} inputMode="decimal" placeholder="–" value={s.rpe} onChange={(e) => updateSet(ex.key, i, { rpe: e.target.value })} className="h-11 rounded-xl px-1 text-center tabular" />}
                                <button
                                  type="button"
                                  aria-pressed={s.done}
                                  aria-label={`${s.label} completata`}
                                  onClick={() => toggleSet(ex, i)}
                                  className={cn("grid h-11 place-items-center rounded-xl ring-1 ring-inset transition-colors", s.done ? "bg-gain text-background ring-gain" : active ? "ring-neon/50 text-neon" : "ring-border hover:ring-neon/40")}
                                >
                                  {s.done ? <Check className="animate-pop size-5" strokeWidth={3} /> : <Check className="size-4 opacity-30" />}
                                </button>
                              </div>
                            )
                          })}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="rounded-lg text-xs"
                            onClick={() =>
                              updateEx(ex.key, (x) => {
                                const last = x.sets[x.sets.length - 1]
                                return { ...x, sets: [...x.sets, { label: `Serie ${x.sets.filter((y) => y.type === 0).length + 1}`, target: last?.target ?? "", reps: "", weight: last?.weight ?? "", rpe: "", done: false, type: 0, rest: x.rest }] }
                              })
                            }
                          >
                            <Plus className="size-3.5" /> Serie
                          </Button>
                          {ex.sets.length > 0 && (
                            <Button variant="ghost" size="sm" className="rounded-lg text-xs text-muted-foreground" onClick={() => updateEx(ex.key, (x) => ({ ...x, sets: x.sets.slice(0, -1) }))}>
                              <Minus className="size-3.5" /> Togli
                            </Button>
                          )}
                          {!ex.sets.some((s) => s.type === 1) && ex.strength && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="rounded-lg text-xs text-warn"
                              onClick={() =>
                                updateEx(ex.key, (x) => ({
                                  ...x,
                                  sets: [...warmupSets(parseDecimal(x.sets.find((y) => y.type === 0)?.weight ?? "") ?? null, true).map((w) => ({ label: w.label, target: w.target, reps: "", weight: num(w.weight), rpe: "", done: false, type: w.type, rest: w.rest })), ...x.sets],
                                }))
                              }
                            >
                              <Flame className="size-3.5" /> Riscaldamento
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-pressed={showRpe}
                            className={cn("rounded-lg text-xs", showRpe ? "text-neon" : "text-muted-foreground")}
                            onClick={() => update((d) => ({ ...d, showRpe: !d.showRpe }))}
                            title="Mostra o nascondi la colonna RPE (fatica percepita 1–10)"
                          >
                            RPE
                          </Button>
                          {!ex.sets.some((x) => x.done) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="ml-auto rounded-lg text-xs text-muted-foreground"
                              title="Macchina occupata? Scegli un esercizio per lo stesso muscolo"
                              onClick={() => {
                                setReplacing({ key: ex.key, muscle: ex.primary })
                                setPicker(true)
                              }}
                            >
                              <Repeat2 className="size-3.5" /> Cambia
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className={cn("rounded-lg text-xs text-muted-foreground", ex.sets.some((x) => x.done) && "ml-auto")}
                            onClick={() => update((d) => ({ ...d, exercises: d.exercises.filter((e) => e.key !== ex.key), current: Math.max(0, Math.min(d.current, d.exercises.length - 2)) }))}
                          >
                            <Trash2 className="size-3.5" /> Rimuovi
                          </Button>
                        </div>
                        {plates && plates.plates.length > 0 && (
                          <p className="mt-3 rounded-xl bg-accent/40 p-2.5 text-xs">
                            <span className="font-medium">Dischi per lato</span> (bilanciere 20 kg): {plates.plates.map((p) => formatNumber(p, p % 1 ? 2 : 0)).join(" + ")}
                            {plates.remainder > 0 && <span className="text-muted-foreground"> · restano {formatNumber(plates.remainder, 2)} kg</span>}
                          </p>
                        )}
                      </div>
                    )}

                    {draft.current === draft.exercises.length - 1 && (
                      <div className="grid gap-2 border-t pt-4 sm:grid-cols-[120px_120px_1fr]">
                        <label className="space-y-1 text-xs text-muted-foreground">
                          Durata (min)
                          <Input inputMode="numeric" value={draft.duration} placeholder={draft.id ? "" : "automatica"} onChange={(e) => update((d) => ({ ...d, duration: e.target.value.replace(/[^\d]/g, "") }))} className="h-10 rounded-xl tabular" />
                        </label>
                        <label className="space-y-1 text-xs text-muted-foreground">
                          Fatica (1–10)
                          <Input inputMode="decimal" value={draft.sessionRpe} onChange={(e) => update((d) => ({ ...d, sessionRpe: e.target.value }))} className="h-10 rounded-xl tabular" />
                        </label>
                        <label className="space-y-1 text-xs text-muted-foreground">
                          Note
                          <Input value={draft.notes} onChange={(e) => update((d) => ({ ...d, notes: e.target.value }))} className="h-10 rounded-xl" placeholder="Sensazioni, sonno, dolori…" />
                        </label>
                      </div>
                    )}
                  </div>
                )}
              </main>

              {/* Barra inferiore */}
              <footer className="space-y-2 border-t px-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3">
                {rest && <RestTimer rest={rest} onChange={setRest} />}
                <div className="flex gap-2">
                  <Button variant="outline" className="h-12 flex-1 rounded-xl" onClick={() => go(draft.current - 1)} disabled={draft.current === 0}>
                    <ChevronLeft className="size-4" /> Precedente
                  </Button>
                  {draft.current < draft.exercises.length - 1 ? (
                    <Button variant="outline" className="h-12 flex-1 rounded-xl" onClick={() => go(draft.current + 1)}>
                      Successivo <ChevronRight className="size-4" />
                    </Button>
                  ) : (
                    <Button className="h-12 flex-1 rounded-xl" onClick={requestFinish} disabled={saving}>
                      <Check className="size-4" /> {draft.id ? "Salva modifiche" : "Termina allenamento"}
                    </Button>
                  )}
                </div>
              </footer>
              {ask && (
                <ConfirmSheet
                  kind={ask}
                  done={doneSets}
                  total={totalSets}
                  onCancel={() => setAsk(null)}
                  onFinish={() => {
                    setAsk(null)
                    void onFinish()
                  }}
                  onPause={() => {
                    setAsk(null)
                    onOpenChange(false)
                  }}
                  onDiscard={() => {
                    setAsk(null)
                    writeDraftRaw(userId, null)
                    setRest(null)
                    onOpenChange(false)
                    toast.info("Allenamento annullato", { description: "Nessuna serie è stata salvata." })
                  }}
                />
              )}
            </>
          )}
          <ExercisePicker
            open={picker}
            onOpenChange={(o) => {
              setPicker(o)
              if (!o) setReplacing(null)
            }}
            onPick={(p) => (replacing ? replacePicked(p, replacing.key) : addPicked(p))}
            initialMuscle={replacing?.muscle ?? null}
            title={replacing ? "Sostituisci esercizio" : undefined}
          />
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

function ResultScreen({ result, onClose, onEdit }: { result: Result; onClose: () => void; onEdit: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 overflow-y-auto p-6 text-center">
      <div className="relative grid size-24 place-items-center rounded-full bg-gain/10 ring-1 ring-gain/30">
        <span className="animate-ring-burst absolute inset-0 rounded-full ring-2 ring-gain" aria-hidden />
        {result.prs.length ? <Trophy className="size-10 text-warn" /> : <Check className="size-10 text-gain" />}
      </div>
      <h2 className="text-2xl font-semibold">{result.prs.length ? "Nuovo record!" : "Allenamento salvato"}</h2>
      <dl className="grid w-full max-w-sm grid-cols-3 gap-2">
        {[
          { label: "serie", value: String(result.sets) },
          { label: "sollevate", value: result.volume > 0 ? `${formatNumber(result.volume / 1000, result.volume >= 10_000 ? 1 : 2)} t` : "—" },
          { label: "durata", value: result.minutes ? `${result.minutes}′` : "—" },
        ].map((x) => (
          <div key={x.label} className="flex flex-col-reverse rounded-2xl bg-accent/40 px-2 py-3">
            <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">{x.label}</dt>
            <dd className="font-display text-xl font-semibold tabular">{x.value}</dd>
          </div>
        ))}
      </dl>
      {result.queued && (
        <p className="flex max-w-sm items-start gap-2 rounded-xl bg-bia/10 px-4 py-2.5 text-left text-sm text-bia ring-1 ring-inset ring-bia/25">
          <CloudOff className="mt-0.5 size-4 shrink-0" />
          Sei offline: la sessione è al sicuro sul telefono e verrà sincronizzata da sola appena torna la connessione.
        </p>
      )}
      {result.prs.length > 0 && (
        <p className="rounded-xl bg-warn/10 px-4 py-2 text-sm text-warn ring-1 ring-inset ring-warn/25">
          Nuovo record: <strong>{result.prs.join(", ")}</strong>
        </p>
      )}
      {result.changes.length > 0 && (
        <ul className="w-full max-w-sm space-y-1.5 text-left text-sm">
          <li className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Rispetto all&apos;ultima volta</li>
          {result.changes.map((c) => (
            <li key={c.name} className="flex items-center justify-between gap-3 rounded-xl bg-accent/40 px-3 py-2">
              <span className="truncate">{c.name}</span>
              <span className={cn("flex items-center gap-1 tabular", c.pct > 0.5 ? "text-gain" : c.pct < -0.5 ? "text-danger" : "text-muted-foreground")}>
                {c.pct > 0.5 ? <ArrowUp className="size-3.5" /> : c.pct < -0.5 ? <ArrowDown className="size-3.5" /> : null}
                {formatSigned(c.pct, 1)}%
              </span>
            </li>
          ))}
        </ul>
      )}
      <div className="w-full max-w-sm space-y-2">
        <Button className="h-12 w-full rounded-xl" onClick={onClose}>
          Chiudi
        </Button>
        {!result.queued && (
          <Button variant="ghost" className="w-full rounded-xl text-muted-foreground" onClick={onEdit}>
            <Pencil className="size-4" /> Hai sbagliato qualcosa? Modifica la sessione
          </Button>
        )}
      </div>
    </div>
  )
}

/** Conferma in basso: concludere l'allenamento, oppure metterlo in pausa / annullarlo. */
function ConfirmSheet({
  kind,
  done,
  total,
  onCancel,
  onFinish,
  onPause,
  onDiscard,
}: {
  kind: "finish" | "close"
  done: number
  total: number
  onCancel: () => void
  onFinish: () => void
  onPause: () => void
  onDiscard: () => void
}) {
  const [discard, setDiscard] = useState(false)
  return (
    <div className="absolute inset-0 z-10 flex items-end bg-background/70 backdrop-blur-sm sm:items-center sm:justify-center" onClick={onCancel}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-sheet-title"
        onClick={(e) => e.stopPropagation()}
        className="animate-sheet-up w-full space-y-3 rounded-t-3xl border-t bg-popover p-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] shadow-2xl sm:max-w-sm sm:rounded-3xl sm:border"
      >
        {kind === "finish" ? (
          <>
            <h2 id="confirm-sheet-title" className="text-lg font-semibold">
              🏁 Concludere l&apos;allenamento?
            </h2>
            <p className="text-sm text-muted-foreground">
              Hai completato <strong className="text-foreground">{done}</strong> serie su {total}.
              {done > 0 && done < total && " Verranno salvate solo le serie spuntate."}
            </p>
            <Button className="h-12 w-full rounded-xl" onClick={onFinish}>
              <Check className="size-4" /> Salva e termina
            </Button>
            <Button variant="outline" className="h-12 w-full rounded-xl" onClick={onCancel} autoFocus>
              Continua ad allenarmi
            </Button>
          </>
        ) : (
          <>
            <h2 id="confirm-sheet-title" className="text-lg font-semibold">
              Uscire dall&apos;allenamento?
            </h2>
            <p className="text-sm text-muted-foreground">
              {done > 0 ? `Hai già ${done} serie registrate.` : "Non hai ancora registrato serie."}
            </p>
            <Button className="h-12 w-full rounded-xl" onClick={onCancel} autoFocus>
              Torna all&apos;allenamento
            </Button>
            <Button variant="outline" className="h-12 w-full rounded-xl" onClick={onPause}>
              <Pause className="size-4" /> Metti in pausa (riprendi dopo)
            </Button>
            <Button
              variant="ghost"
              className={cn("h-12 w-full rounded-xl text-danger hover:bg-danger/10 hover:text-danger", discard && "bg-danger/10")}
              onClick={() => (discard ? onDiscard() : setDiscard(true))}
            >
              <Trash2 className="size-4" /> {discard ? "Sicuro? Tocca per eliminare tutto" : "Annulla allenamento"}
            </Button>
          </>
        )}
      </div>
    </div>
  )
}


/** "Ultima volta": data, ogni serie con carico esatto e record personale; un tocco copia tutto. */
function LastTime({ last, best, onCopy }: { last: LastPerformance; best: ExerciseProgress | null; onCopy: () => void }) {
  const all = [...(last.warmups ?? []), ...last.sets]
  return (
    <div className="surface-inset rounded-xl p-3">
      <div className="flex items-center gap-2">
        <History className="size-4 shrink-0 text-neon" />
        <p className="min-w-0 flex-1 text-xs">
          <span className="font-semibold">Ultima volta</span>
          <span className="text-muted-foreground"> · {relativeDay(last.date)}</span>
          {best?.kind === "load" && isNum(best.best.best.weight) && isNum(best.best.best.reps) && (
            <span className="text-muted-foreground">
              {" "}
              · record <span className="font-medium text-warn">{fmtKg(best.best.best.weight)} × {best.best.best.reps}</span>
            </span>
          )}
        </p>
        <button type="button" onClick={onCopy} className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-neon hover:bg-neon/10">
          <Copy className="size-3.5" /> Usa questi
        </button>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {all.map((s, i) => (
          <span
            key={i}
            className={cn(
              "rounded-lg px-2 py-1 text-sm font-medium tabular ring-1 ring-inset",
              s[3] === 1 ? "text-warn/90 ring-warn/25" : s[3] === 2 || s[3] === 3 ? "text-bia ring-bia/25" : "bg-background/40 ring-border",
            )}
          >
            {fmtSet(s)}
            {isNum(s[2]) && <span className="ml-1 text-[10px] text-muted-foreground">@{formatNumber(s[2], s[2] % 1 ? 1 : 0)}</span>}
          </span>
        ))}
      </div>
    </div>
  )
}
