"use client"

import { CalendarClock, ChevronDown, HeartPulse, Sparkles, Stethoscope, Trash2 } from "lucide-react"
import Link from "next/link"
import { useMemo, useState } from "react"
import { toast } from "sonner"

import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { EmptyState } from "@/components/shared/empty-state"
import { GlassCard } from "@/components/shared/glass-card"
import { InsightList } from "@/components/shared/insight-list"
import { PageHeader } from "@/components/shared/page-header"
import { SectionHeader } from "@/components/shared/section-header"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { MEDICAL_KIND_LABELS } from "@/config/constants"
import { LabStatusBadge } from "@/features/labs/components/lab-status"
import { RangeSparkline } from "@/features/labs/components/range-sparkline"
import { useProfile } from "@/features/profile/api/profile"
import { formatDate, formatNumber, isNum, todayISO } from "@/lib/format"
import { useSound } from "@/lib/sound"
import { cn } from "@/lib/utils"
import type { MedicalReport, MedicalReportKind, Sex } from "@/types/domain"

import { useDeleteMedicalReport, useMedicalReports } from "../api/medical"
import { analyzeMedical, measureDigits, measureFlag, measureRange, type UpcomingCheck } from "../engine/analysis"
import { defaultRange } from "../engine/catalog"
import { OutcomeBadge } from "./outcome-badge"

export function ReportsView() {
  const reportsQ = useMedicalReports()
  const profileQ = useProfile()
  const sex = profileQ.data?.sex ?? null
  const [kind, setKind] = useState<MedicalReportKind | "all">("all")

  const analysis = useMemo(
    () => (reportsQ.data ? analyzeMedical(reportsQ.data, sex, todayISO()) : null),
    [reportsQ.data, sex],
  )

  const header = (
    <PageHeader
      icon={HeartPulse}
      eyebrow="Salute"
      title="Referti medici"
      description="ECG, visite medico-sportive, pressione, spirometria, ecocardiogrammi e altri esami strumentali: esiti, misure nel tempo e prossimi controlli."
      actions={
        <Button asChild className="rounded-xl">
          <Link href="/bridge?tab=medical">
            <Sparkles className="size-4" />
            Importa referto
          </Link>
        </Button>
      }
    />
  )

  if (reportsQ.isPending) {
    return (
      <>
        {header}
        <div className="grid gap-4 md:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="mt-6 h-80 rounded-2xl" />
      </>
    )
  }

  if (!analysis || analysis.reports.length === 0) {
    return (
      <>
        {header}
        <EmptyState
          icon={Stethoscope}
          title="Nessun referto ancora"
          description="Fotografa o scarica il referto (ECG, visita sportiva, pressione…), copia il prompt dall'AI Bridge e incolla la risposta: l'app estrae misure, esito e data del prossimo controllo."
          action={
            <Button asChild className="rounded-xl">
              <Link href="/bridge?tab=medical">
                <Sparkles className="size-4" />
                Importa il primo referto
              </Link>
            </Button>
          }
        />
      </>
    )
  }

  const kinds = [...new Set(analysis.reports.map((r) => r.kind))]
  const visible = kind === "all" ? analysis.reports : analysis.reports.filter((r) => r.kind === kind)
  const nextDue = analysis.upcoming.find((u) => u.status !== "overdue") ?? analysis.upcoming[0]
  const trendSeries = analysis.series.filter((s) => s.points.length >= 2)

  return (
    <>
      {header}

      <div className="stagger grid gap-4 sm:grid-cols-3">
        <StatTile label="Referti archiviati" value={String(analysis.reports.length)} hint={`${kinds.length} ${kinds.length === 1 ? "tipo di esame" : "tipi di esame"}`} />
        <StatTile
          label="Ultimo esame"
          value={formatDate(analysis.reports[0]?.report_date ?? null, "short")}
          hint={analysis.reports[0]?.title ?? ""}
        />
        <StatTile
          label="Prossimo controllo"
          value={nextDue ? formatDate(nextDue.dueDate, "short") : "—"}
          hint={nextDue ? `${nextDue.label}${nextDue.status === "overdue" ? " · scaduto" : ""}` : "Nessuna scadenza"}
          tone={nextDue?.status === "overdue" ? "warn" : undefined}
        />
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <section>
          <SectionHeader title="Osservazioni" description="Cosa emerge dagli ultimi referti di ciascun tipo" />
          <GlassCard className="p-4">
            <InsightList insights={analysis.insights} />
          </GlassCard>
        </section>
        <section>
          <SectionHeader icon={CalendarClock} title="Scadenze" description="Dal referto o dagli intervalli consigliati" />
          <GlassCard className="p-4">
            <UpcomingList items={analysis.upcoming} />
          </GlassCard>
        </section>
      </div>

      {trendSeries.length > 0 && (
        <section className="mt-8">
          <SectionHeader title="Misure nel tempo" description="Fascia verde = intervallo di riferimento" />
          <div className="stagger grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {trendSeries.map((s) => {
              const last = s.points[s.points.length - 1]
              const range = defaultRange(s.code, sex)
              return (
                <GlassCard key={s.code} className="hover-lift p-4">
                  <p className="truncate text-xs font-medium text-muted-foreground">{s.label}</p>
                  <div className="mt-1 flex items-end justify-between gap-2">
                    <p className="font-display text-2xl font-semibold tabular">
                      {formatNumber(last?.value, s.digits)}
                      {s.unit && <span className="ml-1 text-xs font-medium text-muted-foreground">{s.unit}</span>}
                    </p>
                    {last && <LabStatusBadge flag={last.flag} />}
                  </div>
                  <RangeSparkline className="mt-2 h-9 w-full" values={s.points.map((p) => p.value)} refLow={range.low} refHigh={range.high} />
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {s.points.length} misure · dal {formatDate(s.points[0]?.date ?? null, "short")}
                  </p>
                </GlassCard>
              )
            })}
          </div>
        </section>
      )}

      <section className="mt-8">
        <SectionHeader
          title="Archivio"
          description="Tocca un referto per vedere misure, reperti e indicazioni"
          actions={
            kinds.length > 1 && (
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtra per tipo">
                <FilterChip active={kind === "all"} onClick={() => setKind("all")}>
                  Tutti
                </FilterChip>
                {kinds.map((k) => (
                  <FilterChip key={k} active={kind === k} onClick={() => setKind(k)}>
                    {MEDICAL_KIND_LABELS[k]}
                  </FilterChip>
                ))}
              </div>
            )
          }
        />
        <div className="space-y-3">
          {visible.map((r) => (
            <ReportCard key={r.id} report={r} sex={sex} />
          ))}
        </div>
      </section>

      <p className="mt-8 text-center text-[11px] text-muted-foreground">
        I riferimenti sono generali per adulti e non sostituiscono il giudizio del medico che ha firmato il referto.
      </p>
    </>
  )
}

