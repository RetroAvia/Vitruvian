"use client"

import {
  ArrowRight,
  Check,
  CircleCheck,
  Gauge,
  Lightbulb,
  RotateCcw,
  Target,
  TrendingDown,
  TrendingUp,
} from "lucide-react"
import Link from "next/link"
import { useMemo, useState } from "react"
import { toast } from "sonner"

import { EmptyState } from "@/components/shared/empty-state"
import { GlassCard } from "@/components/shared/glass-card"
import { PageHeader } from "@/components/shared/page-header"
import { ScoreRing } from "@/components/shared/score-ring"
import { SectionHeader } from "@/components/shared/section-header"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import type { GoalForecast } from "@/features/biometrics/engine/forecast"
import { daysBetween, formatDate, formatNumber, formatSigned, todayISO } from "@/lib/format"
import { useSound } from "@/lib/sound"
import { cn } from "@/lib/utils"
import { useUiStore } from "@/stores/ui-store"

import { ADVICE_CATEGORY_LABELS, type Advice, type AdviceCategory } from "../engine/advice"
import { useHealthContext } from "../hooks/use-health-context"

export const PRIORITY_STYLE = {
  high: { label: "Priorità alta", dot: "bg-danger", border: "before:bg-danger", chip: "bg-danger/10 text-danger ring-danger/25" },
  medium: { label: "Da fare", dot: "bg-warn", border: "before:bg-warn", chip: "bg-warn/10 text-warn ring-warn/25" },
  low: { label: "Suggerimento", dot: "bg-neon", border: "before:bg-neon", chip: "bg-neon/10 text-neon ring-neon/25" },
} as const

export function useVisibleAdvice(advice: Advice[] | undefined) {
  const dismissed = useUiStore((s) => s.dismissedAdvice)
  return useMemo(() => {
    const today = todayISO()
    return (advice ?? []).filter((a) => {
      const d = dismissed[a.id]
      return !d || daysBetween(d, today) > 30
    })
  }, [advice, dismissed])
}

