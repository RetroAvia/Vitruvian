"use client"

import { formatNumber } from "@/lib/format"
import { useCountUp } from "@/lib/use-count-up"
import { cn } from "@/lib/utils"

/** Anello di punteggio 0–100 con riempimento e numero animati. */
export function ScoreRing({
  score,
  size = 120,
  stroke = 10,
  label,
  className,
}: {
  score: number | null
  size?: number
  stroke?: number
  label?: string
  className?: string
}) {
  const animated = useCountUp(score)
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const v = Math.max(0, Math.min(100, animated ?? 0))
  const color = score === null ? "var(--muted-foreground)" : score >= 75 ? "var(--gain)" : score >= 50 ? "var(--warn)" : "var(--danger)"

  return (
    <div className={cn("relative grid place-items-center", className)} style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} className="absolute inset-0 -rotate-90" aria-hidden>
        <defs>
          <linearGradient id="score-ring-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={color} />
            <stop offset="100%" stopColor="var(--neon)" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--muted)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="url(#score-ring-grad)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v / 100)}
          style={{ filter: `drop-shadow(0 0 8px color-mix(in oklab, ${color} 45%, transparent))` }}
        />
      </svg>
      <div className="relative text-center">
        <p className="font-display text-3xl font-semibold leading-none tabular" aria-label={score === null ? "Non disponibile" : `${score} su 100`}>
          {score === null ? "—" : formatNumber(animated, 0)}
        </p>
        {label && <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">{label}</p>}
      </div>
    </div>
  )
}