function StatTile({ label, value, hint, tone }: { label: string; value: string; hint: string; tone?: "warn" }) {
  return (
    <GlassCard className="p-5">
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <p className={cn("mt-3 font-display text-2xl font-semibold tabular", tone === "warn" && "text-warn")}>{value}</p>
      <p className="mt-1 truncate text-xs text-muted-foreground">{hint}</p>
    </GlassCard>
  )
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "h-8 rounded-full border px-3 text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active ? "border-neon/40 bg-neon/10 text-neon" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  )
}

const DUE_STYLE: Record<UpcomingCheck["status"], string> = {
  overdue: "bg-danger/10 text-danger ring-danger/25",
  soon: "bg-warn/10 text-warn ring-warn/25",
  planned: "bg-muted text-muted-foreground ring-border",
}

function UpcomingList({ items }: { items: UpcomingCheck[] }) {
  if (items.length === 0) {
    return <p className="py-6 text-center text-xs text-muted-foreground">Nessun controllo da programmare.</p>
  }
  return (
    <ul className="space-y-2">
      {items.map((u) => (
        <li key={u.kind} className="surface-inset flex items-center justify-between gap-3 rounded-xl p-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{u.label}</p>
            <p className="text-[11px] text-muted-foreground">
              Ultimo {formatDate(u.lastDate, "short")} · {u.fromReport ? "indicato dal medico" : "intervallo consigliato"}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold tabular">{formatDate(u.dueDate, "short")}</p>
            <span className={cn("mt-0.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset", DUE_STYLE[u.status])}>
              {u.status === "overdue" ? `scaduto da ${Math.abs(u.daysLeft)} gg` : u.status === "soon" ? `tra ${u.daysLeft} gg` : "programmato"}
            </span>
          </div>
        </li>
      ))}
    </ul>
  )
}