export function AdviceView() {
  const { advice, score, input, isPending } = useHealthContext()
  const visible = useVisibleAdvice(advice)
  const dismissedCount = (advice?.length ?? 0) - visible.length
  const restore = useUiStore((s) => s.restoreAdvice)
  const [cat, setCat] = useState<AdviceCategory | "all">("all")
  const [showPositive, setShowPositive] = useState(true)

  const header = (
    <PageHeader
      icon={Lightbulb}
      eyebrow="Intelligenza"
      title="Consigli"
      description="Suggerimenti personalizzati che incrociano visite, obiettivi, dieta, analisi, integratori e referti. Ogni consiglio spiega il perché e cosa fare."
    />
  )

  if (isPending || !input) {
    return (
      <>
        {header}
        <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
          <Skeleton className="h-72 rounded-2xl" />
          <Skeleton className="h-72 rounded-2xl" />
        </div>
      </>
    )
  }

  if (!input.bio?.latest && !input.labs && !input.food && input.supplements.length === 0 && !input.medical) {
    return (
      <>
        {header}
        <EmptyState
          icon={Lightbulb}
          title="Servono un po' di dati"
          description="Inserisci una visita, importa le analisi o il piano alimentare: i consigli si attivano automaticamente."
          action={
            <Button asChild className="rounded-xl">
              <Link href="/bridge">Apri l&apos;AI Bridge</Link>
            </Button>
          }
        />
      </>
    )
  }

  const cats = [...new Set(visible.map((a) => a.category))]
  const list = visible.filter((a) => (cat === "all" || a.category === cat) && (showPositive || !a.positive))
  const todo = visible.filter((a) => !a.positive)
  const counts = { high: todo.filter((a) => a.priority === "high").length, medium: todo.filter((a) => a.priority === "medium").length, low: todo.filter((a) => a.priority === "low").length }

  return (
    <>
      {header}

      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        <GlassCard raised className="flex flex-col items-center p-6 text-center">
          <ScoreRing score={score?.score ?? null} size={148} stroke={12} label="Indice salute" />
          <p className="mt-4 max-w-[260px] text-xs text-muted-foreground">
            Media pesata dei domini con dati disponibili. È un indicatore orientativo, non una valutazione medica.
          </p>
          <div className="mt-5 w-full space-y-3 text-left">
            {(score?.parts ?? []).map((p) => (
              <div key={p.key}>
                <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
                  <span className="font-medium">{p.label}</span>
                  <span className="tabular text-muted-foreground">{p.score}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn("animate-grow-x h-full rounded-full", p.score >= 75 ? "bg-gain" : p.score >= 50 ? "bg-warn" : "bg-danger")}
                    style={{ width: `${p.score}%` }}
                  />
                </div>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{p.detail}</p>
              </div>
            ))}
          </div>
        </GlassCard>

        <div className="space-y-6">
          <div className="stagger grid grid-cols-3 gap-3">
            <CountTile n={counts.high} label="Priorità alta" className="text-danger" />
            <CountTile n={counts.medium} label="Da fare" className="text-warn" />
            <CountTile n={counts.low} label="Suggerimenti" className="text-neon" />
          </div>

          {input.forecasts.length > 0 && (
            <GlassCard className="p-5">
              <div className="mb-4 flex items-center gap-2">
                <Target className="size-4 text-neon" />
                <h2 className="text-sm font-semibold">Previsione obiettivi</h2>
                <span className="text-xs text-muted-foreground">· regressione pesata sugli ultimi 9 mesi</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {input.forecasts.map((f) => (
                  <ForecastTile key={f.key} f={f} />
                ))}
              </div>
            </GlassCard>
          )}

          {input.quality && (
            <GlassCard className="p-5">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Gauge className="size-4 text-neon" />
                  <h2 className="text-sm font-semibold">Affidabilità dei dati</h2>
                </div>
                <span className="text-sm font-semibold tabular">
                  {input.quality.score}/100 · {input.quality.label}
                </span>
              </div>
              <ul className="grid gap-2 sm:grid-cols-2">
                {input.quality.factors.map((f) => (
                  <li key={f.label} className="flex gap-2 text-xs">
                    <span className={cn("mt-0.5 grid size-4 shrink-0 place-items-center rounded-full", f.ok ? "bg-gain/15 text-gain" : "bg-warn/15 text-warn")}>
                      {f.ok ? <Check className="size-3" /> : <span className="text-[10px] font-bold">!</span>}
                    </span>
                    <span>
                      <span className="font-medium">{f.label}.</span> <span className="text-muted-foreground">{f.detail}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </GlassCard>
          )}
        </div>
      </div>

      <section className="mt-8">
        <SectionHeader
          title={`I tuoi consigli (${list.length})`}
          description="Ordinati per priorità. Segna come fatto: torna visibile dopo 30 giorni se il dato non cambia."
          actions={
            <div className="flex flex-wrap items-center gap-1.5">
              <Chip active={cat === "all"} onClick={() => setCat("all")}>
                Tutti
              </Chip>
              {cats.map((c) => (
                <Chip key={c} active={cat === c} onClick={() => setCat(c)}>
                  {ADVICE_CATEGORY_LABELS[c]}
                </Chip>
              ))}
              <Chip active={showPositive} onClick={() => setShowPositive((v) => !v)}>
                <CircleCheck className="size-3.5" /> Conferme
              </Chip>
            </div>
          }
        />
        {list.length === 0 ? (
          <GlassCard className="p-8 text-center text-sm text-muted-foreground">Nessun consiglio in questa categoria.</GlassCard>
        ) : (
          <div className="stagger grid gap-3 xl:grid-cols-2">
            {list.map((a) => (
              <AdviceCard key={a.id} a={a} />
            ))}
          </div>
        )}
        {dismissedCount > 0 && (
          <div className="mt-4 text-center">
            <Button variant="ghost" size="sm" className="rounded-xl text-muted-foreground" onClick={restore}>
              <RotateCcw className="size-3.5" />
              Mostra i {dismissedCount} consigli segnati come fatti
            </Button>
          </div>
        )}
      </section>

      <p className="mt-8 text-center text-[11px] leading-relaxed text-muted-foreground">
        I consigli si basano su linee guida generali (CREA, EFSA, ISSN, ESC) e sui tuoi dati. Non sostituiscono il parere del medico o del nutrizionista:
        portali al prossimo controllo come spunto di discussione.
      </p>
    </>
  )
}

function CountTile({ n, label, className }: { n: number; label: string; className: string }) {
  return (
    <GlassCard className="p-4 text-center">
      <p className={cn("font-display text-3xl font-semibold tabular", n === 0 ? "text-muted-foreground" : className)}>{n}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">{label}</p>
    </GlassCard>
  )
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex h-8 items-center gap-1 rounded-full border px-3 text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active ? "border-neon/40 bg-neon/10 text-neon" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  )
}

function ForecastTile({ f }: { f: GoalForecast }) {
  const up = f.perMonth > 0
  const Icon = up ? TrendingUp : TrendingDown
  const good = f.direction === "toward" || f.direction === "reached"
  return (
    <div className="surface-inset rounded-xl p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">{f.label}</p>
        <span className={cn("inline-flex items-center gap-1 text-xs tabular", good ? "text-gain" : f.direction === "away" ? "text-danger" : "text-muted-foreground")}>
          <Icon className="size-3.5" />
          {formatSigned(f.perMonth, f.digits)} {f.unit}/mese
        </span>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {formatNumber(f.current, f.digits)} → <span className="font-medium text-foreground">{formatNumber(f.target, f.digits)} {f.unit}</span>
      </p>
      <p className={cn("mt-1 text-sm font-semibold", good ? "text-foreground" : "text-warn")}>
        {f.direction === "reached"
          ? "Raggiunto"
          : f.eta
            ? `Arrivo stimato: ${formatDate(f.eta, "medium")}`
            : f.direction === "away"
              ? "Tendenza opposta all'obiettivo"
              : f.direction === "flat"
                ? "Valore stabile"
                : "Oltre 5 anni al ritmo attuale"}
      </p>
      {f.onTrackForDate === false && <p className="mt-0.5 text-[11px] text-warn">Dopo la data obiettivo</p>}
      <p className="mt-1 text-[11px] text-muted-foreground">
        Affidabilità {f.confidence === "high" ? "alta" : f.confidence === "medium" ? "media" : "bassa"} · {f.points} misure
      </p>
    </div>
  )
}

export function AdviceCard({ a, compact }: { a: Advice; compact?: boolean }) {
  const p = PRIORITY_STYLE[a.priority]
  const dismiss = useUiStore((s) => s.dismissAdvice)
  const play = useSound()

  return (
    <GlassCard
      className={cn(
        "hover-lift relative overflow-hidden p-4 pl-5 before:absolute before:inset-y-0 before:left-0 before:w-1",
        a.positive ? "before:bg-gain" : p.border,
      )}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1 ring-inset", a.positive ? "bg-gain/10 text-gain ring-gain/25" : p.chip)}>
          {a.positive ? "Va bene così" : p.label}
        </span>
        <span className="text-[11px] text-muted-foreground">{ADVICE_CATEGORY_LABELS[a.category]}</span>
      </div>
      <h3 className="mt-2 text-sm font-semibold leading-snug">{a.title}</h3>
      {!compact && <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{a.why}</p>}
      <div className={cn("mt-3 rounded-xl p-3 text-xs leading-relaxed", a.positive ? "bg-gain/[0.06]" : "bg-neon/[0.06]")}>
        <span className="font-semibold text-foreground">{a.positive ? "Consiglio: " : "Cosa fare: "}</span>
        {a.action}
      </div>
      {!compact && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          {a.link ? (
            <Button asChild variant="ghost" size="sm" className="-ml-2 rounded-lg text-neon">
              <Link href={a.link.href}>
                {a.link.label}
                <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          ) : (
            <span />
          )}
          {!a.positive && (
            <Button
              variant="ghost"
              size="sm"
              className="rounded-lg text-muted-foreground"
              onClick={() => {
                dismiss(a.id, todayISO())
                play("check")
                toast.success("Segnato come fatto", { description: "Lo rivedrai tra 30 giorni se il dato non cambia." })
              }}
            >
              <Check className="size-3.5" />
              Fatto
            </Button>
          )}
        </div>
      )}
    </GlassCard>
  )
}
