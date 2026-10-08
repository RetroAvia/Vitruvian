"use client"

import { Check, Flame, Pause, Pencil, Pill, Play, Plus, ShieldCheck, Sparkles, Trash2 } from "lucide-react"
import Link from "next/link"
import { useMemo, useState } from "react"
import { toast } from "sonner"

import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { Emoji } from "@/components/shared/emoji"
import { EmptyState } from "@/components/shared/empty-state"
import { GlassCard } from "@/components/shared/glass-card"
import { InsightList } from "@/components/shared/insight-list"
import { PageHeader } from "@/components/shared/page-header"
import { SectionHeader } from "@/components/shared/section-header"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { SUPPLEMENT_FORM_LABELS, SUPPLEMENT_FREQUENCY_LABELS, SUPPLEMENT_TIMINGS, type SupplementTiming } from "@/config/constants"
import { useProfile } from "@/features/profile/api/profile"
import { useTraining } from "@/features/training/hooks/use-training"
import { supplementEmoji } from "@/lib/emoji"
import { formatDate, formatNumber, isNum, shiftISO, todayISO } from "@/lib/format"
import { useSound } from "@/lib/sound"
import { cn } from "@/lib/utils"
import type { Supplement } from "@/types/domain"

import {
  useDeleteSupplement,
  useSetSupplementActive,
  useSupplementLogs,
  useSupplements,
  useToggleSupplementLog,
} from "../api/supplements"
import {
  computeTotals,
  supplementAdherence,
  supplementInsights,
  todaySchedule,
  type NutrientTotal,
} from "../engine/analysis"
import { resolveNutrient } from "../engine/nutrients"
import { SupplementFormDialog } from "./supplement-form-dialog"

