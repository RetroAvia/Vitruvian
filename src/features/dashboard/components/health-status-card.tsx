"use client"

import { CircleCheck, ClipboardCopy, FileText, Info, ShieldAlert, TriangleAlert, type LucideIcon } from "lucide-react"
import Link from "next/link"
import { AnimatePresence, m } from "motion/react"
import { useState } from "react"
import { toast } from "sonner"

import { Segmented } from "@/components/charts/chart-card"
import { GlassCard } from "@/components/shared/glass-card"
import { Button } from "@/components/ui/button"
import type { Insight, InsightKind } from "@/features/biometrics/engine/insights"
import { cn } from "@/lib/utils"

const KIND: Record<InsightKind, { icon: LucideIcon; label: string; className: string }> = {
  alert: { icon: ShieldAlert, label: "Da segnalare", className: "text-danger bg-danger/10 ring-danger/25" },
  watch: { icon: TriangleAlert, label: "Da monitorare", className: "text-warn bg-warn/10 ring-warn/25" },
  strength: { icon: CircleCheck, label: "Punto di forza", className: "text-gain bg-gain/10 ring-gain/25" },
  info: { icon: Info, label: "Info", className: "text-muted-foreground bg-muted ring-border" },
}

type Filter = "all" | "issues" | "strength"

const COLLAPSED = 4

export function HealthStatusCard({ insights, notes }: { insights: Insight[]; notes: string }) {
  const [filter, setFilter] = useState<Filter>("all")
  const [expanded, setExpanded] = useState(false)
  const counts = {
    issues: insights.filter((i) => i.kind === "alert" || i.kind === "watch").length,
    strength: insights.filter((i) => i.kind === "strength").length,
  }
  const filtered = insights.filter((i) =>
    filter === "all" ? true : filter === "issues" ? i.kind === "alert" || i.kind === "watch" : i.kind === "strength",
  )
  const visible = expanded ? filtered : filtered.slice(0, COLLAPSED)

  async function copyNotes() {
    try {
      await navigator.clipboard.writeText(notes)
      toast.success("Note copiate", { description: "Incollale nelle note o inviale al nutrizionista." })
    } catch {
      toast.error("Copia non riuscita")
    }
  }

  return (
    <GlassCard className="flex flex-col p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold">Stato di salute biometrico</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {counts.strength} punti di forza · {counts.issues} {counts.issues === 1 ? "elemento" : "elementi"} da discutere
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="rounded-lg" onClick={() => void copyNotes()}>
            <ClipboardCopy className="size-3.5" /> Copia note
          </Button>
          <Button asChild variant="outline" size="sm" className="rounded-lg">
            <Link href="/report">
              <FileText className="size-3.5" /> Report
            </Link>
          </Button>
        </div>
      </div>

      <div className="mt-4">
        <Segmented<Filter>
          label="Filtro osservazioni"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: `Tutte (${insights.length})` },
            { value: "issues", label: `Da discutere (${counts.issues})` },
            { value: "strength", label: `Forza (${counts.strength})` },
          ]}
        />
      </div>

      <ul className="mt-4 space-y-2">
        <AnimatePresence initial={false} mode="popLayout">
          {visible.map((i) => {
            const k = KIND[i.kind]
            const Icon = k.icon
            return (
              <m.li
                key={i.id}
                layout
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="surface-inset flex gap-3 rounded-xl p-3"
              >
                <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg ring-1 ring-inset", k.className)}>
                  <Icon className="size-4" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium leading-snug">
                    <span className="sr-only">{k.label}: </span>
                    {i.title}
                  </p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{i.detail}</p>
                </div>
              </m.li>
            )
          })}
        </AnimatePresence>
        {visible.length === 0 && <li className="py-6 text-center text-xs text-muted-foreground">Nessuna osservazione.</li>}
      </ul>
      {filtered.length > COLLAPSED && (
        <Button variant="ghost" size="sm" className="mt-3 self-start rounded-lg text-xs" onClick={() => setExpanded((e) => !e)} aria-expanded={expanded}>
          {expanded ? "Mostra meno" : `Mostra tutte (${filtered.length})`}
        </Button>
      )}
    </GlassCard>
  )
}
