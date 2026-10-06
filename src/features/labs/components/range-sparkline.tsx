import { isNum } from "@/lib/format"

interface Props {
  values: Array<number | null>
  refLow: number | null
  refHigh: number | null
  className?: string
}

/**
 * Mini grafico SVG (senza librerie: leggero anche con decine di card).
 * Fascia verde = range di riferimento; ultimo punto evidenziato.
 */
export function RangeSparkline({ values, refLow, refHigh, className }: Props) {
  const W = 120
  const H = 36
  const P = 4
  const nums = values.filter(isNum)
  if (nums.length === 0) return <div className={className} style={{ height: H }} />

  const lo = Math.min(...nums, ...(isNum(refLow) ? [refLow] : []))
  const hi = Math.max(...nums, ...(isNum(refHigh) ? [refHigh] : []))
  const span = hi - lo || Math.abs(hi) || 1
  const min = lo - span * 0.15
  const max = hi + span * 0.15
  const y = (v: number) => H - P - ((v - min) / (max - min)) * (H - 2 * P)
  const x = (i: number) => (values.length === 1 ? W / 2 : P + (i / (values.length - 1)) * (W - 2 * P))

  const pts = values.map((v, i) => (isNum(v) ? { x: x(i), y: y(v) } : null)).filter((p): p is { x: number; y: number } => p !== null)
  const path = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")
  const bandTop = isNum(refHigh) ? y(refHigh) : P
  const bandBottom = isNum(refLow) ? y(refLow) : H - P
  const last = pts[pts.length - 1]

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={className} aria-hidden>
      {(isNum(refLow) || isNum(refHigh)) && (
        <rect x={0} y={bandTop} width={W} height={Math.max(bandBottom - bandTop, 1)} fill="var(--gain)" opacity={0.1} />
      )}
      {pts.length > 1 && (
        <path d={path} fill="none" stroke="var(--series-1)" strokeWidth={2} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      )}
      {last && <circle cx={last.x} cy={last.y} r={3.5} fill="var(--series-1)" stroke="var(--chart-surface)" strokeWidth={1.5} />}
    </svg>
  )
}
