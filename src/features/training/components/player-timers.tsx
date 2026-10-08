"use client"

import { Minus, Plus, SkipForward } from "lucide-react"
import { memo, useEffect, useRef, useState } from "react"

import { playAlert } from "@/lib/sound"
import { cn } from "@/lib/utils"

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.max(0, s) % 60).padStart(2, "0")}`

/** Cronometro della sessione: si aggiorna da solo (il resto del registro non si ridisegna). */
export const Elapsed = memo(function Elapsed({ since, className }: { since: number; className?: string }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  const s = Math.max(0, Math.floor((now - since) / 1000))
  const h = Math.floor(s / 3600)
  return <span className={cn("tabular", className)}>{h > 0 ? `${h}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}` : fmt(s)}</span>
})

export interface RestState {
  until: number
  total: number
  label: string
}

/**
 * Timer di recupero con anello. Basato sull'ora di fine (non su un contatore):
 * resta preciso anche se il telefono mette in pausa la pagina.
 */
export const RestTimer = memo(function RestTimer({ rest, onChange, onDone }: { rest: RestState; onChange: (r: RestState | null) => void; onDone?: () => void }) {
  const [now, setNow] = useState(() => Date.now())
  const fired = useRef(false)

  useEffect(() => {
    fired.current = false
    const id = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(id)
  }, [rest.until])

  const left = Math.max(0, Math.ceil((rest.until - now) / 1000))
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const handlers = useRef({ onChange, onDone })
  handlers.current = { onChange, onDone }
  useEffect(() => () => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
  }, [])
  // conto alla rovescia sonoro negli ultimi 3 secondi (solo se il recupero era in corso)
  const ticked = useRef(0)
  useEffect(() => {
    if (left >= 1 && left <= 3 && rest.total > 5 && ticked.current !== left && rest.until - Date.now() > 0) {
      ticked.current = left
      playAlert("restTick")
    }
  }, [left, rest.total, rest.until])

  useEffect(() => {
    if (left > 0) {
      if (closeTimer.current) clearTimeout(closeTimer.current)
      fired.current = false
      return
    }
    if (fired.current) return
    fired.current = true
    // avviso solo se il recupero è finito "adesso" (non riaprendo l'app molto dopo)
    if (Date.now() - rest.until < 10_000) playAlert("restEnd")
    try {
      navigator.vibrate?.([250, 120, 250, 120, 400])
    } catch {
      /* non supportato */
    }
    handlers.current.onDone?.()
    closeTimer.current = setTimeout(() => handlers.current.onChange(null), 1500)
  }, [left, rest.until])

  const r = 26
  const c = 2 * Math.PI * r
  const pct = rest.total > 0 ? left / rest.total : 0

  return (
    <div className="animate-sheet-up flex items-center gap-4 rounded-2xl border border-neon/30 bg-popover/95 p-3 shadow-[var(--shadow-raised)] backdrop-blur" role="timer" aria-live="polite">
      <div className="relative grid size-16 shrink-0 place-items-center">
        <svg viewBox="0 0 64 64" className="absolute inset-0 -rotate-90" aria-hidden>
          <circle cx="32" cy="32" r={r} fill="none" stroke="var(--muted)" strokeWidth="5" />
          <circle
            cx="32"
            cy="32"
            r={r}
            fill="none"
            stroke={left === 0 ? "var(--gain)" : "var(--neon)"}
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - pct)}
            style={{ transition: "stroke-dashoffset 0.5s linear" }}
          />
        </svg>
        <span className="relative font-display text-base font-semibold tabular">{fmt(left)}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{left === 0 ? "Si riparte!" : "Recupero"}</p>
        <p className="truncate text-xs text-muted-foreground">{rest.label}</p>
      </div>
      <div className="flex shrink-0 gap-1">
        <button type="button" aria-label="Togli 15 secondi" onClick={() => onChange({ ...rest, until: Math.max(Date.now(), rest.until - 15_000) })} className="grid size-10 place-items-center rounded-xl border text-muted-foreground hover:text-foreground">
          <Minus className="size-4" />
        </button>
        <button type="button" aria-label="Aggiungi 15 secondi" onClick={() => onChange({ ...rest, until: rest.until + 15_000, total: rest.total + 15 })} className="grid size-10 place-items-center rounded-xl border text-muted-foreground hover:text-foreground">
          <Plus className="size-4" />
        </button>
        <button type="button" aria-label="Salta il recupero" onClick={() => onChange(null)} className="grid size-10 place-items-center rounded-xl bg-neon/15 text-neon">
          <SkipForward className="size-4" />
        </button>
      </div>
    </div>
  )
})

/** Schermo sempre acceso durante l'allenamento (rilasciato alla chiusura). */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || typeof navigator === "undefined" || !("wakeLock" in navigator)) return
    let lock: { release: () => Promise<void> } | null = null
    let cancelled = false
    const request = async () => {
      try {
        const l = await (navigator as unknown as { wakeLock: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } }).wakeLock.request("screen")
        if (cancelled) void l.release()
        else lock = l
      } catch {
        /* negato o non supportato: nessun problema */
      }
    }
    void request()
    const onVis = () => {
      if (document.visibilityState === "visible") void request()
    }
    document.addEventListener("visibilitychange", onVis)
    return () => {
      cancelled = true
      document.removeEventListener("visibilitychange", onVis)
      void lock?.release().catch(() => undefined)
    }
  }, [active])
}