function ReportCard({ report: r, sex }: { report: MedicalReport; sex: Sex | null }) {
  const [open, setOpen] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const del = useDeleteMedicalReport()
  const play = useSound()

  async function remove() {
    try {
      await del.mutateAsync(r.id)
      setConfirm(false)
      play("uncheck")
      toast.success("Referto eliminato")
    } catch (e) {
      toast.error("Eliminazione non riuscita", { description: e instanceof Error ? e.message : undefined })
    }
  }

  return (
    <GlassCard className="overflow-hidden">
      <button
        type="button"
        onClick={() => {
          setOpen((o) => !o)
          play("tap")
        }}
        aria-expanded={open}
        className="flex w-full items-center gap-4 p-4 text-left outline-none transition-colors hover:bg-accent/30 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <div className="grid w-14 shrink-0 place-items-center rounded-xl bg-accent/50 py-2 text-center ring-1 ring-inset ring-border">
          <span className="text-lg font-semibold leading-none tabular">{r.report_date.slice(8, 10)}</span>
          <span className="mt-0.5 text-[10px] uppercase text-muted-foreground">
            {new Intl.DateTimeFormat("it-IT", { month: "short" }).format(new Date(`${r.report_date}T00:00:00`))} {r.report_date.slice(2, 4)}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-semibold">{r.title}</p>
            <OutcomeBadge outcome={r.outcome} />
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {MEDICAL_KIND_LABELS[r.kind]}
            {r.facility && ` · ${r.facility}`}
            {r.measurements.length > 0 && ` · ${r.measurements.length} misure`}
          </p>
        </div>
        <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform duration-300", open && "rotate-180")} />
      </button>

      <div className={cn("grid transition-[grid-template-rows] duration-300 ease-out", open ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
        <div className="overflow-hidden">
          <div className="space-y-4 border-t px-4 pb-4 pt-4">
            {(r.conclusion || r.summary) && (
              <div className="space-y-1 text-sm">
                {r.summary && <p className="text-muted-foreground">{r.summary}</p>}
                {r.conclusion && (
                  <p>
                    <span className="font-medium">Conclusione: </span>
                    {r.conclusion}
                  </p>
                )}
              </div>
            )}

            {r.measurements.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px] text-sm tabular">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                      <th className="py-1.5 pr-3 font-medium">Misura</th>
                      <th className="py-1.5 pr-3 text-right font-medium">Valore</th>
                      <th className="py-1.5 pr-3 text-right font-medium">Riferimento</th>
                      <th className="py-1.5 font-medium">Stato</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.measurements.map((m) => {
                      const range = measureRange(m, sex)
                      const d = measureDigits(m.code)
                      return (
                        <tr key={m.code} className="border-t">
                          <td className="py-1.5 pr-3">{m.label}</td>
                          <td className="whitespace-nowrap py-1.5 pr-3 text-right font-medium">
                            {isNum(m.value) ? formatNumber(m.value, d) : m.value_text}
                            {m.unit && isNum(m.value) && <span className="ml-1 text-xs font-normal text-muted-foreground">{m.unit}</span>}
                          </td>
                          <td className="whitespace-nowrap py-1.5 pr-3 text-right text-muted-foreground">
                            {isNum(range.low) && isNum(range.high)
                              ? `${formatNumber(range.low, d)}–${formatNumber(range.high, d)}`
                              : isNum(range.high)
                                ? `≤ ${formatNumber(range.high, d)}`
                                : isNum(range.low)
                                  ? `≥ ${formatNumber(range.low, d)}`
                                  : "—"}
                          </td>
                          <td className="py-1.5">{isNum(m.value) ? <LabStatusBadge flag={measureFlag(m, sex)} /> : null}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {(r.findings.length > 0 || r.recommendations.length > 0) && (
              <div className="grid gap-4 text-sm sm:grid-cols-2">
                {r.findings.length > 0 && (
                  <div>
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Reperti</p>
                    <ul className="list-inside list-disc space-y-0.5">
                      {r.findings.map((f) => (
                        <li key={f}>{f}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {r.recommendations.length > 0 && (
                  <div>
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Indicazioni del medico</p>
                    <ul className="list-inside list-disc space-y-0.5">
                      {r.recommendations.map((f) => (
                        <li key={f}>{f}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>
                {r.physician && `${r.physician} · `}
                {r.next_check_date ? `Prossimo controllo ${formatDate(r.next_check_date, "long")}` : "Nessuna data di controllo indicata"}
              </span>
              <Button variant="ghost" size="sm" className="rounded-xl text-danger hover:text-danger" onClick={() => setConfirm(true)}>
                <Trash2 className="size-4" />
                Elimina
              </Button>
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Eliminare questo referto?"
        description={`${r.title} del ${formatDate(r.report_date, "long")} verrà eliminato definitivamente.`}
        pending={del.isPending}
        onConfirm={remove}
      />
    </GlassCard>
  )
}
