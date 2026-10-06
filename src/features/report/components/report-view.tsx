"use client"

import { ClipboardCopy, FileText, Printer, TriangleAlert } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"

import { useSessionUser } from "@/components/layout/session-user-context"
import { EmptyState } from "@/components/shared/empty-state"
import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { ACTIVITY_LEVELS, SEX_LABELS } from "@/config/constants"
import { computeDelta, type DeltaBase } from "@/features/biometrics/engine/deltas"
import { computeGoals } from "@/features/biometrics/engine/goals"
import { METRICS, type MetricKey } from "@/features/biometrics/engine/metrics"
import { useBiometricReport } from "@/features/biometrics/hooks/use-biometric-report"
import { useLabResults } from "@/features/labs/api/labs"
import { derivedFlag } from "@/features/labs/engine/derived"
import { analyzeLabs } from "@/features/labs/engine/report"
import { FLAG_LABELS } from "@/features/labs/engine/status"
import { useDietPlans, useMealLogs, usePlanTree } from "@/features/nutrition/api/nutrition"
import { adherenceScore, adherenceSeries } from "@/features/nutrition/engine/adherence"
import { energyBalance, perKg } from "@/features/nutrition/engine/balance"
import { dayForDate, dayTotals } from "@/features/nutrition/engine/totals"
import { formatDate, formatNumber, formatSigned, isNum, todayISO } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { Checkup } from "@/types/domain"

const ROWS: MetricKey[] = ["weight", "fat_pct", "fat_kg", "ffm", "bmr", "tbw_pct", "visceral", "waist", "abdomen", "chest", "arm", "thigh", "ffmi", "whtr"]
const BASES: DeltaBase[] = ["previous", "segment", "baseline"]
const NOTES_KEY = "vitruvian-report-questions"

function Section({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("break-inside-avoid", className)}>
      <h2 className="mb-3 border-b pb-1.5 text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">{title}</h2>
      {children}
    </section>
  )
}

