"use client"

import { memo, useEffect, useMemo, useRef, useState } from "react"

import { MUSCLES, type Muscle } from "@/features/training/engine/catalog"
import { formatNumber, formatSigned, isNum } from "@/lib/format"
import { cn } from "@/lib/utils"

import { bodyGeometry, toPoints, type BodyFigure, type View } from "./body-geometry"

export type BodyMapMode = "measures" | "training" | "focus"
export type MuscleTone = "none" | "low" | "ok" | "optimal" | "high" | "weak" | "strong"

export interface BodyMarker {
  id: string
  view: View
  at: [number, number]
  tone: "gain" | "warn" | "danger" | "neon"
  label: string
}

export interface BodyMapProps {
  view: View
  mode: BodyMapMode
  /** circonferenze attuali (chiavi come all_sites: "arm_left", "waist"…) */
  sites: Record<string, number>
  /** variazione in cm per sito (stesse chiavi) */
  deltas?: Record<string, number>
  muscleTone?: Partial<Record<Muscle, MuscleTone>>
  muscleLabel?: Partial<Record<Muscle, string>>
  markers?: BodyMarker[]
  selected?: Muscle | null
  onSelect?: (m: Muscle | null) => void
  compact?: boolean
  /** figura maschile o femminile (dal profilo) */
  figure?: BodyFigure
  className?: string
}

const SITE_NAMES: Record<string, string> = {
  neck: "Collo",
  shoulders: "Spalle",
  chest: "Torace",
  arm_left: "Braccio sx",
  arm_right: "Braccio dx",
  arm: "Braccio",
  forearm_left: "Avambr. sx",
  forearm_right: "Avambr. dx",
  forearm: "Avambraccio",
  waist: "Vita",
  hips: "Fianchi",
  thigh_left: "Coscia sx",
  thigh_right: "Coscia dx",
  thigh: "Coscia",
  calf_left: "Polpaccio sx",
  calf_right: "Polpaccio dx",
  calf: "Polpaccio",
}

const TONE_CLASS: Record<MuscleTone, string> = {
  none: "fill-neon/[0.06] stroke-neon/25",
  low: "fill-warn/45 stroke-warn",
  ok: "fill-neon/35 stroke-neon",
  optimal: "fill-gain/45 stroke-gain",
  high: "fill-danger/45 stroke-danger",
  weak: "fill-warn/55 stroke-warn",
  strong: "fill-gain/40 stroke-gain",
}

const MARKER_CLASS = { gain: "fill-gain", warn: "fill-warn", danger: "fill-danger", neon: "fill-neon" } as const

interface Callout {
  key: string
  name: string
  value: number
  delta: number | null
  at: [number, number]
  side: "left" | "right"
  y: number
}

/** Posiziona le etichette su due colonne evitando sovrapposizioni. */
function layoutCallouts(sites: Record<string, number>, deltas: Record<string, number> | undefined, gap: number, anchors: ReturnType<typeof bodyGeometry>["anchors"]): Callout[] {
  const items: Callout[] = []
  for (const [key, anchor] of Object.entries(anchors)) {
    let value = sites[key]
    let k = key
    // sito misurato senza lato → etichetta sul lato sinistro della figura
    if (!isNum(value) && key.endsWith("_left")) {
      const base = key.replace("_left", "")
      if (isNum(sites[base]) && !isNum(sites[`${base}_right`])) {
        value = sites[base]
        k = base
      }
    }
    if (!isNum(value)) continue
    items.push({ key: k, name: SITE_NAMES[k] ?? k, value, delta: deltas?.[k] ?? null, at: anchor.at, side: anchor.side, y: anchor.at[1] })
  }
  for (const side of ["left", "right"] as const) {
    const col = items.filter((c) => c.side === side).sort((a, b) => a.at[1] - b.at[1])
    let last = -Infinity
    for (const c of col) {
      c.y = Math.max(c.at[1], last + gap)
      last = c.y
    }
  }
  return items
}

/**
 * Corpo "olografico" interattivo: SVG statico + effetti solo CSS (inclinazione,
 * rotazione fronte/retro, scansione). Le animazioni si fermano quando la mappa
 * non è visibile o se il sistema chiede di ridurre il movimento.
 */
