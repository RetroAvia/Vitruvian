import { memo } from "react"

import type { Muscle } from "@/features/training/engine/catalog"
import { cn } from "@/lib/utils"

import { BEST_VIEW, MUSCLE_SHAPES, SILHOUETTE, toPoints, type View } from "./body-geometry"

/**
 * Miniatura del corpo con i muscoli coinvolti: principale acceso, secondari tenui.
 * SVG statico e memoizzato: decine di miniature in una lista non pesano.
 */
export const MuscleFigure = memo(function MuscleFigure({
  primary,
  secondary = [],
  view,
  className,
  title,
}: {
  primary: Muscle | null
  secondary?: Muscle[]
  view?: View
  className?: string
  title?: string
}) {
  const v: View = view ?? (primary ? BEST_VIEW[primary] : "front")
  const sec = new Set(secondary)
  return (
    <svg viewBox="28 8 144 430" className={cn("h-full w-auto", className)} role="img" aria-label={title ?? "Muscoli coinvolti"}>
      {SILHOUETTE.map((p, i) => (
        <polygon key={i} points={toPoints(p)} className="fill-foreground/[0.06] stroke-foreground/25" strokeWidth={1.2} strokeLinejoin="round" />
      ))}
      {MUSCLE_SHAPES[v].map((s, i) => {
        const on = s.muscle === primary
        const half = s.muscle !== null && sec.has(s.muscle)
        return (
          <polygon
            key={i}
            points={toPoints(s.points)}
            strokeWidth={1}
            strokeLinejoin="round"
            className={cn(on ? "fill-neon stroke-neon" : half ? "fill-neon/35 stroke-neon/50" : "fill-transparent stroke-foreground/10")}
          />
        )
      })}
    </svg>
  )
})