export function ReportView() {
  const user = useSessionUser()
  const { report, profile, isPending, error } = useBiometricReport()
  const labsQ = useLabResults()
  const plansQ = useDietPlans()
  const activePlan = plansQ.data?.find((p) => p.is_active) ?? null
  const treeQ = usePlanTree(activePlan?.id ?? null)
  const from = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    return d.toISOString().slice(0, 10)
  }, [])
  const logsQ = useMealLogs(from)

  const [questions, setQuestions] = useState("")
  useEffect(() => {
    try {
      setQuestions(localStorage.getItem(NOTES_KEY) ?? "")
    } catch {
      /* storage non disponibile */
    }
  }, [])
  function saveQuestions(v: string) {
    setQuestions(v)
    try {
      localStorage.setItem(NOTES_KEY, v)
    } catch {
      /* ignora */
    }
  }

  const labs = useMemo(
    () => (labsQ.data && labsQ.data.length > 0 ? analyzeLabs(labsQ.data, profile) : null),
    [labsQ.data, profile],
  )

  const nutrition = useMemo(() => {
    const tree = treeQ.data
    if (!tree || !report) return null
    const day = dayForDate(tree.days, todayISO())
    const totals = day ? dayTotals(day) : null
    const kcal = tree.plan.target_kcal ?? (totals && totals.kcal > 0 ? totals.kcal : null)
    const balance = energyBalance(kcal, report.energy.tdee, report.energy.bmr)
    const protein = totals && totals.protein_g > 0 ? totals.protein_g : tree.plan.target_protein_g
    const adh = adherenceScore(adherenceSeries(tree.days, logsQ.data ?? [], todayISO(), 14, tree.plan.valid_from))
    return { plan: tree.plan, kcal, balance, proteinKg: perKg(protein, report.latest?.weight_kg), adh }
  }, [treeQ.data, report, logsQ.data])

  const header = (
    <PageHeader
      icon={FileText}
      title="Report per il nutrizionista"
      description="Riepilogo da stampare o salvare in PDF prima del controllo. Le sezioni si compilano da sole con i tuoi dati."
      className="no-print"
      actions={
        <>
          <Button
            variant="outline"
            className="rounded-xl"
            onClick={() => {
              void navigator.clipboard.writeText(report?.notes ?? "").then(
                () => toast.success("Testo copiato"),
                () => toast.error("Copia non riuscita"),
              )
            }}
          >
            <ClipboardCopy className="size-4" /> Copia testo
          </Button>
          <Button className="rounded-xl" onClick={() => window.print()}>
            <Printer className="size-4" /> Stampa / PDF
          </Button>
        </>
      }
    />
  )

  if (isPending) {
    return (
      <>
        {header}
        <Skeleton className="h-[600px] rounded-2xl" />
      </>
    )
  }
  if (error || !report?.latest) {
    return (
      <>
        {header}
        <EmptyState icon={TriangleAlert} title="Dati insufficienti" description={error?.message ?? "Registra almeno una visita."} />
      </>
    )
  }

  const latest = report.latest
  const latestBia = report.latestBia ?? latest
  const goals = computeGoals(profile, report.chronological)
  const issues = report.insights.filter((i) => i.kind === "alert" || i.kind === "watch")
  const strengths = report.insights.filter((i) => i.kind === "strength")

  return (
    <>
      {header}
      <article className="print-sheet glass-raised mx-auto max-w-4xl space-y-8 rounded-2xl p-6 text-sm sm:p-10">
        {/* Intestazione */}
        <header className="flex flex-col gap-4 border-b pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neon">Vitruvian · Report di composizione corporea</p>
            <h1 className="mt-1 text-2xl font-semibold">{profile?.display_name || user.displayName}</h1>
            <p className="mt-1 text-muted-foreground">
              {[
                profile?.sex ? SEX_LABELS[profile.sex] : null,
                report.age !== null ? `${report.age} anni` : null,
                profile?.height_cm ? `${formatNumber(profile.height_cm, 0)} cm` : null,
                profile?.activity_level ? `attività ${ACTIVITY_LEVELS[profile.activity_level].label.toLowerCase()}` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          <div className="text-left sm:text-right">
            <p className="text-muted-foreground">Generato il {formatDate(todayISO(), "long")}</p>
            <p>
              Ultima misura: <strong>{formatDate(latest.checkup_date, "long")}</strong>
            </p>
            {latest.protocol_name && <p className="text-muted-foreground">Strumento: {latest.protocol_name}</p>}
          </div>
        </header>

        <Section title="Misure e variazioni">
          <div className="overflow-x-auto">
            <table className="w-full tabular">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="py-1.5 pr-3 font-medium">Parametro</th>
                  <th className="py-1.5 pr-3 text-right font-medium">Attuale</th>
                  <th className="py-1.5 pr-3 text-right font-medium">vs precedente</th>
                  <th className="py-1.5 pr-3 text-right font-medium">vs inizio strumento</th>
                  <th className="py-1.5 text-right font-medium">vs prima visita</th>
                </tr>
              </thead>
              <tbody>
                {ROWS.map((k) => {
                  const m = METRICS[k]
                  const target: Checkup = m.bia ? latestBia : latest
                  const v = m.get(target)
                  if (!isNum(v)) return null
                  return (
                    <tr key={k} className="border-t">
                      <td className="py-1.5 pr-3">
                        {m.label}
                        {m.unit && <span className="text-muted-foreground"> ({m.unit})</span>}
                      </td>
                      <td className="py-1.5 pr-3 text-right font-semibold">{formatNumber(v, m.digits)}</td>
                      {BASES.map((b) => {
                        const d = computeDelta(report.chronological, report.segments, target, m, b)
                        return (
                          <td key={b} className="py-1.5 pr-3 text-right last:pr-0">
                            {d.value !== null ? formatSigned(d.value, m.digits) : d.comparable ? "—" : "n.c."}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            n.c. = non confrontabile: valore BIA misurato con uno strumento diverso. Massa magra (FFM) = peso − massa grassa.
          </p>
        </Section>

        {(report.lastRecomp || report.segmentRecomp) && (
          <Section title="Ricomposizione corporea">
            <ul className="space-y-1.5">
              {[report.lastRecomp, report.segmentRecomp].map((r, i) =>
                r && r.type !== "insufficient" && r.from ? (
                  <li key={i}>
                    <strong>{i === 0 ? "Ultimo intervallo" : "Con lo strumento attuale"}</strong> ({formatDate(r.from.checkup_date, "medium")} →{" "}
                    {formatDate(r.to.checkup_date, "medium")}): {r.title.toLowerCase()} — grasso {formatSigned(r.dFatKg, 1)} kg, massa magra{" "}
                    {formatSigned(r.dFfmKg, 1)} kg{r.dWaist !== null ? `, vita ${formatSigned(r.dWaist, 1)} cm` : ""}.
                  </li>
                ) : null,
              )}
            </ul>
          </Section>
        )}

        <div className="grid gap-8 sm:grid-cols-2">
          <Section title="Da discutere">
            {issues.length === 0 ? (
              <p className="text-muted-foreground">Nessuna anomalia rilevata.</p>
            ) : (
              <ul className="list-disc space-y-1.5 pl-4">
                {issues.map((i) => (
                  <li key={i.id}>
                    <strong>{i.title}.</strong> <span className="text-muted-foreground">{i.detail}</span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
          <Section title="Punti di forza">
            <ul className="list-disc space-y-1.5 pl-4">
              {strengths.map((i) => (
                <li key={i.id}>{i.title}</li>
              ))}
            </ul>
          </Section>
        </div>

        {goals.length > 0 && (
          <Section title="Obiettivi">
            <ul className="grid gap-2 sm:grid-cols-2">
              {goals.map((g) => (
                <li key={g.key}>
                  <strong>{g.label}</strong>: {formatNumber(g.current, g.digits)} → {formatNumber(g.target, g.digits)} {g.unit}{" "}
                  <span className="text-muted-foreground">
                    ({g.achieved ? "raggiunto" : `${formatNumber((g.progress ?? 0) * 100, 0)}% del percorso`})
                  </span>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {nutrition && (
          <Section title="Alimentazione">
            <ul className="space-y-1">
              <li>
                Piano attivo: <strong>{nutrition.plan.name}</strong>
                {nutrition.kcal !== null && ` · ${formatNumber(nutrition.kcal, 0)} kcal`}
              </li>
              {nutrition.balance.status !== "unknown" && (
                <li>
                  Bilancio stimato: {formatSigned(nutrition.balance.delta, 0)} kcal/giorno rispetto al TDEE ({formatNumber(nutrition.balance.tdee, 0)} kcal)
                </li>
              )}
              {nutrition.proteinKg !== null && <li>Proteine: {formatNumber(nutrition.proteinKg, 1)} g/kg di peso</li>}
              {nutrition.adh.score !== null && (
                <li>
                  Aderenza ultime 2 settimane: {formatNumber(nutrition.adh.score * 100, 0)}% ({nutrition.adh.trackedDays} giorni registrati)
                </li>
              )}
            </ul>
          </Section>
        )}

        {labs && labs.latestDate && (
          <Section title={`Analisi del sangue · ${formatDate(labs.latestDate, "long")}`}>
            {labs.series.filter((s) => s.latest.date === labs.latestDate && (s.latest.flag === "high" || s.latest.flag === "low")).length === 0 ? (
              <p>Tutti gli esami con range di riferimento sono nella norma.</p>
            ) : (
              <ul className="list-disc space-y-1 pl-4">
                {labs.series
                  .filter((s) => s.latest.date === labs.latestDate && (s.latest.flag === "high" || s.latest.flag === "low"))
                  .map((s) => (
                    <li key={s.code}>
                      <strong>{s.name}</strong>: {formatNumber(s.latest.value, s.digits)} {s.unit} — {FLAG_LABELS[s.latest.flag].toLowerCase()}
                    </li>
                  ))}
              </ul>
            )}
            {labs.derived.length > 0 && (
              <p className="mt-2 text-muted-foreground">
                Indici:{" "}
                {labs.derived
                  .map((d) => `${d.name} ${formatNumber(d.points[d.points.length - 1]?.value, d.digits)} (${FLAG_LABELS[derivedFlag(d)].toLowerCase()})`)
                  .join(" · ")}
              </p>
            )}
          </Section>
        )}

        <Section title="Domande e note per il controllo">
          <Textarea
            value={questions}
            onChange={(e) => saveQuestions(e.target.value)}
            rows={5}
            placeholder="Scrivi qui le domande da fare al nutrizionista (restano salvate su questo dispositivo)…"
            className="rounded-lg print:border-0 print:p-0"
          />
        </Section>

        <footer className="border-t pt-4 text-[11px] text-muted-foreground">
          Valori indicativi calcolati da Vitruvian sui dati inseriti; non costituiscono diagnosi medica.
        </footer>
      </article>
    </>
  )
}
