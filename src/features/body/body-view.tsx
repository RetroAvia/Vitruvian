"use client"

import { Activity, ArrowRight, Droplets, Dumbbell, FlaskConical, HeartPulse, Pill, RotateCw, ScanLine, X } from "lucide-react"
import Link from "next/link"
import { useMemo, useState } from "react"

import { BodyMap, type BodyMapMode } from "@/components/body/body-map"
import type { View } from "@/components/body/body-geometry"
import { Segmented } from "@/components/charts/chart-card"
import { EmptyState } from "@/components/shared/empty-state"
import { GlassCard } from "@/components/shared/glass-card"
import { PageHeader } from "@/components/shared/page-header"
import { ScoreRing } from "@/components/shared/score-ring"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { bodyFatBand, whtrBand } from "@/features/biometrics/engine/reference"
import { isScheduled } from "@/features/supplements/engine/analysis"
import { EXERCISES, MUSCLES, VOLUME_ZONES, type Muscle } from "@/features/training/engine/catalog"
import { formatDate, formatNumber, isNum, todayISO } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { Checkup } from "@/types/domain"

import { fmtDelta, useBodyData } from "./use-body-data"

const MODES: Array<{ value: BodyMapMode; label: string }> = [
  { value: "measures", label: "Misure" },
  { value: "training", label: "Allenamento" },
  { value: "focus", label: "Punti deboli" },
]

const LEGEND: Record<BodyMapMode, Array<{ cls: string; label: string }>> = {
  measures: [{ cls: "bg-neon", label: "Circonferenza (variazione negli ultimi mesi)" }],
  training: [
    { cls: "bg-warn", label: `< ${VOLUME_ZONES.low} serie` },
    { cls: "bg-neon", label: `${VOLUME_ZONES.low}–${VOLUME_ZONES.optimalMin}` },
    { cls: "bg-gain", label: `${VOLUME_ZONES.optimalMin}–${VOLUME_ZONES.optimalMax}` },
    { cls: "bg-danger", label: `> ${VOLUME_ZONES.high}` },
  ],
  focus: [
    { cls: "bg-warn", label: "Da potenziare" },
    { cls: "bg-gain", label: "Volume ottimale" },
  ],
}

function prevComparable(chronological: Checkup[], latest: Checkup, key: keyof Checkup, bia: boolean): number | null {
  for (let i = chronological.length - 2; i >= 0; i--) {
    const c = chronological[i] as Checkup
    if (c.id === latest.id) continue
    const v = c[key]
    if (bia && c.protocol_id !== latest.protocol_id) continue
    if (isNum(v)) return v
  }
  return null
}

