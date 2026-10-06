/** Formattazione it-IT centralizzata: numeri, date, delta. */

const numberFormatters = new Map<number, Intl.NumberFormat>()

function nf(digits: number) {
  let f = numberFormatters.get(digits)
  if (!f) {
    f = new Intl.NumberFormat("it-IT", { minimumFractionDigits: digits, maximumFractionDigits: digits })
    numberFormatters.set(digits, f)
  }
  return f
}

export const EMPTY = "—"

export function isNum(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v)
}

export function formatNumber(value: number | null | undefined, digits = 1): string {
  return isNum(value) ? nf(digits).format(value) : EMPTY
}

/** +1,2 / −0,8 / 0,0 — usa il vero segno meno tipografico. */
export function formatSigned(value: number | null | undefined, digits = 1): string {
  if (!isNum(value)) return EMPTY
  if (Math.abs(value) < 0.5 / 10 ** digits) return nf(digits).format(0)
  return `${value > 0 ? "+" : "−"}${nf(digits).format(Math.abs(value))}`
}

/** Le date del DB sono "YYYY-MM-DD": le interpretiamo in ora locale (niente slittamenti UTC). */
export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number)
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1)
}

const dateFormats = {
  short: new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" }),
  medium: new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short", year: "numeric" }),
  long: new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "long", year: "numeric" }),
  monthYear: new Intl.DateTimeFormat("it-IT", { month: "short", year: "2-digit" }),
} as const

export function formatDate(
  iso: string | null | undefined,
  style: keyof typeof dateFormats = "short",
): string {
  return iso ? dateFormats[style].format(parseISODate(iso)) : EMPTY
}

export function daysBetween(fromISO: string, toISO: string): number {
  const ms = parseISODate(toISO).getTime() - parseISODate(fromISO).getTime()
  return Math.round(ms / 86_400_000)
}

export function todayISO(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Data ISO spostata di N giorni (negativo = nel passato). */
export function shiftISO(iso: string, days: number): string {
  const d = parseISODate(iso)
  d.setDate(d.getDate() + days)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
