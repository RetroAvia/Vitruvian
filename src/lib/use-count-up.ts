"use client"

import { useEffect, useLayoutEffect, useRef, useState } from "react"

// prima del paint sul client (niente "flash" del valore finale prima dell'animazione)
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect

/**
 * Anima un numero da 0 (o dal valore precedente) al valore finale.
 * requestAnimationFrame + easing; rispetta "riduci movimento".
 */
export function useCountUp(target: number | null | undefined, duration = 700): number | null {
  const [value, setValue] = useState<number | null>(typeof target === "number" ? target : null)
  const from = useRef<number>(0)
  const first = useRef(true)

  useIsoLayoutEffect(() => {
    if (typeof target !== "number" || !Number.isFinite(target)) {
      setValue(null)
      return
    }
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    const start = first.current ? 0 : from.current
    first.current = false
    if (reduce || start === target) {
      from.current = target
      setValue(target)
      return
    }
    let raf = 0
    const t0 = performance.now()
    const tick = (now: number) => {
      const p = Math.min((now - t0) / duration, 1)
      const eased = 1 - Math.pow(1 - p, 3)
      const v = start + (target - start) * eased
      setValue(v)
      if (p < 1) raf = requestAnimationFrame(tick)
      else from.current = target
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])

  return value
}