export function BodyView() {
  const { body, input, score, isPending } = useBodyData()
  const [view, setView] = useState<View>("front")
  const [mode, setMode] = useState<BodyMapMode>("measures")
  const [selected, setSelected] = useState<Muscle | null>(null)

  const stats = useMemo(() => {
    const bio = input?.bio
    const l = bio?.latest
    const b = bio?.latestBia
    if (!bio || !l) return null
    const chrono = bio.chronological
    const d = (key: keyof Checkup, bia = false) => {
      const row = bia ? b : l
      const cur = row?.[key]
      const prev = row ? prevComparable(chrono, row, key, bia) : null
      return isNum(cur) && isNum(prev) ? cur - prev : null
    }
    const fat = isNum(b?.fat_mass_pct) ? bodyFatBand(b.fat_mass_pct, input?.profile?.sex ?? null, bio.age) : null
    return [
      { label: "Peso", value: l.weight_kg, unit: "kg", digits: 1, delta: d("weight_kg"), good: null as "up" | "down" | null },
      { label: "Massa grassa", value: b?.fat_mass_pct ?? null, unit: "%", digits: 1, delta: d("fat_mass_pct", true), good: "down" as const, hint: fat?.label },
      { label: "Massa magra", value: b?.ffm_kg ?? null, unit: "kg", digits: 1, delta: d("ffm_kg", true), good: "up" as const },
      { label: "FFMI", value: b?.ffmi ?? null, unit: "", digits: 1, delta: d("ffmi", true), good: "up" as const },
      { label: "Vita/altezza", value: l.waist_to_height, unit: "", digits: 2, delta: d("waist_to_height"), good: "down" as const, hint: isNum(l.waist_to_height) ? whtrBand(l.waist_to_height).label : undefined },
      { label: "Acqua", value: b?.total_body_water_pct ?? null, unit: "%", digits: 1, delta: d("total_body_water_pct", true), good: null },
      { label: "Grasso viscerale", value: b?.visceral_fat ?? null, unit: "", digits: 0, delta: d("visceral_fat", true), good: "down" as const },
      { label: "Metabolismo basale", value: b?.bmr_kcal ?? null, unit: "kcal", digits: 0, delta: d("bmr_kcal", true), good: "up" as const },
    ].filter((s) => isNum(s.value))
  }, [input])

  const header = (
    <PageHeader
      icon={ScanLine}
      eyebrow="Corpo"
      title="Mappa corporea"
      description="Tutti i tuoi dati sul corpo: circonferenze, composizione, muscoli allenati, punti deboli, cuore e analisi. Tocca un muscolo per i dettagli."
    />
  )

  if (isPending) {
    return (
      <>
        {header}
        <div className="grid gap-4 lg:grid-cols-[280px_1fr_280px]">
          <Skeleton className="h-96 rounded-2xl" />
          <Skeleton className="h-[560px] rounded-2xl" />
          <Skeleton className="h-96 rounded-2xl" />
        </div>
      </>
    )
  }
  if (!body || !input?.bio?.latest) {
    return (
      <>
        {header}
        <EmptyState icon={ScanLine} title="Nessuna misura ancora" description="Inserisci la prima visita con peso, BIA e circonferenze: la mappa si popola automaticamente." action={<Button asChild className="rounded-xl"><Link href="/checkups?new=1">Aggiungi visita</Link></Button>} />
      </>
    )
  }

  const tr = input.training
  const weakness = selected ? tr?.physique.weaknesses.find((w) => w.muscle === selected) : null
  const today = todayISO()
  const supToday = input.supplements.filter((s) => isScheduled(s, today)).length
  const labsOut = input.labs?.latestDate ? input.labs.series.filter((s) => s.latest.date === input.labs?.latestDate && (s.latest.flag === "high" || s.latest.flag === "low")) : []
  const muscleSite: Partial<Record<Muscle, string>> = { biceps: "arm", triceps: "arm", forearms: "forearm", chest: "chest", lats: "chest", side_delts: "shoulders", front_delts: "shoulders", rear_delts: "shoulders", quads: "thigh", hamstrings: "thigh", adductors: "thigh", glutes: "hips", calves: "calf", abs: "waist", upper_back: "neck" }
  const site = selected ? muscleSite[selected] : undefined

  return (
    <>
      {header}
      <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)_280px]">
        {/* Colonna sinistra: composizione */}
        <GlassCard className="order-2 p-4 lg:order-1">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Composizione</h2>
            <span className="text-[11px] text-muted-foreground">{formatDate(input.bio.latest.checkup_date, "medium")}</span>
          </div>
          <ul className="stagger space-y-2">
            {(stats ?? []).map((s) => {
              const dl = fmtDelta(s.delta, s.digits === 0 ? 0 : s.digits)
              const positive = s.good && isNum(s.delta) ? (s.good === "up" ? s.delta > 0 : s.delta < 0) : null
              return (
                <li key={s.label} className="surface-inset flex items-center justify-between gap-2 rounded-xl px-3 py-2">
                  <span className="min-w-0">
                    <span className="block text-[11px] uppercase tracking-wider text-muted-foreground">{s.label}</span>
                    {s.hint && <span className="block truncate text-[10px] text-muted-foreground">{s.hint}</span>}
                  </span>
                  <span className="text-right">
                    <span className="font-display text-base font-semibold tabular">
                      {formatNumber(s.value, s.digits)}
                      {s.unit && <span className="ml-0.5 text-[11px] font-normal text-muted-foreground">{s.unit}</span>}
                    </span>
                    {dl && <span className={cn("block text-[10px] tabular", positive === null ? "text-muted-foreground" : positive ? "text-gain" : "text-warn")}>{dl}</span>}
                  </span>
                </li>
              )
            })}
          </ul>
        </GlassCard>

        {/* Centro: corpo */}
        <GlassCard raised className="order-1 flex flex-col p-3 sm:p-4 lg:order-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Segmented<BodyMapMode> label="Cosa mostrare" value={mode} onChange={(m) => { setMode(m); setSelected(null) }} options={MODES} />
            <Button variant="outline" size="sm" className="rounded-lg" onClick={() => setView((v) => (v === "front" ? "back" : "front"))}>
              <RotateCw className="size-3.5" /> {view === "front" ? "Retro" : "Fronte"}
            </Button>
          </div>
          <BodyMap
            className="mx-auto mt-2 aspect-[424/452] w-full max-w-[560px]"
            view={view}
            mode={mode}
            sites={body.sites}
            deltas={body.deltas}
            muscleTone={mode === "training" ? body.trainingTone : body.focusTone}
            muscleLabel={body.labels}
            markers={body.markers}
            selected={selected}
            onSelect={setSelected}
            figure={body.figure}
          />
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
            {LEGEND[mode].map((l) => (
              <span key={l.label} className="flex items-center gap-1.5">
                <span className={cn("size-2.5 rounded-sm", l.cls)} /> {l.label}
              </span>
            ))}
            {mode !== "measures" && <span>· tocca un muscolo</span>}
          </div>

          {selected && (
            <div className="animate-page-in surface-inset mt-3 rounded-2xl p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">{MUSCLES[selected]}</p>
                  <p className="text-xs text-muted-foreground">
                    {body.volume ? `${formatNumber(body.volume[selected], 1)} serie a settimana` : "Nessuna scheda o sessione registrata"}
                    {site && isNum(body.sites[site]) && ` · ${site === "arm" ? "braccio" : site === "thigh" ? "coscia" : site === "calf" ? "polpaccio" : site === "forearm" ? "avambraccio" : site === "chest" ? "torace" : site === "shoulders" ? "spalle" : site === "hips" ? "fianchi" : site === "waist" ? "vita" : "collo"} ${formatNumber(body.sites[site], 1)} cm`}
                    {site && fmtDelta(body.deltas[site]) && ` (${fmtDelta(body.deltas[site])})`}
                  </p>
                </div>
                <button type="button" onClick={() => setSelected(null)} aria-label="Chiudi" className="rounded-lg p-1 text-muted-foreground hover:bg-accent">
                  <X className="size-4" />
                </button>
              </div>
              {weakness ? (
                <>
                  <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                    {weakness.reasons.map((r) => (
                      <li key={r}>• {r}</li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs">
                    Obiettivo <strong>{weakness.targetSets} serie/settimana</strong> con: {weakness.exercises.map((e) => e.name).join(", ")}.
                  </p>
                </>
              ) : (
                <p className="mt-2 text-xs text-muted-foreground">
                  Esercizi principali: {EXERCISES.filter((e) => e.primary === selected).slice(0, 4).map((e) => e.name).join(", ")}.
                </p>
              )}
              <Button asChild variant="ghost" size="sm" className="-ml-2 mt-1 rounded-lg text-neon">
                <Link href="/training?tab=analysis">
                  Analisi allenamento <ArrowRight className="size-3.5" />
                </Link>
              </Button>
            </div>
          )}
        </GlassCard>

        {/* Colonna destra: salute */}
        <div className="order-3 space-y-4">
          <GlassCard className="flex items-center gap-4 p-4">
            <ScoreRing score={score?.score ?? null} size={84} stroke={8} />
            <div className="min-w-0">
              <p className="text-sm font-semibold">Indice salute</p>
              <p className="text-xs text-muted-foreground">{(score?.parts ?? []).map((p) => `${p.label} ${p.score}`).join(" · ")}</p>
              <Link href="/advice" className="mt-1 inline-flex items-center gap-1 text-xs text-neon">
                Consigli <ArrowRight className="size-3" />
              </Link>
            </div>
          </GlassCard>
          <GlassCard className="space-y-2 p-4">
            <Row icon={HeartPulse} label="Cuore" href="/reports" value={body.sys && body.dia ? `${body.sys.value}/${body.dia.value} mmHg` : body.hr ? `${body.hr.value} bpm` : "—"} hint={body.bp?.label ?? (body.ecg ? `ECG ${formatDate(body.ecg.report_date, "short")}` : "Nessun referto")} tone={body.bp?.cls === "hypertension" ? "danger" : body.bp?.cls === "elevated" ? "warn" : body.bp ? "gain" : undefined} />
            <Row icon={FlaskConical} label="Analisi" href="/labs" value={input.labs?.latestDate ? (labsOut.length ? `${labsOut.length} fuori range` : "Nella norma") : "—"} hint={labsOut.length ? labsOut.slice(0, 3).map((s) => s.name).join(", ") : input.labs?.latestDate ? formatDate(input.labs.latestDate, "short") : "Nessuna analisi"} tone={input.labs?.latestDate ? (labsOut.length ? "warn" : "gain") : undefined} />
            <Row icon={Dumbbell} label="Allenamento" href="/training" value={tr?.hasData ? `${formatNumber(tr.logged.sessionsPerWeek, 1)}/sett.` : "—"} hint={tr?.today.day ? `Oggi: ${tr.today.day.label}` : tr?.today.rest ? "Oggi riposo" : "Nessuna scheda"} />
            <Row icon={Pill} label="Integratori" href="/supplements" value={supToday ? `${supToday} oggi` : "—"} hint={`${input.supplements.filter((s) => s.is_active).length} in uso`} />
            <Row icon={Droplets} label="Idratazione" value={isNum(input.bio.latest.weight_kg) ? `${formatNumber((input.bio.latest.weight_kg * 35) / 1000, 1)} L` : "—"} hint="fabbisogno stimato (35 mL/kg)" />
            <Row icon={Activity} label="Fabbisogno" value={isNum(input.bio.energy.tdee) ? `${formatNumber(input.bio.energy.tdee, 0)} kcal` : "—"} hint="TDEE stimato" />
          </GlassCard>
        </div>
      </div>
    </>
  )
}

function Row({ icon: Icon, label, value, hint, href, tone }: { icon: typeof Pill; label: string; value: string; hint: string; href?: string; tone?: "gain" | "warn" | "danger" }) {
  const body = (
    <div className="surface-inset flex items-center gap-3 rounded-xl px-3 py-2 transition-colors hover:border-neon/30">
      <Icon className={cn("size-4 shrink-0", tone === "danger" ? "text-danger" : tone === "warn" ? "text-warn" : tone === "gain" ? "text-gain" : "text-neon")} />
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] uppercase tracking-wider text-muted-foreground">{label}</span>
        <span className="block truncate text-[11px] text-muted-foreground">{hint}</span>
      </span>
      <span className="shrink-0 text-sm font-semibold tabular">{value}</span>
    </div>
  )
  return href ? <Link href={href}>{body}</Link> : body
}

