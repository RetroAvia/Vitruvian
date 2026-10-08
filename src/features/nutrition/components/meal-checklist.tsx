"use client"

import { Check, ChevronLeft, ChevronRight, Repeat, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Emoji } from "@/components/shared/emoji"
import { GlassCard } from "@/components/shared/glass-card"
import { MEAL_SLOT_LABELS } from "@/config/constants"
import { foodEmoji, MEAL_SLOT_EMOJI } from "@/lib/emoji"
import { formatDate, formatNumber, isNum, todayISO } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { MealLogStatus } from "@/types/domain"

import { mealStructure, mealTotals } from "../engine/totals"
import type { DayWithMeals, MealItem, MealLog } from "../types"

const STATUS: Array<{ s: MealLogStatus; label: string; icon: typeof Check; className: string }> = [
  { s: "done", label: "Fatto", icon: Check, className: "bg-gain/15 text-gain ring-gain/40" },
  { s: "swapped", label: "Sostituito", icon: Repeat, className: "bg-bia/15 text-bia ring-bia/40" },
  { s: "skipped", label: "Saltato", icon: X, className: "bg-warn/15 text-warn ring-warn/40" },
]

function shiftISO(iso: string, n: number) {
  const [y, m, d] = iso.split("-").map(Number)
  const dt = new Date(y ?? 1970, (m ?? 1) - 1, (d ?? 1) + n)
  const pad = (x: number) => String(x).padStart(2, "0")
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`
}

function itemText(it: MealItem) {
  return `${it.food_name}${isNum(it.quantity) ? ` · ${formatNumber(it.quantity, 0)} ${it.unit}` : ""}`
}

interface Props {
  day: DayWithMeals
  date: string
  onDateChange: (d: string) => void
  logs: MealLog[]
  onSet: (mealId: string, status: MealLogStatus | null) => void
  /** primo giorno di cui sono caricati i dati (non si torna più indietro) */
  minDate?: string
}

export function MealChecklist({ day, date, onDateChange, logs, onSet, minDate }: Props) {
  const today = todayISO()
  const dayLogs = new Map(logs.filter((l) => l.log_date === date).map((l) => [l.meal_id, l.status]))
  const done = day.meals.filter((m) => dayLogs.get(m.id) === "done").length

  return (
    <GlassCard className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Checklist pasti</h2>
          <p className="text-xs text-muted-foreground">
            {done}/{day.meals.length} pasti completati · {day.label}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="size-8 rounded-lg" aria-label="Giorno precedente" disabled={Boolean(minDate && date <= minDate)} onClick={() => onDateChange(shiftISO(date, -1))}>
            <ChevronLeft className="size-4" />
          </Button>
          <span className="min-w-36 text-center text-sm font-medium">
            {date === today ? "Oggi" : formatDate(date, "medium")}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 rounded-lg"
            aria-label="Giorno successivo"
            disabled={date >= today}
            onClick={() => onDateChange(shiftISO(date, 1))}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
        <div className="h-full rounded-full bg-gain transition-[width] duration-500" style={{ width: `${day.meals.length ? (done / day.meals.length) * 100 : 0}%` }} />
      </div>

      <ul className="mt-4 space-y-3">
        {day.meals.map((m) => {
          const status = dayLogs.get(m.id) ?? null
          const t = mealTotals(m)
          const s = mealStructure(m)
          return (
            <li
              key={m.id}
              className={cn(
                "rounded-xl surface-inset p-4 transition-colors",
                status === "done" && "border-gain/30 bg-gain/[0.04]",
                status === "skipped" && "opacity-70",
              )}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">
                    <Emoji e={MEAL_SLOT_EMOJI[m.slot]} />
                    {m.label ?? MEAL_SLOT_LABELS[m.slot]}
                    {m.time_hint && <span className="ml-2 text-xs font-normal text-muted-foreground">{m.time_hint.slice(0, 5)}</span>}
                  </p>
                  <p className="text-[11px] tabular text-muted-foreground">
                    {formatNumber(t.kcal, 0)} kcal · P {formatNumber(t.protein_g, 0)} g · C {formatNumber(t.carbs_g, 0)} g · G{" "}
                    {formatNumber(t.fat_g, 0)} g
                  </p>
                </div>
                <div className="flex gap-1.5" role="group" aria-label={`Stato ${m.label ?? MEAL_SLOT_LABELS[m.slot]}`}>
                  {STATUS.map(({ s: st, label, icon: Icon, className }) => {
                    const active = status === st
                    return (
                      <button
                        key={st}
                        type="button"
                        aria-pressed={active}
                        onClick={() => onSet(m.id, active ? null : st)}
                        className={cn(
                          "inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-xs font-medium ring-1 ring-inset transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          active ? className : "text-muted-foreground ring-border hover:text-foreground",
                        )}
                      >
                        <Icon className="size-3.5" /> {label}
                      </button>
                    )
                  })}
                </div>
              </div>
              <ul className="mt-3 space-y-1 text-sm">
                {s.fixed.map((it) => (
                  <li key={it.id} className="flex justify-between gap-3">
                    <span>
                      <Emoji e={foodEmoji(it.food_name)} />
                      {itemText(it)}
                    </span>
                    {isNum(it.kcal) && <span className="shrink-0 text-xs tabular text-muted-foreground">{formatNumber(it.kcal, 0)} kcal</span>}
                  </li>
                ))}
                {s.groups.map((g) => (
                  <li key={g.group} className="rounded-lg border border-dashed px-2.5 py-1.5">
                    {g.options.map((it, i) => (
                      <div key={it.id} className="flex justify-between gap-3">
                        <span>
                          {i > 0 && <span className="mr-1 text-xs italic text-muted-foreground">oppure</span>}
                          <Emoji e={foodEmoji(it.food_name)} />
                          {itemText(it)}
                        </span>
                        {isNum(it.kcal) && <span className="shrink-0 text-xs tabular text-muted-foreground">{formatNumber(it.kcal, 0)} kcal</span>}
                      </div>
                    ))}
                  </li>
                ))}
              </ul>
              {m.notes && <p className="mt-2 text-xs text-muted-foreground">{m.notes}</p>}
            </li>
          )
        })}
      </ul>
    </GlassCard>
  )
}
