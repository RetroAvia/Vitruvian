"use client"

import { ArrowRight, CalendarCheck, FlaskConical, HeartPulse, Lightbulb, Pill, Salad, ScanLine } from "lucide-react"
import Link from "next/link"
import { useEffect, useMemo } from "react"
import { toast } from "sonner"

import { GlassCard } from "@/components/shared/glass-card"
import { ScoreRing } from "@/components/shared/score-ring"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { AdviceCard, useVisibleAdvice } from "@/features/advice/components/advice-view"
import { useHealthContext } from "@/features/advice/hooks/use-health-context"
import { useDietPlans, useMealLogs, usePlanTree } from "@/features/nutrition/api/nutrition"
import { dayForDate } from "@/features/nutrition/engine/totals"
import { useSupplementLogs } from "@/features/supplements/api/supplements"
import { isScheduled } from "@/features/supplements/engine/analysis"
import { daysBetween, formatDate, shiftISO, todayISO } from "@/lib/format"
import { playSound } from "@/lib/sound"
import { cn } from "@/lib/utils"

interface AgendaItem {
  id: string
  icon: typeof Pill
  title: string
  detail: string
  href: string
  tone: "neon" | "warn" | "gain" | "muted"
  progress?: number
}

const TONE: Record<AgendaItem["tone"], string> = {
  neon: "bg-neon/10 text-neon ring-neon/25",
  warn: "bg-warn/10 text-warn ring-warn/25",
  gain: "bg-gain/10 text-gain ring-gain/25",
  muted: "bg-muted text-muted-foreground ring-border",
}

