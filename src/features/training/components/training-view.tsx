"use client"

import { BarChart3, BookOpen, Bot, CalendarDays, ChevronDown, ClipboardList, Dumbbell, LayoutTemplate, Play, Plus, Sparkles, TriangleAlert, Zap } from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useEffect, useMemo, useState } from "react"

import { useSessionUser } from "@/components/layout/session-user-context"
import { EmptyState } from "@/components/shared/empty-state"
import { GlassCard } from "@/components/shared/glass-card"
import { InsightList } from "@/components/shared/insight-list"
import { PageHeader } from "@/components/shared/page-header"
import { SectionHeader } from "@/components/shared/section-header"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

import { useTrainingTree } from "../api/training"
import { TECHNIQUES } from "../engine/techniques"
import { TEMPLATES } from "../engine/templates"
import { useTraining } from "../hooks/use-training"
import { useLocalWorkoutState, useWorkoutSession } from "../session/workout-session"
import type { TrainingDay, WorkoutSummary } from "../types"
import { ExerciseLibrary } from "./exercise-library"
import { ActivityHeatmap, HistoryCard } from "./history-card"
import { FocusCard, ProportionsCard } from "./physique-card"
import { PlanCard } from "./plan-card"
import { emptyPlan, fromPayload, fromTree, PlanEditor, type EPlan } from "./plan-editor"
import { ProgressCard } from "./progress-card"
import { TodayPanel } from "./today-panel"
import { TrainingTools } from "./training-tools"
import { VolumeCard } from "./volume-card"

type Tab = "today" | "plans" | "exercises" | "history" | "analysis"
const TABS: Array<{ id: Tab; label: string; icon: typeof Dumbbell }> = [
  { id: "today", label: "Allenati", icon: Zap },
  { id: "plans", label: "Schede", icon: ClipboardList },
  { id: "exercises", label: "Esercizi", icon: BookOpen },
  { id: "history", label: "Storico", icon: CalendarDays },
  { id: "analysis", label: "Analisi", icon: BarChart3 },
]

