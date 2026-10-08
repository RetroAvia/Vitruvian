"use client"

import dynamic from "next/dynamic"
import { FlaskConical, LoaderCircle, Search, Sparkles, Trash2, TriangleAlert } from "lucide-react"
import Link from "next/link"
import { useMemo, useState } from "react"
import { toast } from "sonner"

import { GlassCard } from "@/components/shared/glass-card"
import { EmptyState } from "@/components/shared/empty-state"
import { InsightList } from "@/components/shared/insight-list"
import { PageHeader } from "@/components/shared/page-header"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { LAB_CATEGORY_LABELS } from "@/config/constants"
import { derivedFlag } from "@/features/labs/engine/derived"
import { analyzeLabs } from "@/features/labs/engine/report"
import type { AnalyteSeries } from "@/features/labs/engine/series"
import { useProfile } from "@/features/profile/api/profile"
import { formatDate, formatNumber, formatSigned, isNum } from "@/lib/format"
import { playSound } from "@/lib/sound"
import { cn } from "@/lib/utils"
import type { LabCategory, LabReport } from "@/types/domain"

import { useDeleteLabReport, useLabReports, useLabResults } from "../api/labs"
import { LabStatusBadge } from "./lab-status"
import { RangeSparkline } from "./range-sparkline"

// Grafici caricati su richiesta: Recharts non pesa sul primo caricamento
const AnalyteDialog = dynamic(() => import("./analyte-dialog").then((m) => m.AnalyteDialog), { ssr: false, loading: () => null })