/** Versione compatta per la dashboard. */
export function BodyMapCard() {
  const { body, input, isPending } = useBodyData()
  if (isPending) return <Skeleton className="h-[420px] rounded-2xl" />
  if (!body || !input?.bio?.latest) return null
  const l = input.bio.latest
  const b = input.bio.latestBia
  return (
    <GlassCard raised className="grid gap-4 p-4 sm:grid-cols-[1fr_220px] sm:p-5">
      <BodyMap className="mx-auto aspect-[424/452] w-full max-w-[420px]" view="front" mode="measures" sites={body.sites} deltas={body.deltas} markers={body.markers} figure={body.figure} compact />
      <div className="flex flex-col justify-between gap-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-1">
          {[
            { label: "Peso", value: l.weight_kg, unit: "kg", d: 1 },
            { label: "Massa grassa", value: b?.fat_mass_pct ?? null, unit: "%", d: 1 },
            { label: "Massa magra", value: b?.ffm_kg ?? null, unit: "kg", d: 1 },
            { label: "FFMI", value: b?.ffmi ?? null, unit: "", d: 1 },
          ]
            .filter((s) => isNum(s.value))
            .map((s) => (
              <div key={s.label} className="surface-inset rounded-xl px-3 py-2">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{s.label}</p>
                <p className="font-display text-lg font-semibold tabular">
                  {formatNumber(s.value, s.d)}
                  {s.unit && <span className="ml-0.5 text-xs font-normal text-muted-foreground">{s.unit}</span>}
                </p>
              </div>
            ))}
        </div>
        <Button asChild className="rounded-xl">
          <Link href="/body">
            Apri la mappa corporea <ArrowRight className="size-4" />
          </Link>
        </Button>
      </div>
    </GlassCard>
  )
}