export function SupplementsView() {
  const supplementsQ = useSupplements()
  const profileQ = useProfile()
  const today = todayISO()
  const from = useMemo(() => shiftISO(todayISO(), -30), [])
  const logsQ = useSupplementLogs(from)
  const toggle = useToggleSupplementLog(from)
  const play = useSound()

  const [editing, setEditing] = useState<Supplement | null>(null)
  const [formOpen, setFormOpen] = useState(false)

  const supplements = useMemo(() => supplementsQ.data ?? [], [supplementsQ.data])
  // giorno di allenamento secondo la scheda (null = non noto → mostra comunque)
  const { report: training } = useTraining()
  const trainingDay = training?.tree?.days.every((d) => d.day_of_week) ? !training.today.rest || Boolean(training.today.doneToday) : null
  const sex = profileQ.data?.sex ?? null

  const data = useMemo(() => {
    const { totals, unknown } = computeTotals(supplements, sex, today)
    return {
      totals,
      unknown,
      insights: supplementInsights(supplements, totals),
      schedule: todaySchedule(supplements, today, trainingDay, logsQ.data ?? []),
      adherence: supplementAdherence(supplements, logsQ.data ?? [], today, 14),
    }
  }, [supplements, sex, logsQ.data, today, trainingDay])

  const takenToday = new Set((logsQ.data ?? []).filter((l) => l.log_date === today && l.taken).map((l) => l.supplement_id))
  const scheduledToday = data.schedule.flatMap((g) => g.items)
  const doneToday = scheduledToday.filter((s) => takenToday.has(s.id)).length

  function openForm(s: Supplement | null) {
    setEditing(s)
    setFormOpen(true)
  }

  function onToggle(s: Supplement) {
    const taken = !takenToday.has(s.id)
    play(taken ? "check" : "uncheck")
    if (taken && doneToday + 1 === scheduledToday.length && scheduledToday.length > 1) {
      setTimeout(() => {
        play("celebrate")
        toast.success("Tutti gli integratori di oggi presi", { description: "Ottima costanza." })
      }, 220)
    }
    toggle.mutate(
      { supplementId: s.id, date: today, taken },
      { onError: (e) => toast.error("Non salvato", { description: e.message }) },
    )
  }

  const header = (
    <PageHeader
      icon={Pill}
      eyebrow="Salute"
      title="Integratori"
      description="Cosa prendi, quanto e quando. L'app somma le dosi di tutti i prodotti e le confronta con fabbisogni e limiti di sicurezza EFSA."
      actions={
        <>
          <Button variant="outline" className="rounded-xl" onClick={() => openForm(null)}>
            <Plus className="size-4" />
            Aggiungi
          </Button>
          <Button asChild className="rounded-xl">
            <Link href="/bridge?tab=supplements">
              <Sparkles className="size-4" />
              Importa con AI
            </Link>
          </Button>
        </>
      }
    />
  )

  if (supplementsQ.isPending) {
    return (
      <>
        {header}
        <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
          <Skeleton className="h-72 rounded-2xl" />
          <Skeleton className="h-72 rounded-2xl" />
        </div>
      </>
    )
  }

  const active = supplements.filter((s) => s.is_active)
  const suspended = supplements.filter((s) => !s.is_active)

  if (supplements.length === 0) {
    return (
      <>
        {header}
        <EmptyState
          icon={Pill}
          title="Nessun integratore registrato"
          description="Fotografa le etichette e usa l'AI Bridge, oppure aggiungili a mano. Avrai la checklist giornaliera, il totale delle dosi e gli avvisi su sovradosaggi e interazioni."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button variant="outline" className="rounded-xl" onClick={() => openForm(null)}>
                <Plus className="size-4" />
                Aggiungi a mano
              </Button>
              <Button asChild className="rounded-xl">
                <Link href="/bridge?tab=supplements">
                  <Sparkles className="size-4" />
                  Importa con AI
                </Link>
              </Button>
            </div>
          }
        />
        <SupplementFormDialog open={formOpen} onOpenChange={setFormOpen} supplement={editing} />
      </>
    )
  }

  const pct = scheduledToday.length > 0 ? doneToday / scheduledToday.length : 0

  return (
    <>
      {header}

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        {/* Checklist di oggi */}
        <GlassCard raised className="p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">Oggi</h2>
              <p className="text-xs capitalize text-muted-foreground" suppressHydrationWarning>
                {new Intl.DateTimeFormat("it-IT", { weekday: "long", day: "numeric", month: "long" }).format(new Date())}
              </p>
            </div>
            <ProgressRing value={pct} label={`${doneToday}/${scheduledToday.length}`} />
          </div>
          {data.schedule.length === 0 ? (
            <p className="surface-inset rounded-xl p-4 text-center text-sm text-muted-foreground">Niente in programma oggi.</p>
          ) : (
            <div className="stagger space-y-4">
              {data.schedule.map((g) => (
                <div key={g.timing}>
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{g.label}</p>
                  <ul className="space-y-1.5">
                    {g.items.map((s) => {
                      const done = takenToday.has(s.id)
                      return (
                        <li key={s.id}>
                          <button
                            type="button"
                            onClick={() => onToggle(s)}
                            aria-pressed={done}
                            className={cn(
                              "flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-ring",
                              done ? "border-gain/30 bg-gain/[0.07]" : "surface-inset hover:border-neon/30",
                            )}
                          >
                            <span
                              className={cn(
                                "grid size-6 shrink-0 place-items-center rounded-full ring-1 ring-inset transition-colors",
                                done ? "bg-gain text-background ring-gain" : "ring-border",
                              )}
                            >
                              {done && <Check className="animate-pop size-3.5" strokeWidth={3} />}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className={cn("block truncate text-sm font-medium", done && "text-muted-foreground line-through decoration-gain/60")}>
                                <Emoji e={supplementEmoji(s.name)} className="mr-1" />
                                {s.name}
                              </span>
                              <span className="block truncate text-xs text-muted-foreground">
                                {s.dose_label ?? SUPPLEMENT_FORM_LABELS[s.form]}
                                {s.servings_per_day !== 1 && ` × ${formatNumber(s.servings_per_day, s.servings_per_day % 1 ? 1 : 0)}`}
                              </span>
                            </span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </GlassCard>

        {/* Costanza */}
        <div className="space-y-6">
          <GlassCard className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold">Costanza (14 giorni)</h2>
                <p className="text-xs text-muted-foreground">Dosi quotidiane spuntate sul totale previsto</p>
              </div>
              {data.adherence.streak > 1 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-warn/10 px-2 py-0.5 text-[11px] font-medium text-warn ring-1 ring-inset ring-warn/25">
                  <Flame className="size-3" />
                  {data.adherence.streak} giorni di fila
                </span>
              )}
            </div>
            <p className="mt-3 font-display text-3xl font-semibold tabular">
              {isNum(data.adherence.pct) ? `${data.adherence.pct}%` : "—"}
            </p>
            <div className="mt-3 flex h-14 items-end gap-1" aria-hidden>
              {data.adherence.days.map((d) => {
                const r = d.scheduled > 0 ? d.taken / d.scheduled : 0
                return (
                  <div key={d.date} className="flex h-full flex-1 flex-col justify-end rounded-sm bg-muted/50" title={`${formatDate(d.date, "short")}: ${d.taken}/${d.scheduled}`}>
                    <div
                      className={cn("rounded-sm transition-[height] duration-500", r >= 1 ? "bg-gain" : r > 0 ? "bg-warn" : "bg-transparent")}
                      style={{ height: `${Math.max(r * 100, d.scheduled > 0 ? 6 : 0)}%` }}
                    />
                  </div>
                )
              })}
            </div>
            {data.adherence.pct === null && (
              <p className="mt-2 text-xs text-muted-foreground">Spunta gli integratori di oggi per iniziare a misurare la costanza.</p>
            )}
          </GlassCard>

          <GlassCard className="p-4">
            <h2 className="mb-3 px-1 text-sm font-semibold">Controlli di sicurezza</h2>
            {data.insights.length === 0 ? (
              <p className="flex items-center gap-2 rounded-xl bg-gain/[0.07] p-3 text-sm text-gain ring-1 ring-inset ring-gain/20">
                <ShieldCheck className="size-4" />
                Nessun sovradosaggio né interazione rilevata.
              </p>
            ) : (
              <InsightList insights={data.insights} />
            )}
          </GlassCard>
        </div>
      </div>

      {data.totals.length > 0 && (
        <section className="mt-8">
          <SectionHeader
            title="Dosi giornaliere totali"
            description="Somma di tutti i prodotti attivi. Barra = % del limite massimo di sicurezza (UL); tra parentesi la % del fabbisogno"
          />
          <GlassCard className="overflow-x-auto p-2 sm:p-4">
            <table className="w-full min-w-[560px] text-sm tabular">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-2 py-2 font-medium">Principio attivo</th>
                  <th className="px-2 py-2 text-right font-medium">Al giorno</th>
                  <th className="px-2 py-2 font-medium">Limite di sicurezza</th>
                  <th className="px-2 py-2 font-medium">Da</th>
                </tr>
              </thead>
              <tbody>
                {data.totals.map((t) => (
                  <TotalRow key={t.def.code} t={t} />
                ))}
              </tbody>
            </table>
            {data.unknown.length > 0 && (
              <p className="px-2 pt-3 text-xs text-muted-foreground">
                Non inclusi nel calcolo: {data.unknown.map((u) => `${u.name} (${u.supplementName})`).join(", ")}.
              </p>
            )}
          </GlassCard>
        </section>
      )}

      <section className="mt-8">
        <SectionHeader title={`In uso (${active.length})`} description="Tocca la matita per modificare dose, orari e composizione" />
        <div className="stagger grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {active.map((s) => (
            <SupplementCard key={s.id} s={s} onEdit={() => openForm(s)} />
          ))}
        </div>
      </section>

      {suspended.length > 0 && (
        <section className="mt-8">
          <SectionHeader title={`Sospesi (${suspended.length})`} description="Non contano nelle dosi e nella checklist" />
          <div className="grid gap-3 opacity-80 md:grid-cols-2 xl:grid-cols-3">
            {suspended.map((s) => (
              <SupplementCard key={s.id} s={s} onEdit={() => openForm(s)} />
            ))}
          </div>
        </section>
      )}

      <p className="mt-8 text-center text-[11px] text-muted-foreground">
        Limiti EFSA per adulti sani. In gravidanza, con patologie o farmaci chiedi sempre al medico prima di modificare l&apos;integrazione.
      </p>

      <SupplementFormDialog open={formOpen} onOpenChange={setFormOpen} supplement={editing} />
    </>
  )
}

function ProgressRing({ value, label }: { value: number; label: string }) {
  const r = 22
  const c = 2 * Math.PI * r
  return (
    <div className="relative grid size-14 place-items-center">
      {value >= 1 && <span className="animate-ring-burst absolute inset-0 rounded-full ring-2 ring-gain" aria-hidden />}
      <svg viewBox="0 0 56 56" className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx="28" cy="28" r={r} fill="none" stroke="var(--muted)" strokeWidth="5" />
        <circle
          cx="28"
          cy="28"
          r={r}
          fill="none"
          stroke={value >= 1 ? "var(--gain)" : "var(--neon)"}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - Math.min(value, 1))}
          style={{ transition: "stroke-dashoffset 0.6s cubic-bezier(0.22,1,0.36,1), stroke 0.3s" }}
        />
      </svg>
      <span className="relative text-xs font-semibold tabular">{label}</span>
    </div>
  )
}

const STATUS_BAR: Record<NutrientTotal["status"], string> = {
  ok: "bg-gain",
  near: "bg-warn",
  over: "bg-danger",
  none: "bg-muted-foreground/40",
}

function TotalRow({ t }: { t: NutrientTotal }) {
  const d = t.def.unit === "g" ? 1 : t.compare < 10 ? 1 : 0
  return (
    <tr className="border-t">
      <td className="px-2 py-2.5">
        <p className="font-medium">{t.def.name}</p>
        {isNum(t.pctRi) && <p className="text-[11px] text-muted-foreground">{formatNumber(t.pctRi, 0)}% del fabbisogno</p>}
      </td>
      <td className="whitespace-nowrap px-2 py-2.5 text-right font-medium">
        {formatNumber(t.def.basis === "avg" ? t.avg : t.perDay, d)} {t.def.unit}
        {t.def.basis === "avg" && Math.abs(t.avg - t.perDay) > 0.01 && (
          <span className="block text-[11px] font-normal text-muted-foreground">media settimanale</span>
        )}
      </td>
      <td className="min-w-[160px] px-2 py-2.5">
        {isNum(t.pctUl) && isNum(t.def.ul) ? (
          <div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div className={cn("animate-grow-x h-full rounded-full", STATUS_BAR[t.status])} style={{ width: `${Math.min(t.pctUl, 100)}%` }} />
            </div>
            <p className={cn("mt-1 text-[11px]", t.status === "over" ? "text-danger" : t.status === "near" ? "text-warn" : "text-muted-foreground")}>
              {formatNumber(t.pctUl, 0)}% di {formatNumber(t.def.ul, 0)} {t.def.unit}
              {t.def.ulSupplementOnly && " (solo integratori)"}
            </p>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">Nessun limite stabilito</span>
        )}
      </td>
      <td className="px-2 py-2.5 text-xs text-muted-foreground">{t.sources.map((s) => s.supplementName).join(", ")}</td>
    </tr>
  )
}

function SupplementCard({ s, onEdit }: { s: Supplement; onEdit: () => void }) {
  const setActive = useSetSupplementActive()
  const del = useDeleteSupplement()
  const play = useSound()
  const [confirm, setConfirm] = useState(false)

  return (
    <GlassCard className="hover-lift flex flex-col p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">
            <Emoji e={supplementEmoji(s.name)} className="mr-1" />
            {s.name}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {[s.brand, s.dose_label ?? SUPPLEMENT_FORM_LABELS[s.form]].filter(Boolean).join(" · ")}
          </p>
        </div>
        <div className="flex shrink-0 gap-0.5">
          <Button variant="ghost" size="icon" className="size-8 rounded-lg" aria-label={`Modifica ${s.name}`} onClick={onEdit}>
            <Pencil className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 rounded-lg"
            aria-label={s.is_active ? `Sospendi ${s.name}` : `Riprendi ${s.name}`}
            onClick={() => {
              play("tap")
              setActive.mutate(
                { id: s.id, active: !s.is_active, today: todayISO(), startDate: s.start_date },
                {
                  onSuccess: () => toast.success(s.is_active ? `${s.name} sospeso` : `${s.name} di nuovo in uso`),
                  onError: (e) => toast.error(e.message),
                },
              )
            }}
          >
            {s.is_active ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
          </Button>
          <Button variant="ghost" size="icon" className="size-8 rounded-lg text-danger hover:text-danger" aria-label={`Elimina ${s.name}`} onClick={() => setConfirm(true)}>
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-1">
        <span className="rounded-full bg-accent/60 px-2 py-0.5 text-[11px] text-foreground/80">
          {formatNumber(s.servings_per_day, s.servings_per_day % 1 ? 1 : 0)}×/giorno · {SUPPLEMENT_FREQUENCY_LABELS[s.frequency]}
          {s.days_per_week && s.frequency !== "daily" ? ` (${s.days_per_week}/sett.)` : ""}
        </span>
        {s.timing.map((t) => (
          <span key={t} className="rounded-full bg-neon/10 px-2 py-0.5 text-[11px] text-neon">
            {SUPPLEMENT_TIMINGS[t as SupplementTiming] ?? t}
          </span>
        ))}
      </div>

      {s.ingredients.length > 0 && (
        <ul className="mt-3 space-y-0.5 text-xs">
          {s.ingredients.slice(0, 6).map((i) => (
            <li key={`${i.code}-${i.name}`} className="flex justify-between gap-2">
              <span className="truncate text-muted-foreground">{resolveNutrient(i.code)?.name ?? i.name}</span>
              <span className="whitespace-nowrap tabular">{isNum(i.amount) ? `${formatNumber(i.amount, i.amount % 1 ? 2 : 0)} ${i.unit ?? ""}` : "—"}</span>
            </li>
          ))}
          {s.ingredients.length > 6 && <li className="text-muted-foreground">+ altri {s.ingredients.length - 6}</li>}
        </ul>
      )}
      {s.purpose && <p className="mt-auto pt-3 text-xs italic text-muted-foreground">{s.purpose}</p>}
      {!s.is_active && s.end_date && <p className="pt-2 text-[11px] text-muted-foreground">Sospeso dal {formatDate(s.end_date, "short")}</p>}

      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={`Eliminare ${s.name}?`}
        description="Verranno eliminati anche i giorni spuntati nella checklist. Se l'hai solo interrotto, usa “Sospendi”."
        pending={del.isPending}
        onConfirm={async () => {
          try {
            await del.mutateAsync(s.id)
            setConfirm(false)
            toast.success("Integratore eliminato")
          } catch (e) {
            toast.error("Eliminazione non riuscita", { description: e instanceof Error ? e.message : undefined })
          }
        }}
      />
    </GlassCard>
  )
}