export function LabsView() {
  const resultsQ = useLabResults()
  const reportsQ = useLabReports()
  const profileQ = useProfile()

  const [category, setCategory] = useState<LabCategory | "all">("all")
  const [onlyOut, setOnlyOut] = useState(false)
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState<AnalyteSeries | null>(null)
  const [deleting, setDeleting] = useState<LabReport | null>(null)

  const summary = useMemo(
    () => (resultsQ.data ? analyzeLabs(resultsQ.data, profileQ.data ?? null) : null),
    [resultsQ.data, profileQ.data],
  )

  const header = (
    <PageHeader
      icon={FlaskConical}
      title="Analisi del sangue"
      description="Valori, range di riferimento e tendenze dei tuoi esami. Indicazioni informative: l'interpretazione spetta al medico."
      actions={
        <Button asChild className="rounded-xl">
          <Link href="/bridge?tab=labs">
            <Sparkles className="size-4" /> Importa referto
          </Link>
        </Button>
      }
    />
  )

  if (resultsQ.isPending || profileQ.isPending) {
    return (
      <>
        {header}
        <Skeleton className="h-96 rounded-2xl" />
      </>
    )
  }
  if (resultsQ.error) {
    return (
      <>
        {header}
        <EmptyState icon={TriangleAlert} title="Impossibile caricare le analisi" description={resultsQ.error.message} />
      </>
    )
  }
  if (!summary || summary.series.length === 0) {
    return (
      <>
        {header}
        <EmptyState
          icon={FlaskConical}
          title="Nessun referto importato"
          description="Copia il prompt dall'AI Bridge, allega il PDF o la foto delle analisi a Gemini, ChatGPT o Claude e incolla qui la risposta."
          action={
            <Button asChild className="rounded-xl">
              <Link href="/bridge?tab=labs">
                <Sparkles className="size-4" /> Vai all&apos;AI Bridge
              </Link>
            </Button>
          }
        />
      </>
    )
  }

  const categories = [...new Set(summary.series.map((s) => s.category))]
  const q = query.trim().toLowerCase()
  const visible = summary.series.filter(
    (s) =>
      (category === "all" || s.category === category) &&
      (!onlyOut || s.latest.flag === "high" || s.latest.flag === "low") &&
      (!q || s.name.toLowerCase().includes(q) || s.code.includes(q)),
  )
  const grouped = categories
    .map((c) => ({ c, items: visible.filter((s) => s.category === c) }))
    .filter((g) => g.items.length > 0)

  return (
    <>
      {header}
      <div className="space-y-6">
        {/* Riepilogo */}
        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          {[
            { l: "Ultimo referto", v: formatDate(summary.latestDate, "medium") },
            { l: "Esami monitorati", v: String(summary.series.length) },
            { l: "Fuori range (ultimo)", v: String(summary.outOfRange) },
          ].map((t) => (
            <GlassCard key={t.l} className="p-3 sm:p-4">
              <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground sm:text-xs">{t.l}</p>
              <p className="mt-1.5 font-display text-base font-semibold sm:text-2xl">{t.v}</p>
            </GlassCard>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
          <GlassCard className="p-5">
            <h2 className="text-sm font-semibold">Osservazioni</h2>
            <p className="mb-4 mt-0.5 text-xs text-muted-foreground">Sull&apos;ultimo referto, con confronto ai precedenti</p>
            <InsightList insights={summary.insights} />
          </GlassCard>

          <GlassCard className="p-5">
            <h2 className="text-sm font-semibold">Indici calcolati</h2>
            <p className="mb-4 mt-0.5 text-xs text-muted-foreground">Ricavati combinando più esami dello stesso prelievo</p>
            {summary.derived.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Servono colesterolo totale, HDL, trigliceridi, glicemia, insulina, AST/ALT o creatinina.
              </p>
            ) : (
              <ul className="space-y-3">
                {summary.derived.map((d) => {
                  const last = d.points[d.points.length - 1]
                  return (
                    <li key={d.code} className="rounded-xl surface-inset p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium">{d.name}</p>
                        <LabStatusBadge flag={derivedFlag(d)} />
                      </div>
                      <p className="mt-1 font-display text-xl font-semibold tabular">
                        {formatNumber(last?.value, d.digits)}
                        {d.unit && <span className="ml-1 text-xs font-normal text-muted-foreground">{d.unit}</span>}
                      </p>
                      <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{d.description}</p>
                    </li>
                  )
                })}
              </ul>
            )}
          </GlassCard>
        </div>

        {/* Filtri */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Categorie">
            {(["all", ...categories] as Array<LabCategory | "all">).map((c) => (
              <button
                key={c}
                type="button"
                aria-pressed={category === c}
                onClick={() => setCategory(c)}
                className={cn(
                  "h-8 rounded-full border px-3 text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  category === c ? "border-neon/40 bg-neon/10 text-neon" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {c === "all" ? "Tutti" : LAB_CATEGORY_LABELS[c]}
              </button>
            ))}
            <button
              type="button"
              aria-pressed={onlyOut}
              onClick={() => setOnlyOut((v) => !v)}
              className={cn(
                "h-8 rounded-full border px-3 text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                onlyOut ? "border-danger/40 bg-danger/10 text-danger" : "text-muted-foreground hover:text-foreground",
              )}
            >
              Solo fuori range
            </button>
          </div>
          <div className="relative w-full lg:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cerca esame…"
              aria-label="Cerca esame"
              className="h-9 rounded-lg pl-9"
            />
          </div>
        </div>

        {/* Esami per categoria */}
        {grouped.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Nessun esame corrisponde ai filtri.</p>
        ) : (
          grouped.map((g) => (
            <section key={g.c} aria-labelledby={`cat-${g.c}`}>
              <h2 id={`cat-${g.c}`} className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {LAB_CATEGORY_LABELS[g.c]}
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {g.items.map((s) => (
                  <AnalyteCard key={s.analyteId} s={s} onOpen={() => setOpen(s)} />
                ))}
              </div>
            </section>
          ))
        )}

        {/* Storico referti */}
        <GlassCard className="p-5">
          <h2 className="text-sm font-semibold">Referti importati</h2>
          <ul className="mt-3 divide-y">
            {(reportsQ.data ?? []).map((r) => {
              const count = resultsQ.data?.filter((x) => x.report_id === r.id).length ?? 0
              return (
                <li key={r.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <div>
                    <p className="font-medium">{formatDate(r.report_date, "long")}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.lab_name ?? "Laboratorio non indicato"} · {count} esami
                      {r.fasting === true && " · a digiuno"}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 rounded-lg text-muted-foreground hover:text-destructive"
                    aria-label={`Elimina referto del ${formatDate(r.report_date)}`}
                    onClick={() => setDeleting(r)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </li>
              )
            })}
          </ul>
        </GlassCard>
      </div>

      <AnalyteDialog series={open} onOpenChange={(o) => !o && setOpen(null)} />
      <DeleteReportDialog report={deleting} onOpenChange={(o) => !o && setDeleting(null)} />
    </>
  )
}

function AnalyteCard({ s, onOpen }: { s: AnalyteSeries; onOpen: () => void }) {
  const v = s.latest.value
  const range =
    isNum(s.latest.refLow) && isNum(s.latest.refHigh)
      ? `${formatNumber(s.latest.refLow, s.digits)}–${formatNumber(s.latest.refHigh, s.digits)}`
      : isNum(s.latest.refHigh)
        ? `< ${formatNumber(s.latest.refHigh, s.digits)}`
        : isNum(s.latest.refLow)
          ? `> ${formatNumber(s.latest.refLow, s.digits)}`
          : null

  return (
    <button
      type="button"
      onClick={onOpen}
      className="glass group rounded-2xl p-4 text-left transition-colors outline-none hover:bg-accent/30 focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{s.name}</p>
          <p className="text-[11px] text-muted-foreground">
            {formatDate(s.latest.date, "medium")}
            {range && ` · range ${range}`}
          </p>
        </div>
        <LabStatusBadge flag={s.latest.flag} />
      </div>
      <div className="mt-3 flex items-end justify-between gap-3">
        <p className="font-display text-2xl font-semibold tabular">
          {isNum(v) ? formatNumber(v, s.digits) : (s.latest.valueText ?? "—")}
          {s.unit && isNum(v) && <span className="ml-1 text-xs font-normal text-muted-foreground">{s.unit}</span>}
        </p>
        <RangeSparkline
          values={s.points.map((p) => p.value)}
          refLow={s.latest.refLow}
          refHigh={s.latest.refHigh}
          className="h-9 w-28 shrink-0"
        />
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">
        {s.delta !== null
          ? `${formatSigned(s.delta, s.digits)} vs precedente`
          : s.points.length === 1
            ? "1 misurazione"
            : `${s.points.length} misurazioni`}
      </p>
    </button>
  )
}

function DeleteReportDialog({ report, onOpenChange }: { report: LabReport | null; onOpenChange: (o: boolean) => void }) {
  const del = useDeleteLabReport()
  async function confirm() {
    if (!report) return
    try {
      await del.mutateAsync(report.id)
      playSound("success")
      toast.success("Referto eliminato")
      onOpenChange(false)
    } catch (e) {
      playSound("error")
      toast.error("Eliminazione non riuscita", { description: e instanceof Error ? e.message : undefined })
    }
  }
  return (
    <AlertDialog open={report !== null} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Eliminare il referto?</AlertDialogTitle>
          <AlertDialogDescription>
            Verranno eliminati tutti gli esami del {report ? formatDate(report.report_date, "long") : ""}
            {report?.lab_name ? ` (${report.lab_name})` : ""}. Potrai reimportarlo dall&apos;AI Bridge.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="rounded-xl">Annulla</AlertDialogCancel>
          <Button variant="destructive" className="rounded-xl" onClick={() => void confirm()} disabled={del.isPending}>
            {del.isPending && <LoaderCircle className="size-4 animate-spin" />}
            Elimina
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
