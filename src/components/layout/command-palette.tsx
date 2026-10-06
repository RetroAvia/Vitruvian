"use client"

import * as DialogPrimitive from "@radix-ui/react-dialog"
import {
  CornerDownLeft,
  FileDown,
  FlaskConical,
  HeartPulse,
  Moon,
  Pill,
  Plus,
  Salad,
  Search,
  Volume2,
  VolumeX,
  type LucideIcon,
} from "lucide-react"
import { useTheme } from "next-themes"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useRef, useState } from "react"

import { ALL_NAV_ITEMS } from "@/config/nav"
import { playSound } from "@/lib/sound"
import { cn } from "@/lib/utils"
import { useUiStore } from "@/stores/ui-store"

export const OPEN_PALETTE_EVENT = "vitruvian:open-palette"

export function openCommandPalette() {
  window.dispatchEvent(new Event(OPEN_PALETTE_EVENT))
}

interface Command {
  id: string
  label: string
  hint?: string
  group: "Vai a" | "Azioni" | "Preferenze"
  icon: LucideIcon
  keywords?: string
  run: () => void
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")

/** Ricerca rapida di sezioni e azioni: Ctrl/⌘ + K ovunque nell'app. */
export function CommandPalette() {
  const router = useRouter()
  const { resolvedTheme, setTheme } = useTheme()
  const soundEnabled = useUiStore((s) => s.soundEnabled)
  const setSoundEnabled = useUiStore((s) => s.setSoundEnabled)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [index, setIndex] = useState(0)
  const listRef = useRef<HTMLUListElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    const onOpen = () => setOpen(true)
    window.addEventListener("keydown", onKey)
    window.addEventListener(OPEN_PALETTE_EVENT, onOpen)
    return () => {
      window.removeEventListener("keydown", onKey)
      window.removeEventListener(OPEN_PALETTE_EVENT, onOpen)
    }
  }, [])

  const commands = useMemo<Command[]>(() => {
    const go = (href: string) => () => router.push(href)
    return [
      ...ALL_NAV_ITEMS.map((n) => ({ id: n.href, label: n.label, hint: n.description, group: "Vai a" as const, icon: n.icon, run: go(n.href) })),
      { id: "new-visit", label: "Nuova visita", hint: "Inserisci peso, BIA e circonferenze", group: "Azioni", icon: Plus, keywords: "aggiungi misura bia", run: go("/checkups?new=1") },
      { id: "imp-labs", label: "Importa analisi del sangue", group: "Azioni", icon: FlaskConical, keywords: "ai referto laboratorio", run: go("/bridge?tab=labs") },
      { id: "imp-med", label: "Importa referto medico", hint: "ECG, visita sportiva, pressione…", group: "Azioni", icon: HeartPulse, keywords: "ecg elettrocardiogramma ai", run: go("/bridge?tab=medical") },
      { id: "imp-sup", label: "Importa integratori", group: "Azioni", icon: Pill, keywords: "ai etichetta", run: go("/bridge?tab=supplements") },
      { id: "imp-diet", label: "Importa dieta", group: "Azioni", icon: Salad, keywords: "ai piano alimentare nutrizionista", run: go("/bridge?tab=diet") },
      { id: "backup", label: "Scarica backup completo", group: "Azioni", icon: FileDown, keywords: "esporta salva json sicurezza", run: go("/settings#backup") },
      { id: "theme", label: resolvedTheme === "dark" ? "Tema chiaro" : "Tema scuro", group: "Preferenze", icon: Moon, keywords: "tema dark light", run: () => setTheme(resolvedTheme === "dark" ? "light" : "dark") },
      {
        id: "sound",
        label: soundEnabled ? "Disattiva suoni" : "Attiva suoni",
        group: "Preferenze",
        icon: soundEnabled ? VolumeX : Volume2,
        keywords: "audio",
        run: () => {
          setSoundEnabled(!soundEnabled)
          if (!soundEnabled) setTimeout(() => playSound("success"), 50)
        },
      },
    ]
  }, [router, resolvedTheme, setTheme, soundEnabled, setSoundEnabled])

  const results = useMemo(() => {
    const q = norm(query.trim())
    if (!q) return commands
    const words = q.split(/\s+/)
    return commands
      .map((c) => {
        const hay = norm(`${c.label} ${c.hint ?? ""} ${c.keywords ?? ""}`)
        if (!words.every((w) => hay.includes(w))) return null
        const score = norm(c.label).startsWith(q) ? 0 : norm(c.label).includes(q) ? 1 : 2
        return { c, score }
      })
      .filter((x): x is { c: Command; score: number } => x !== null)
      .sort((a, b) => a.score - b.score)
      .map((x) => x.c)
  }, [commands, query])

  useEffect(() => setIndex(0), [query, open])
  useEffect(() => {
    if (!open) setQuery("")
  }, [open])
  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${index}"]`)?.scrollIntoView({ block: "nearest" })
  }, [index])

  function run(c: Command | undefined) {
    if (!c) return
    setOpen(false)
    playSound("tap")
    c.run()
  }

  let lastGroup = ""

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className="fixed left-1/2 top-[12vh] z-50 w-[calc(100%-1.5rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-2xl border bg-popover text-popover-foreground shadow-2xl outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault()
              setIndex((i) => Math.min(i + 1, results.length - 1))
            } else if (e.key === "ArrowUp") {
              e.preventDefault()
              setIndex((i) => Math.max(i - 1, 0))
            } else if (e.key === "Enter") {
              e.preventDefault()
              run(results[index])
            }
          }}
        >
          <DialogPrimitive.Title className="sr-only">Cerca sezioni e azioni</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">Digita per filtrare, frecce per scegliere, Invio per aprire</DialogPrimitive.Description>
          <div className="flex items-center gap-3 border-b px-4">
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cerca sezioni e azioni…"
              aria-label="Cerca"
              aria-controls="palette-list"
              aria-activedescendant={results[index] ? `palette-${results[index].id}` : undefined}
              className="h-14 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            <kbd className="hidden rounded-md border px-1.5 py-0.5 text-[10px] text-muted-foreground sm:inline">Esc</kbd>
          </div>
          <ul id="palette-list" ref={listRef} role="listbox" className="max-h-[50vh] overflow-y-auto p-2">
            {results.length === 0 && <li className="px-3 py-8 text-center text-sm text-muted-foreground">Nessun risultato</li>}
            {results.map((c, i) => {
              const header = c.group !== lastGroup ? c.group : null
              lastGroup = c.group
              const Icon = c.icon
              return (
                <li key={c.id} role="presentation">
                  {header && <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/80">{header}</p>}
                  <button
                    type="button"
                    id={`palette-${c.id}`}
                    role="option"
                    aria-selected={i === index}
                    data-index={i}
                    onMouseMove={() => setIndex(i)}
                    onClick={() => run(c)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left outline-none transition-colors",
                      i === index ? "bg-neon/10 text-foreground" : "text-foreground/90",
                    )}
                  >
                    <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg ring-1 ring-inset", i === index ? "bg-neon/15 text-neon ring-neon/30" : "bg-muted ring-border text-muted-foreground")}>
                      <Icon className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{c.label}</span>
                      {c.hint && <span className="block truncate text-xs text-muted-foreground">{c.hint}</span>}
                    </span>
                    {i === index && <CornerDownLeft className="size-3.5 text-muted-foreground" />}
                  </button>
                </li>
              )
            })}
          </ul>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
