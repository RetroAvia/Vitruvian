"use client"

import { ClipboardList, Download, Plus, ScanLine, Sparkles, TriangleAlert } from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useEffect, useMemo, useState } from "react"

import { EmptyState } from "@/components/shared/empty-state"
import { GlassCard } from "@/components/shared/glass-card"
import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import { NativeSelect } from "@/components/ui/native-select"
import { Skeleton } from "@/components/ui/skeleton"
import { useProfile } from "@/features/profile/api/profile"
import { formatDate, shiftISO, todayISO } from "@/lib/format"
import { cn } from "@/lib/utils"
import { useUiStore, type CheckupColumnGroup } from "@/stores/ui-store"
import type { Checkup } from "@/types/domain"

import { useBiaProtocols, useCheckups, useMeasurementSites } from "../api/queries"
import { buildColumns, COLUMN_GROUP_LABELS, toCsv } from "../lib/columns"
import { CheckupFormDialog } from "./checkup-form-dialog"
import { CheckupsTable } from "./checkups-table"
import { DeleteCheckupDialog } from "./delete-checkup-dialog"

type Editing = { mode: "new" } | { mode: "edit"; checkup: Checkup } | null

export function CheckupsView() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const checkupsQ = useCheckups()
  const sitesQ = useMeasurementSites()
  const protocolsQ = useBiaProtocols()
  const profileQ = useProfile()

  const columnGroups = useUiStore((s) => s.checkupColumns)
  const toggleColumn = useUiStore((s) => s.toggleCheckupColumn)
  const showDeltas = useUiStore((s) => s.showDeltas)
  const setShowDeltas = useUiStore((s) => s.setShowDeltas)

  const [editing, setEditing] = useState<Editing>(null)
  const [deleting, setDeleting] = useState<Checkup | null>(null)
  const [period, setPeriod] = useState<string>("all")
  const [protocolFilter, setProtocolFilter] = useState<string>("all")

  // ?new=1 (dal pulsante "Nuova visita" della topbar) apre il form
  useEffect(() => {
    if (searchParams.get("new") === "1") {
      setEditing({ mode: "new" })
      router.replace(pathname, { scroll: false })
    }
  }, [searchParams, router, pathname])

  const checkups = useMemo(() => checkupsQ.data ?? [], [checkupsQ.data])
  const sites = useMemo(() => sitesQ.data ?? [], [sitesQ.data])
  const protocols = useMemo(() => protocolsQ.data ?? [], [protocolsQ.data])

  const years = useMemo(
    () => [...new Set(checkups.map((c) => c.checkup_date.slice(0, 4)))].sort().reverse(),
    [checkups],
  )

  const filtered = useMemo(() => {
    const cutoffISO = shiftISO(todayISO(), -365)
    return checkups.filter((c) => {
      if (period === "12m" && c.checkup_date < cutoffISO) return false
      if (/^\d{4}$/.test(period) && !c.checkup_date.startsWith(period)) return false
      if (protocolFilter === "none" && c.protocol_id !== null) return false
      if (protocolFilter !== "all" && protocolFilter !== "none" && c.protocol_id !== protocolFilter) return false
      return true
    })
  }, [checkups, period, protocolFilter])

  const allColumns = useMemo(() => buildColumns(checkups, sites), [checkups, sites])
  const columns = useMemo(
    () => allColumns.filter((c) => c.group === "base" || columnGroups.includes(c.group)),
    [allColumns, columnGroups],
  )

  function exportCsv() {
    const csv = toCsv(filtered, columns)
    const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `vitruvian-visite-${todayISO()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const header = (
    <PageHeader
      icon={ClipboardList}
      title="Visite"
      description="Ogni controllo dal nutrizionista: peso, BIA e circonferenze. Clicca una riga per modificarla, usa ⋯ per eliminarla."
      actions={
        <>
          <Button variant="outline" className="rounded-xl" onClick={exportCsv} disabled={filtered.length === 0}>
            <Download className="size-4" /> Esporta CSV
          </Button>
          <Button asChild variant="outline" className="rounded-xl">
            <Link href="/bridge?tab=checkups">
              <Sparkles className="size-4" /> Importa con AI
            </Link>
          </Button>
          <Button className="rounded-xl" onClick={() => setEditing({ mode: "new" })}>
            <Plus className="size-4" /> Nuova visita
          </Button>
        </>
      }
    />
  )

  const loading = checkupsQ.isPending || sitesQ.isPending || protocolsQ.isPending
  const error = checkupsQ.error ?? sitesQ.error ?? protocolsQ.error

  return (
    <>
      {header}

      {loading ? (
        <Skeleton className="h-[480px] rounded-2xl" />
      ) : error ? (
        <EmptyState icon={TriangleAlert} title="Impossibile caricare le visite" description={error.message} />
      ) : checkups.length === 0 ? (
        <EmptyState
          icon={ScanLine}
          title="Nessuna visita registrata"
          description="Aggiungi il primo controllo: bastano data e peso, il resto è facoltativo."
          action={
            <Button className="rounded-xl" onClick={() => setEditing({ mode: "new" })}>
              <Plus className="size-4" /> Aggiungi visita
            </Button>
          }
        />
      ) : (
        <GlassCard className="overflow-hidden">
          {/* Toolbar */}
          <div className="flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <NativeSelect
                aria-label="Periodo"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="h-9 w-44 rounded-lg"
              >
                <option value="all">Tutto lo storico</option>
                <option value="12m">Ultimi 12 mesi</option>
                {years.map((y) => (
                  <option key={y} value={y}>
                    Anno {y}
                  </option>
                ))}
              </NativeSelect>
              {protocols.length > 0 && (
                <NativeSelect
                  aria-label="Strumento BIA"
                  value={protocolFilter}
                  onChange={(e) => setProtocolFilter(e.target.value)}
                  className="h-9 w-52 rounded-lg"
                >
                  <option value="all">Tutti gli strumenti</option>
                  {protocols.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                  <option value="none">Senza strumento</option>
                </NativeSelect>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Colonne visibili">
              {(Object.keys(COLUMN_GROUP_LABELS) as CheckupColumnGroup[]).map((g) => {
                const active = columnGroups.includes(g)
                return (
                  <button
                    key={g}
                    type="button"
                    aria-pressed={active}
                    onClick={() => toggleColumn(g)}
                    className={cn(
                      "h-8 rounded-full border px-3 text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      active
                        ? "border-neon/40 bg-neon/10 text-neon"
                        : "border-border text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {COLUMN_GROUP_LABELS[g]}
                  </button>
                )
              })}
              <span className="mx-1 h-5 w-px bg-border" aria-hidden />
              <button
                type="button"
                aria-pressed={showDeltas}
                onClick={() => setShowDeltas(!showDeltas)}
                className={cn(
                  "h-8 rounded-full border px-3 text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  showDeltas
                    ? "border-gain/40 bg-gain/10 text-gain"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                Variazioni
              </button>
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
              <ClipboardList className="size-6 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Nessuna visita corrisponde ai filtri.</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setPeriod("all")
                  setProtocolFilter("all")
                }}
              >
                Rimuovi filtri
              </Button>
            </div>
          ) : (
            <CheckupsTable
              rows={filtered}
              allChronological={checkups}
              columns={columns}
              showDeltas={showDeltas}
              onEdit={(c) => setEditing({ mode: "edit", checkup: c })}
              onDelete={setDeleting}
            />
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-3 text-xs text-muted-foreground">
            <span>
              {filtered.length} {filtered.length === 1 ? "visita" : "visite"}
              {filtered.length > 0 &&
                ` · dal ${formatDate(filtered[0]?.checkup_date)} al ${formatDate(filtered[filtered.length - 1]?.checkup_date)}`}
            </span>
            <span className="hidden sm:inline">Variazioni BIA calcolate solo tra visite con lo stesso strumento</span>
          </div>
        </GlassCard>
      )}

      <CheckupFormDialog
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        checkup={editing?.mode === "edit" ? editing.checkup : undefined}
        checkups={checkups}
        sites={sites}
        protocols={protocols}
        heightCm={profileQ.data?.height_cm ?? null}
      />
      <DeleteCheckupDialog checkup={deleting} onOpenChange={(o) => !o && setDeleting(null)} />
    </>
  )
}
