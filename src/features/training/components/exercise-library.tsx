"use client"

import { Search, Trophy } from "lucide-react"
import { useDeferredValue, useMemo, useState } from "react"

import { MuscleFigure } from "@/components/body/muscle-figure"
import { GlassCard } from "@/components/shared/glass-card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { formatDate, formatNumber, formatSigned, isNum } from "@/lib/format"
import { cn } from "@/lib/utils"

import { resolveExercise, type ExerciseProgress } from "../engine/analysis"
import { EXERCISES, MUSCLE_KEYS, MUSCLES, PATTERN_LABELS, type Muscle } from "../engine/catalog"
import { exerciseCues } from "../engine/exercise-info"
import type { WorkoutSummary } from "../types"

const STATUS = {
  progress: { label: "In crescita", cls: "text-gain bg-gain/10 ring-gain/25" },
  stall: { label: "Fermo", cls: "text-warn bg-warn/10 ring-warn/25" },
  regress: { label: "In calo", cls: "text-danger bg-danger/10 ring-danger/25" },
  new: { label: "Pochi dati", cls: "text-muted-foreground bg-muted ring-border" },
} as const

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")

/** Libreria esercizi: prima quelli che fai, con andamento; poi tutto il catalogo. */
export function ExerciseLibrary({ progress, workouts }: { progress: ExerciseProgress[]; workouts: WorkoutSummary[] }) {
  const [q, setQ] = useState("")
  const [muscle, setMuscle] = useState<Muscle | "all">("all")
  const [open, setOpen] = useState<string | null>(null)
  const dq = useDeferredValue(q)
  const byCode = useMemo(() => new Map(progress.map((p) => [p.code, p])), [progress])

  const list = useMemo(() => {
    const t = norm(dq.trim())
    const done = progress.map((p) => ({ code: p.code, name: p.name, def: resolveExercise(p.code, p.name) }))
    const others = EXERCISES.filter((e) => !byCode.has(e.code)).map((e) => ({ code: e.code, name: e.name, def: resolveExercise(e.code, e.name) }))
    return [...done, ...others].filter(({ name, def }) => {
      if (muscle !== "all" && def.primary !== muscle && !def.secondary.includes(muscle)) return false
      return !t || norm(name).includes(t)
    })
  }, [dq, muscle, progress, byCode])

  const selected = open ? (list.find((x) => x.code === open) ?? { code: open, name: open, def: resolveExercise(open, open) }) : null

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cerca esercizio" className="h-11 rounded-xl pl-9" aria-label="Cerca esercizio" />
        </div>
      </div>
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
        {(["all", ...MUSCLE_KEYS] as const).map((m) => (
          <button key={m} type="button" onClick={() => setMuscle(m)} aria-pressed={muscle === m} className={cn("h-8 shrink-0 rounded-full border px-3 text-xs font-medium", muscle === m ? "border-neon/40 bg-neon/10 text-neon" : "text-muted-foreground")}>
            {m === "all" ? "Tutti" : MUSCLES[m]}
          </button>
        ))}
      </div>

      <div className="cv-auto grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {list.map(({ code, name, def }) => {
          const p = byCode.get(code)
          return (
            <button key={code} type="button" onClick={() => setOpen(code)} className="glass hover-lift flex items-center gap-3 rounded-2xl p-3 text-left">
              <span className="h-16 w-8 shrink-0">
                <MuscleFigure primary={def.primary} secondary={def.secondary} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{name}</span>
                <span className="block truncate text-[11px] text-muted-foreground">
                  {def.primary ? MUSCLES[def.primary] : "Cardio"} · {PATTERN_LABELS[def.pattern]}
                </span>
                {p ? (
                  <span className="mt-1 flex items-center gap-2 text-[11px]">
                    <span className="font-semibold tabular">
                      {formatNumber(p.best.value, p.kind === "load" ? 1 : 0)} {p.kind === "load" ? "kg" : "rip."}
                    </span>
                    <span className={cn("rounded-full px-1.5 py-px ring-1 ring-inset", STATUS[p.status].cls)}>{STATUS[p.status].label}</span>
                  </span>
                ) : (
                  <span className="mt-1 block text-[11px] text-muted-foreground">Mai eseguito</span>
                )}
              </span>
            </button>
          )
        })}
      </div>

      <Dialog open={selected !== null} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
          {selected && <ExerciseDetail code={selected.code} name={selected.name} progress={byCode.get(selected.code) ?? null} workouts={workouts} />}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ExerciseDetail({ code, name, progress, workouts }: { code: string; name: string; progress: ExerciseProgress | null; workouts: WorkoutSummary[] }) {
  const def = resolveExercise(code, name)
  const history = useMemo(
    () =>
      workouts
        .flatMap((w) => w.summary.filter((s) => resolveExercise(s.c, s.n).code === code).map((s) => ({ date: w.workout_date, title: w.title, s })))
        .slice(0, 12),
    [workouts, code],
  )
  return (
    <>
      <DialogHeader>
        <DialogTitle>{name}</DialogTitle>
        <DialogDescription>
          {def.primary ? MUSCLES[def.primary] : "Cardio"}
          {def.secondary.length > 0 && ` · ${def.secondary.map((m) => MUSCLES[m].toLowerCase()).join(", ")}`} · {PATTERN_LABELS[def.pattern]}
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 sm:grid-cols-[120px_1fr]">
        <div className="flex h-44 justify-center gap-1 rounded-2xl bg-accent/30 p-2">
          <MuscleFigure primary={def.primary} secondary={def.secondary} view="front" />
          <MuscleFigure primary={def.primary} secondary={def.secondary} view="back" />
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Esecuzione</p>
          <ul className="mt-1 space-y-1 text-sm">
            {exerciseCues(def.code, def.pattern).map((c) => (
              <li key={c}>• {c}</li>
            ))}
          </ul>
        </div>
      </div>

      {progress ? (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            <Stat label={progress.kind === "load" ? "Massimale stimato" : "Ripetizioni max"} value={`${formatNumber(progress.best.value, progress.kind === "load" ? 1 : 0)}${progress.kind === "load" ? " kg" : ""}`} hint={formatDate(progress.best.date, "short")} icon />
            <Stat label="Volume record" value={`${formatNumber(progress.bestVolume.volume, 0)} kg`} hint={formatDate(progress.bestVolume.date, "short")} />
            <Stat label="Tendenza" value={isNum(progress.pctPerMonth) ? `${formatSigned(progress.pctPerMonth, 1)}%/mese` : "—"} hint={`${progress.sessions} sessioni`} tone={progress.status} />
          </div>
          <ProgressChart points={progress.points.slice(-24).map((p) => ({ date: p.date, value: p.value }))} unit={progress.kind === "load" ? "kg" : "rip."} />
        </div>
      ) : (
        <p className="surface-inset rounded-xl p-3 text-sm text-muted-foreground">Non hai ancora registrato questo esercizio.</p>
      )}

      {history.length > 0 && (
        <div>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Ultime sessioni</p>
          <ul className="divide-y text-sm">
            {history.map((h, i) => (
              <li key={`${h.date}-${i}`} className="flex items-center justify-between gap-3 py-1.5">
                <span className="text-muted-foreground">{formatDate(h.date, "medium")}</span>
                <span className="tabular">
                  {h.s.sets} serie · {h.s.top ? `top ${formatNumber(h.s.top[0], 1)}×${h.s.top[1]}` : `max ${h.s.maxr ?? "–"} rip.`}
                  {h.s.vol ? <span className="text-muted-foreground"> · {formatNumber(h.s.vol, 0)} kg</span> : null}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  )
}

function Stat({ label, value, hint, icon, tone }: { label: string; value: string; hint: string; icon?: boolean; tone?: ExerciseProgress["status"] }) {
  return (
    <GlassCard className="p-3">
      <p className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {icon && <Trophy className="size-3 text-warn" />}
        {label}
      </p>
      <p className={cn("mt-1 text-base font-semibold tabular", tone === "progress" ? "text-gain" : tone === "regress" ? "text-danger" : tone === "stall" ? "text-warn" : "")}>{value}</p>
      <p className="text-[10px] text-muted-foreground">{hint}</p>
    </GlassCard>
  )
}

/** Grafico SVG leggero (nessuna libreria) del massimale stimato nel tempo. */
export function ProgressChart({ points, unit }: { points: Array<{ date: string; value: number }>; unit: string }) {
  if (points.length < 2) return null
  const W = 560
  const H = 160
  const P = { l: 36, r: 12, t: 12, b: 22 }
  const vals = points.map((p) => p.value)
  const min = Math.min(...vals)
  const max = Math.max(...vals)
  const span = max - min || max * 0.1 || 1
  const lo = min - span * 0.15
  const hi = max + span * 0.15
  const x = (i: number) => P.l + (i / (points.length - 1)) * (W - P.l - P.r)
  const y = (v: number) => P.t + (1 - (v - lo) / (hi - lo)) * (H - P.t - P.b)
  const path = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ")
  const area = `${path} L${x(points.length - 1).toFixed(1)},${H - P.b} L${P.l},${H - P.b} Z`
  const bestIdx = vals.indexOf(max)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`Andamento: da ${formatNumber(vals[0], 1)} a ${formatNumber(vals[vals.length - 1], 1)} ${unit}`}>
      <defs>
        <linearGradient id="pc-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--neon)" stopOpacity="0.25" />
          <stop offset="1" stopColor="var(--neon)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[lo + (hi - lo) * 0.25, lo + (hi - lo) * 0.75].map((v) => (
        <g key={v}>
          <line x1={P.l} x2={W - P.r} y1={y(v)} y2={y(v)} stroke="var(--border)" strokeDasharray="3 4" />
          <text x={P.l - 6} y={y(v) + 3} textAnchor="end" className="fill-muted-foreground text-[10px]">
            {formatNumber(v, 0)}
          </text>
        </g>
      ))}
      <path d={area} fill="url(#pc-fill)" />
      <path d={path} fill="none" stroke="var(--neon)" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p, i) => (
        <circle key={p.date + i} cx={x(i)} cy={y(p.value)} r={i === bestIdx ? 4.5 : 2.5} fill={i === bestIdx ? "var(--warn)" : "var(--neon)"} />
      ))}
      <text x={P.l} y={H - 6} className="fill-muted-foreground text-[10px]">
        {formatDate(points[0]?.date ?? null, "monthYear")}
      </text>
      <text x={W - P.r} y={H - 6} textAnchor="end" className="fill-muted-foreground text-[10px]">
        {formatDate(points[points.length - 1]?.date ?? null, "monthYear")}
      </text>
    </svg>
  )
}