export function TrainingView() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const rawTab = params.get("tab")
  const tab: Tab = TABS.some((t) => t.id === rawTab) ? (rawTab as Tab) : "today"
  const user = useSessionUser()

  const { report, plans, planId, workouts, isPending, error } = useTraining()
  const [viewPlan, setViewPlan] = useState<string | null>(null)
  // una scheda eliminata non resta selezionata
  const shownPlanId = (viewPlan && plans.some((p) => p.id === viewPlan) ? viewPlan : null) ?? planId ?? plans[0]?.id ?? null
  const shownTreeQ = useTrainingTree(tab === "plans" ? shownPlanId : null)

  const startSession = useWorkoutSession((s) => s.start)
  const playerOpen = useWorkoutSession((s) => s.open)
  const { draft } = useLocalWorkoutState(user.id, playerOpen)
  const [editor, setEditor] = useState<{ open: boolean; initial: EPlan | null }>({ open: false, initial: null })

  const selectTab = (t: Tab) => router.replace(`${pathname}?tab=${t}`, { scroll: false })

  // /training?log=1 (link esterni, versioni precedenti) apre subito il registro
  useEffect(() => {
    if (params.get("log") === "1") {
      startSession({ kind: "today" })
      router.replace(pathname, { scroll: false })
    }
  }, [params, router, pathname, startSession])

  const prCodes = useMemo(() => new Set((report?.prs ?? []).map((p) => p.code)), [report])
  const start = (day: TrainingDay | null) => startSession({ kind: "day", day })
  const edit = (w: WorkoutSummary) => startSession({ kind: "edit", id: w.id })
  const repeat = (w: WorkoutSummary) => startSession({ kind: "repeat", id: w.id, title: w.title })

  const header = (
    <PageHeader
      icon={Dumbbell}
      eyebrow="Corpo"
      title="Allenamento"
      description="Schede, registro con timer, progressi e consigli collegati alle tue misure."
      actions={
        <>
          <Button variant="outline" asChild className="rounded-xl">
            <Link href="/bridge?tab=training" aria-label="Importa con AI">
              <Sparkles className="size-4" /> <span className="hidden sm:inline">Importa con AI</span>
            </Link>
          </Button>
          <Button className="rounded-xl" onClick={() => startSession({ kind: "today" })}>
            <Play className="size-4" /> {draft ? "Riprendi" : "Allenati ora"}
          </Button>
        </>
      }
    />
  )

  const tabs = (
    <div role="tablist" aria-label="Sezioni allenamento" className="mb-6 grid grid-cols-5 gap-1 rounded-2xl border bg-card/40 p-1 sm:inline-grid sm:w-auto sm:grid-flow-col sm:auto-cols-max">
      {TABS.map((t) => {
        const Icon = t.icon
        const active = tab === t.id
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => selectTab(t.id)}
            className={cn(
              "flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-2 text-[11px] font-medium transition-colors sm:flex-row sm:gap-2 sm:px-4 sm:text-sm",
              active ? "bg-neon/12 text-neon ring-1 ring-inset ring-neon/30" : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
            )}
          >
            <Icon className="size-4 shrink-0" />
            <span className="truncate">{t.label}</span>
          </button>
        )
      })}
    </div>
  )

  const editorOverlay = <PlanEditor open={editor.open} onOpenChange={(o) => setEditor((e) => ({ ...e, open: o }))} initial={editor.initial} onSaved={(id) => setViewPlan(id)} />

  if (isPending) {
    return (
      <>
        {header}
        <Skeleton className="mb-6 h-14 w-full max-w-xl rounded-2xl" />
        <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
          <Skeleton className="h-72 rounded-2xl" />
          <Skeleton className="h-72 rounded-2xl" />
        </div>
      </>
    )
  }
  if (error || !report) {
    return (
      <>
        {header}
        <EmptyState icon={TriangleAlert} title="Impossibile caricare l'allenamento" description={error?.message} />
      </>
    )
  }

  return (
    <>
      {header}
      {tabs}

      {tab === "today" && (
        <div className="animate-page-in space-y-6">
          {!report.hasData ? (
            <EmptyState
              icon={Dumbbell}
              title="Iniziamo"
              description="Crea la tua scheda (anche da un modello), importala con l'AI Bridge oppure parti subito con una sessione libera."
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  <Button className="rounded-xl" onClick={() => selectTab("plans")}>
                    <LayoutTemplate className="size-4" /> Crea la scheda
                  </Button>
                  <Button variant="outline" className="rounded-xl" onClick={() => start(null)}>
                    <Play className="size-4" /> Sessione libera
                  </Button>
                </div>
              }
            />
          ) : (
            <TodayPanel report={report} workouts={workouts} draft={Boolean(draft)} onStart={start} onEdit={edit} onRepeat={repeat} onShowHistory={() => selectTab("history")} onShowAnalysis={() => selectTab("analysis")} />
          )}
        </div>
      )}

      {tab === "plans" && (
        <div className="animate-page-in space-y-6">
          <div className="flex flex-wrap gap-2">
            <Button className="rounded-xl" onClick={() => setEditor({ open: true, initial: emptyPlan() })}>
              <Plus className="size-4" /> Nuova scheda
            </Button>
            <Button asChild variant="outline" className="rounded-xl">
              <Link href="/coach">
                <Bot className="size-4" /> Crea con Coach AI
              </Link>
            </Button>
          </div>
          {shownTreeQ.data ? (
            <PlanCard
              tree={shownTreeQ.data}
              plans={plans}
              selectedId={shownTreeQ.data.plan.id}
              onSelect={setViewPlan}
              onStart={(day) => start(day)}
              onEdit={() => shownTreeQ.data && setEditor({ open: true, initial: fromTree(shownTreeQ.data) })}
            />
          ) : shownPlanId ? (
            <Skeleton className="h-64 rounded-2xl" />
          ) : null}
          <section>
            <SectionHeader icon={LayoutTemplate} title="Modelli pronti" description="Partenze collaudate: aprile nell'editor e adattale a te" />
            <div className="stagger grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {TEMPLATES.map((t) => (
                <button key={t.key} type="button" onClick={() => setEditor({ open: true, initial: fromPayload(t.plan) })} className="glass hover-lift flex flex-col rounded-2xl p-4 text-left">
                  <p className="text-sm font-semibold">{t.title}</p>
                  <p className="mt-1 flex-1 text-xs text-muted-foreground">{t.description}</p>
                  <p className="mt-3 text-[11px] text-neon">
                    {t.plan.days.length} giorni · {t.plan.days.reduce((n, d) => n + d.exercises.length, 0)} esercizi
                  </p>
                </button>
              ))}
            </div>
          </section>
          <details className="glass group rounded-2xl">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 text-sm font-semibold [&::-webkit-details-marker]:hidden">
              <span>
                Tecniche disponibili
                <span className="block text-xs font-normal text-muted-foreground">Piramide, drop set, rest-pause, myo-reps… impostale per esercizio nell&apos;editor</span>
              </span>
              <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
            </summary>
            <dl className="grid gap-3 border-t p-4 sm:grid-cols-2">
              {Object.values(TECHNIQUES).map((t) => (
                <div key={t.label}>
                  <dt className="text-xs font-semibold">{t.label}</dt>
                  <dd className="text-xs text-muted-foreground">{t.description}</dd>
                </div>
              ))}
            </dl>
          </details>
        </div>
      )}

      {tab === "exercises" && (
        <div className="animate-page-in space-y-6">
          <ExerciseLibrary progress={report.progress} workouts={workouts} />
          <TrainingTools />
        </div>
      )}

      {tab === "history" && (
        <div className="animate-page-in space-y-6">
          <ActivityHeatmap workouts={workouts} />
          <HistoryCard workouts={workouts} onEdit={edit} />
        </div>
      )}

      {tab === "analysis" && (
        <div className="animate-page-in space-y-8">
          <section>
            <SectionHeader title="Su cosa concentrarti" description="Incrocia circonferenze, proporzioni e volume per muscolo" />
            <FocusCard physique={report.physique} />
          </section>
          <section className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
            <VolumeCard plan={report.plan} logged={report.logged} />
            <ProportionsCard physique={report.physique} />
          </section>
          <ProgressCard progress={report.progress} prCodes={prCodes} />
          {report.insights.length > 0 && (
            <GlassCard className="p-4">
              <InsightList insights={report.insights} />
            </GlassCard>
          )}
        </div>
      )}

      <p className="mt-10 text-center text-[11px] leading-relaxed text-muted-foreground">
        Volume consigliato da metanalisi sull&apos;ipertrofia (10–20 serie/settimana per muscolo); proporzioni indicative. Ascolta sempre il corpo e il tuo preparatore.
      </p>
      {editorOverlay}
    </>
  )
}
