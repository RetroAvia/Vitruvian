"use client"

import { Plus, Search } from "lucide-react"
import { useDeferredValue, useMemo, useState } from "react"

import { MuscleFigure } from "@/components/body/muscle-figure"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { NativeSelect } from "@/components/ui/native-select"
import { Emoji } from "@/components/shared/emoji"
import { cn } from "@/lib/utils"

import { exerciseEmoji } from "../engine/analysis"
import { EXERCISES, MUSCLE_KEYS, MUSCLES, PATTERN_LABELS, slug, type ExerciseDef, type Muscle, type Pattern } from "../engine/catalog"

export interface PickedExercise {
  code: string
  name: string
  primary: Muscle | null
  secondary: Muscle[]
  pattern: Pattern
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")

/** Ricerca nel catalogo per nome o muscolo; possibilità di creare un esercizio personale. */
export function ExercisePicker({ open, onOpenChange, onPick }: { open: boolean; onOpenChange: (o: boolean) => void; onPick: (e: PickedExercise) => void }) {
  const [q, setQ] = useState("")
  const [muscle, setMuscle] = useState<Muscle | "all" | "cardio">("all")
  const [custom, setCustom] = useState<{ name: string; primary: Muscle; pattern: Pattern } | null>(null)
  const dq = useDeferredValue(q)

  const list = useMemo(() => {
    const t = norm(dq.trim())
    return EXERCISES.filter((e) => {
      if (muscle === "cardio" && e.pattern !== "cardio") return false
      if (muscle !== "all" && muscle !== "cardio" && e.primary !== muscle && !e.secondary.includes(muscle)) return false
      if (!t) return true
      return norm(`${e.name} ${(e.aliases ?? []).join(" ")} ${e.primary ? MUSCLES[e.primary] : ""}`).includes(t)
    }).sort((a, b) => Number(muscle !== "all" && muscle !== "cardio" && b.primary === muscle) - Number(muscle !== "all" && muscle !== "cardio" && a.primary === muscle))
  }, [dq, muscle])

  function pick(e: ExerciseDef) {
    onPick({ code: e.code, name: e.name, primary: e.primary, secondary: e.secondary, pattern: e.pattern })
    onOpenChange(false)
    setQ("")
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90dvh] flex-col gap-3 sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Aggiungi esercizio</DialogTitle>
          <DialogDescription>Cerca per nome o filtra per muscolo.</DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Es. panca, curl, squat…" className="h-11 rounded-xl pl-9" aria-label="Cerca esercizio" />
        </div>
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
          {(["all", ...MUSCLE_KEYS, "cardio"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMuscle(m)}
              aria-pressed={muscle === m}
              className={cn(
                "h-8 shrink-0 rounded-full border px-3 text-xs font-medium transition-colors",
                muscle === m ? "border-neon/40 bg-neon/10 text-neon" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {m === "all" ? "Tutti" : m === "cardio" ? "Cardio" : MUSCLES[m]}
            </button>
          ))}
        </div>
        <ul className="-mx-1 min-h-0 flex-1 space-y-1 overflow-y-auto px-1">
          {list.map((e) => (
            <li key={e.code}>
              <button type="button" onClick={() => pick(e)} className="flex w-full items-center gap-3 rounded-xl p-2 text-left transition-colors hover:bg-accent/50 focus-visible:bg-accent/50 focus-visible:outline-none">
                <span className="h-12 w-6 shrink-0">
                  <MuscleFigure primary={e.primary} secondary={e.secondary} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium"><Emoji e={exerciseEmoji(e.code, e.name)} className="mr-1" />{e.name}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {e.primary ? MUSCLES[e.primary] : "Cardio"} · {PATTERN_LABELS[e.pattern]}
                  </span>
                </span>
                <Plus className="size-4 text-muted-foreground" />
              </button>
            </li>
          ))}
          {list.length === 0 && <li className="py-6 text-center text-sm text-muted-foreground">Nessun esercizio: crealo qui sotto.</li>}
        </ul>
        <div className="border-t pt-3">
          {custom ? (
            <div className="grid gap-2 sm:grid-cols-[1fr_150px_150px_auto]">
              <Input value={custom.name} onChange={(e) => setCustom({ ...custom, name: e.target.value })} placeholder="Nome esercizio" className="h-10 rounded-lg" aria-label="Nome esercizio personale" />
              <NativeSelect aria-label="Muscolo principale" value={custom.primary} onChange={(e) => setCustom({ ...custom, primary: e.target.value as Muscle })}>
                {MUSCLE_KEYS.map((m) => (
                  <option key={m} value={m}>
                    {MUSCLES[m]}
                  </option>
                ))}
              </NativeSelect>
              <NativeSelect aria-label="Schema motorio" value={custom.pattern} onChange={(e) => setCustom({ ...custom, pattern: e.target.value as Pattern })}>
                {(Object.keys(PATTERN_LABELS) as Pattern[]).map((p) => (
                  <option key={p} value={p}>
                    {PATTERN_LABELS[p]}
                  </option>
                ))}
              </NativeSelect>
              <Button
                className="h-10 rounded-lg"
                disabled={!custom.name.trim()}
                onClick={() => {
                  onPick({ code: slug(custom.name), name: custom.name.trim(), primary: custom.pattern === "cardio" ? null : custom.primary, secondary: [], pattern: custom.pattern })
                  setCustom(null)
                  onOpenChange(false)
                }}
              >
                Aggiungi
              </Button>
            </div>
          ) : (
            <Button variant="ghost" size="sm" className="rounded-lg" onClick={() => setCustom({ name: q, primary: "chest", pattern: "isolation" })}>
              <Plus className="size-4" /> Crea esercizio personale
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