export const BodyMap = memo(function BodyMap({ view, mode, sites, deltas, muscleTone, muscleLabel, markers = [], selected, onSelect, compact, figure = "male", className }: BodyMapProps) {
  const geo = bodyGeometry(figure)
  const wrap = useRef<HTMLDivElement>(null)
  const tilt = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(true)

  // pausa delle animazioni fuori schermo (batteria)
  useEffect(() => {
    const el = wrap.current
    if (!el || typeof IntersectionObserver === "undefined") return
    const io = new IntersectionObserver(([e]) => setVisible(Boolean(e?.isIntersecting)), { threshold: 0.05 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  // inclinazione 3D con il puntatore (solo dispositivi con mouse), un frame alla volta
  useEffect(() => {
    const el = wrap.current
    const t = tilt.current
    if (!el || !t || compact || !window.matchMedia("(hover: hover) and (pointer: fine)").matches || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    let raf = 0
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect()
      const x = (e.clientX - r.left) / r.width - 0.5
      const y = (e.clientY - r.top) / r.height - 0.5
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        t.style.transform = `rotateY(${(x * 14).toFixed(2)}deg) rotateX(${(-y * 8).toFixed(2)}deg)`
      })
    }
    const leave = () => {
      cancelAnimationFrame(raf)
      t.style.transform = ""
    }
    el.addEventListener("pointermove", move)
    el.addEventListener("pointerleave", leave)
    return () => {
      cancelAnimationFrame(raf)
      el.removeEventListener("pointermove", move)
      el.removeEventListener("pointerleave", leave)
    }
  }, [compact])

  const callouts = useMemo(() => (mode === "measures" ? layoutCallouts(sites, deltas, compact ? 36 : 27, geo.anchors) : []), [mode, sites, deltas, compact, geo])
  const interactive = Boolean(onSelect) && mode !== "measures"

  const face = (v: View) => (
    <svg viewBox="-112 0 424 452" className="h-full w-full" role="img" aria-label={`Corpo, vista ${v === "front" ? "frontale" : "posteriore"}`}>
      <defs>
        <linearGradient id={`bm-body-${v}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--neon)" stopOpacity="0.22" />
          <stop offset="1" stopColor="var(--bia)" stopOpacity="0.06" />
        </linearGradient>
        <radialGradient id={`bm-floor-${v}`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="var(--neon)" stopOpacity="0.45" />
          <stop offset="1" stopColor="var(--neon)" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* piattaforma */}
      <ellipse cx="100" cy="436" rx="70" ry="9" fill={`url(#bm-floor-${v})`} />
      <ellipse cx="100" cy="436" rx="52" ry="6" fill="none" className="stroke-neon/40" strokeWidth="0.8" />

      {/* silhouette */}
      <g className="stroke-neon/70" strokeWidth="0.8" strokeLinejoin="round">
        {geo.silhouette.map((p, i) => (
          <polygon key={i} points={toPoints(p)} fill={`url(#bm-body-${v})`} />
        ))}
      </g>

      {/* muscoli */}
      <g strokeWidth="0.7" strokeLinejoin="round">
        {geo.muscles[v].map((s, i) => {
          const tone: MuscleTone = s.muscle ? (muscleTone?.[s.muscle] ?? "none") : "none"
          const isSel = selected && s.muscle === selected
          return (
            <polygon
              key={i}
              points={toPoints(s.points)}
              className={cn(TONE_CLASS[mode === "measures" ? "none" : tone], isSel && "fill-foreground/40 stroke-foreground", interactive && "cursor-pointer transition-[fill-opacity] hover:fill-foreground/25")}
              onClick={interactive && s.muscle ? () => onSelect?.(selected === s.muscle ? null : s.muscle) : undefined}
            >
              {s.muscle && <title>{`${MUSCLES[s.muscle]}${muscleLabel?.[s.muscle] ? ` · ${muscleLabel[s.muscle]}` : ""}`}</title>}
            </polygon>
          )
        })}
      </g>
      <g className="stroke-neon/30" strokeWidth="0.5">
        {geo.details[v].map(([a, b], i) => (
          <line key={i} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} />
        ))}
      </g>

      {/* marcatori (cuore, sangue…) */}
      {markers
        .filter((m) => m.view === v)
        .map((m) => {
          const [x, y] = geo.place(m.at)
          return (
            <g key={m.id}>
              <circle cx={x} cy={y} r="7" className={cn(MARKER_CLASS[m.tone], "opacity-20")} />
              <circle cx={x} cy={y} r="3" className={MARKER_CLASS[m.tone]}>
                <title>{m.label}</title>
              </circle>
            </g>
          )
        })}

      {/* etichette delle circonferenze */}
      {v === "front" &&
        callouts.map((c) => {
          const lx = c.side === "left" ? -100 : 300
          const elbow = c.side === "left" ? 18 : 182
          return (
            <g key={c.key}>
              <polyline points={`${c.at[0]},${c.at[1]} ${elbow},${c.y} ${c.side === "left" ? lx + 66 : lx - 66},${c.y}`} fill="none" className="stroke-neon/45" strokeWidth="0.6" />
              <circle cx={c.at[0]} cy={c.at[1]} r="1.8" className="fill-neon" />
              <text x={lx} y={c.y - 2} textAnchor={c.side === "left" ? "start" : "end"} className="fill-muted-foreground" style={{ fontSize: compact ? 13 : 9.5, letterSpacing: "0.06em" }}>
                {c.name.toUpperCase()}
              </text>
              <text x={lx} y={c.y + (compact ? 13 : 10)} textAnchor={c.side === "left" ? "start" : "end"} className="fill-foreground font-semibold" style={{ fontSize: compact ? 15 : 12 }}>
                {formatNumber(c.value, 1)}
                <tspan className="fill-muted-foreground font-normal" style={{ fontSize: compact ? 11 : 9 }}>
                  {" "}
                  cm
                </tspan>
                {isNum(c.delta) && Math.abs(c.delta) >= 0.1 && (
                  <tspan className={c.key === "waist" ? (c.delta > 0 ? "fill-warn" : "fill-gain") : c.delta > 0 ? "fill-gain" : "fill-warn"} style={{ fontSize: compact ? 11 : 9 }}>
                    {" "}
                    {formatSigned(c.delta, 1)}
                  </tspan>
                )}
              </text>
            </g>
          )
        })}
    </svg>
  )

  return (
    <div ref={wrap} className={cn("body-holo relative isolate select-none", className)} data-paused={!visible || undefined}>
      {/* griglia e alone di sfondo (statici) */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 rounded-3xl bg-grid opacity-40 [mask-image:radial-gradient(ellipse_at_center,black_35%,transparent_75%)]" />
      <div ref={tilt} className="body-holo-tilt relative h-full w-full">
        <div className={cn("body-holo-flip relative h-full w-full", view === "back" && "is-back")}>
          <div className="body-holo-face absolute inset-0">{face("front")}</div>
          <div className="body-holo-face body-holo-back absolute inset-0">{face("back")}</div>
        </div>
      </div>
      {/* linea di scansione: un solo elemento animato con transform (GPU) */}
      <div aria-hidden className="body-holo-scan pointer-events-none absolute" />
    </div>
  )
})
