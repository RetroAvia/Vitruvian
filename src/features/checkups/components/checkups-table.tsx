"use client"

import { ArrowDown, ArrowUp, ArrowUpDown, MoreHorizontal, Pencil, Repeat, Trash2 } from "lucide-react"
import { Fragment, useMemo, useState } from "react"

import { DeltaPill } from "@/components/shared/delta-pill"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { formatDate, formatNumber, isNum } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { Checkup } from "@/types/domain"

import type { CheckupColumn } from "../lib/columns"

type SortState = { id: string; dir: "asc" | "desc" }

interface CheckupsTableProps {
  rows: Checkup[]
  /** Tutte le visite in ordine cronologico (per calcolare i delta anche con filtri attivi) */
  allChronological: Checkup[]
  columns: CheckupColumn[]
  showDeltas: boolean
  onEdit: (c: Checkup) => void
  onDelete: (c: Checkup) => void
}

export function CheckupsTable({ rows, allChronological, columns, showDeltas, onEdit, onDelete }: CheckupsTableProps) {
  const [sort, setSort] = useState<SortState>({ id: "date", dir: "desc" })

  // Visita precedente (cronologica) per ciascuna visita
  const prevById = useMemo(() => {
    const map = new Map<string, Checkup>()
    allChronological.forEach((c, i) => {
      const p = allChronological[i - 1]
      if (p) map.set(c.id, p)
    })
    return map
  }, [allChronological])

  const sorted = useMemo(() => {
    const col = columns.find((c) => c.id === sort.id)
    const factor = sort.dir === "asc" ? 1 : -1
    return [...rows].sort((a, b) => {
      if (!col) return a.checkup_date.localeCompare(b.checkup_date) * factor
      const va = col.get(a)
      const vb = col.get(b)
      if (va === null && vb === null) return 0
      if (va === null) return 1 // i vuoti sempre in fondo
      if (vb === null) return -1
      return (va - vb) * factor
    })
  }, [rows, columns, sort])

  const byDate = sort.id === "date"

  function toggleSort(id: string) {
    setSort((s) => (s.id === id ? { id, dir: s.dir === "asc" ? "desc" : "asc" } : { id, dir: id === "date" ? "desc" : "desc" }))
  }

  const SortIcon = ({ id }: { id: string }) =>
    sort.id !== id ? (
      <ArrowUpDown className="size-3 opacity-40" />
    ) : sort.dir === "asc" ? (
      <ArrowUp className="size-3 text-neon" />
    ) : (
      <ArrowDown className="size-3 text-neon" />
    )

  const ariaSort = (id: string) => (sort.id === id ? (sort.dir === "asc" ? "ascending" : "descending") : "none")

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-0 text-sm tabular">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
            <th
              scope="col"
              aria-sort={ariaSort("date")}
              className="sticky left-0 z-10 border-b bg-card/95 px-4 py-3 font-medium backdrop-blur"
            >
              <button type="button" onClick={() => toggleSort("date")} className="inline-flex items-center gap-1.5 hover:text-foreground">
                Data <SortIcon id="date" />
              </button>
            </th>
            {columns.map((col) => (
              <th key={col.id} scope="col" aria-sort={ariaSort(col.id)} className="whitespace-nowrap border-b px-3 py-3 text-right font-medium">
                <button
                  type="button"
                  onClick={() => toggleSort(col.id)}
                  className="inline-flex items-center gap-1.5 hover:text-foreground"
                >
                  <SortIcon id={col.id} />
                  <span>
                    {col.label}
                    {col.unit && <span className="ml-0.5 normal-case opacity-60">{col.unit}</span>}
                  </span>
                </button>
              </th>
            ))}
            <th scope="col" className="border-b px-2 py-3">
              <span className="sr-only">Azioni</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => {
            const prev = prevById.get(row.id)
            const sameProtocol = prev ? prev.protocol_id === row.protocol_id : false
            // Divisore quando cambia lo strumento BIA (solo in ordine cronologico)
            const neighbour = sorted[i - 1]
            const protocolChanged =
              byDate &&
              neighbour !== undefined &&
              neighbour.protocol_id !== row.protocol_id &&
              (neighbour.protocol_id !== null || row.protocol_id !== null)
            const newer = sort.dir === "desc" ? neighbour : row

            return (
              <Fragment key={row.id}>
                {protocolChanged && (
                  <tr aria-hidden>
                    <td colSpan={columns.length + 2} className="border-b border-bia/20 bg-bia/[0.06] px-4 py-1.5">
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-bia">
                        <Repeat className="size-3" />
                        Cambio strumento BIA → {newer?.protocol_name ?? "non specificato"} · i delta BIA ripartono da qui
                      </span>
                    </td>
                  </tr>
                )}
                <tr className="group cursor-pointer transition-colors hover:bg-accent/40" onClick={() => onEdit(row)}>
                  <th
                    scope="row"
                    className="sticky left-0 z-10 whitespace-nowrap border-b bg-card/95 px-4 py-2.5 text-left font-medium backdrop-blur group-hover:bg-accent/60"
                  >
                    <button
                      type="button"
                      className="rounded outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      onClick={(e) => {
                        e.stopPropagation()
                        onEdit(row)
                      }}
                      aria-label={`Modifica visita del ${formatDate(row.checkup_date, "long")}`}
                    >
                      {formatDate(row.checkup_date)}
                    </button>
                  </th>
                  {columns.map((col) => {
                    const v = col.get(row)
                    const p = prev && (!col.bia || sameProtocol) ? col.get(prev) : null
                    const d = isNum(v) && isNum(p) ? v - p : null
                    return (
                      <td key={col.id} className="whitespace-nowrap border-b px-3 py-2.5 text-right align-top">
                        <div className={cn(v === null && "text-muted-foreground/50")}>{formatNumber(v, col.digits)}</div>
                        {showDeltas && d !== null && (
                          <DeltaPill
                            value={d}
                            digits={col.digits}
                            polarity={col.polarity}
                            className="mt-0.5 px-1.5 py-0 text-[10px] [&_svg]:size-3"
                          />
                        )}
                      </td>
                    )
                  })}
                  <td className="border-b px-2 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu modal={false}>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-8 rounded-lg" aria-label="Azioni visita">
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => onEdit(row)}>
                          <Pencil /> Modifica
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="destructive" onSelect={() => onDelete(row)}>
                          <Trash2 /> Elimina
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
