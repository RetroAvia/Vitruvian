/** Normalizzazione dei valori inviati dai Comandi Rapidi. */

/** "7 h 20 min", "7 ore e 20 minuti", "7:20", "440 min" → ore ("7.33"); numeri semplici restano invariati. */
export function sleepHours(v: string | null | undefined): string | null {
  if (!v) return null
  const t = v.toLowerCase().replace(",", ".")
  const hm = t.match(/^\s*(\d{1,2}):(\d{2})/)
  if (hm) return String(Number(hm[1]) + Number(hm[2]) / 60)
  const h = t.match(/(\d+(?:\.\d+)?)\s*(?:h|ore|ora|hr|hours?)\b/)
  const m = t.match(/(\d+(?:\.\d+)?)\s*(?:min|minuti|minutes?|m)\b/)
  if (h || m) {
    const hours = (h ? Number(h[1]) : 0) + (m ? Number(m[1]) / 60 : 0)
    return Number.isFinite(hours) ? hours.toFixed(2) : v
  }
  return v
}