/** Sezione "Il tuo quadro": indice salute, consigli principali e agenda di oggi. */
export function TodayCard() {
  const { advice, score, input, isPending } = useHealthContext()
  const visible = useVisibleAdvice(advice)
  const today = todayISO()
  const from = useMemo(() => shiftISO(todayISO(), -30), [])
  const supLogsQ = useSupplementLogs(from)
  const mealLogsQ = useMealLogs(from)
  const plansQ = useDietPlans()
  const activePlan = (plansQ.data ?? []).find((p) => p.is_active) ?? null
  const treeQ = usePlanTree(activePlan?.id ?? null)

  const agenda = useMemo<AgendaItem[]>(() => {
    if (!input) return []
    const items: AgendaItem[] = []

    const scheduled = input.supplements.filter((s) => isScheduled(s, today))
    if (scheduled.length > 0) {
      const taken = new Set((supLogsQ.data ?? []).filter((l) => l.log_date === today && l.taken).map((l) => l.supplement_id))
      const done = scheduled.filter((s) => taken.has(s.id)).length
      items.push({
        id: "sup",
        icon: Pill,
        title: done === scheduled.length ? "Integratori di oggi completati" : `Integratori: ${scheduled.length - done} da prendere`,
        detail: scheduled.filter((s) => !taken.has(s.id)).map((s) => s.name).slice(0, 3).join(", ") || "Ottimo lavoro",
        href: "/supplements",
        tone: done === scheduled.length ? "gain" : "neon",
        progress: done / scheduled.length,
      })
    }

    const day = treeQ.data ? dayForDate(treeQ.data.days, today) : undefined
    if (day && day.meals.length > 0) {
      const logged = new Set((mealLogsQ.data ?? []).filter((l) => l.log_date === today).map((l) => l.meal_id))
      const done = day.meals.filter((m) => logged.has(m.id)).length
      items.push({
        id: "meals",
        icon: Salad,
        title: done === day.meals.length ? "Pasti di oggi registrati" : `Pasti: ${done}/${day.meals.length} registrati`,
        detail: day.label ?? input.planName ?? "Piano attivo",
        href: "/nutrition",
        tone: done === day.meals.length ? "gain" : "neon",
        progress: done / day.meals.length,
      })
    }

    for (const u of input.medical?.upcoming ?? []) {
      if (u.status === "planned") continue
      items.push({
        id: `due-${u.kind}`,
        icon: HeartPulse,
        title: u.status === "overdue" ? `${u.label}: scaduto` : `${u.label} tra ${u.daysLeft} giorni`,
        detail: `Scadenza ${formatDate(u.dueDate, "medium")}`,
        href: "/reports",
        tone: u.status === "overdue" ? "warn" : "neon",
      })
    }

    const last = input.bio?.latest?.checkup_date
    if (last) {
      const next = shiftISO(last, 35)
      const left = daysBetween(today, next)
      items.push({
        id: "bia",
        icon: ScanLine,
        title: left <= 0 ? "Prossima misurazione BIA: è il momento" : `Prossima misurazione BIA tra ${left} giorni`,
        detail: `Ultima il ${formatDate(last, "medium")} · ogni 4–6 settimane`,
        href: "/checkups?new=1",
        tone: left <= 0 ? "warn" : "muted",
      })
    }

    if (input.labs?.latestDate) {
      const next = shiftISO(input.labs.latestDate, 365)
      const left = daysBetween(today, next)
      if (left <= 45) {
        items.push({
          id: "labs",
          icon: FlaskConical,
          title: left <= 0 ? "Analisi del sangue da rifare" : `Analisi del sangue tra ${left} giorni`,
          detail: `Ultime il ${formatDate(input.labs.latestDate, "medium")}`,
          href: "/labs",
          tone: left <= 0 ? "warn" : "neon",
        })
      }
    }
    return items
  }, [input, today, supLogsQ.data, mealLogsQ.data, treeQ.data])

  // Festeggia (una sola volta) ogni obiettivo raggiunto
  useEffect(() => {
    const reached = (input?.forecasts ?? []).filter((f) => f.direction === "reached")
    if (reached.length === 0) return
    try {
      const key = "vitruvian-celebrated"
      const done = new Set<string>(JSON.parse(localStorage.getItem(key) ?? "[]") as string[])
      const fresh = reached.filter((f) => !done.has(`${f.key}:${f.target}`))
      if (fresh.length === 0) return
      fresh.forEach((f) => done.add(`${f.key}:${f.target}`))
      localStorage.setItem(key, JSON.stringify([...done]))
      playSound("celebrate")
      toast.success(`Obiettivo raggiunto: ${fresh.map((f) => f.label.toLowerCase()).join(", ")}`, { description: "Grande lavoro. Imposta il prossimo traguardo in Impostazioni." })
    } catch {
      /* storage non disponibile */
    }
  }, [input])

  if (isPending || !input) {
    return (
      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <Skeleton className="h-64 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    )
  }

  const top = visible.filter((a) => !a.positive).slice(0, 3)

  return (
    <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
      <GlassCard raised className="p-5">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <div className="flex shrink-0 flex-col items-center gap-2">
            <ScoreRing score={score?.score ?? null} size={112} stroke={10} label="Salute" />
            <Button asChild variant="ghost" size="sm" className="rounded-lg text-xs text-muted-foreground">
              <Link href="/advice">Come si calcola</Link>
            </Button>
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <Lightbulb className="size-4 text-neon" />
                Consigli principali
              </h3>
              <Button asChild variant="ghost" size="sm" className="rounded-lg text-neon">
                <Link href="/advice">
                  Tutti ({visible.filter((a) => !a.positive).length})
                  <ArrowRight className="size-3.5" />
                </Link>
              </Button>
            </div>
            {top.length === 0 ? (
              <p className="surface-inset rounded-xl p-4 text-sm text-muted-foreground">Nessuna azione urgente: continua così.</p>
            ) : (
              <div className="stagger space-y-2">
                {top.map((a) => (
                  <AdviceCard key={a.id} a={a} compact />
                ))}
              </div>
            )}
          </div>
        </div>
      </GlassCard>

      <GlassCard className="p-5">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <CalendarCheck className="size-4 text-neon" />
          Agenda di oggi
        </h3>
        {agenda.length === 0 ? (
          <p className="surface-inset rounded-xl p-4 text-sm text-muted-foreground">Niente in programma.</p>
        ) : (
          <ul className="stagger space-y-2">
            {agenda.map((it) => {
              const Icon = it.icon
              return (
                <li key={it.id}>
                  <Link
                    href={it.href}
                    className="surface-inset group flex items-center gap-3 rounded-xl p-3 outline-none transition-colors hover:border-neon/30 focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className={cn("grid size-9 shrink-0 place-items-center rounded-lg ring-1 ring-inset", TONE[it.tone])}>
                      <Icon className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{it.title}</span>
                      <span className="block truncate text-xs text-muted-foreground">{it.detail}</span>
                      {it.progress !== undefined && (
                        <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-muted">
                          <span
                            className={cn("block h-full rounded-full transition-[width] duration-500", it.progress >= 1 ? "bg-gain" : "bg-neon")}
                            style={{ width: `${Math.round(it.progress * 100)}%` }}
                          />
                        </span>
                      )}
                    </span>
                    <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </GlassCard>
    </div>
  )
}
