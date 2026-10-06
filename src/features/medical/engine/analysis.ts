/**
 * Analisi dei referti strumentali: stato delle misure, serie storiche,
 * controlli in scadenza e osservazioni. Funzioni pure.
 */
import type { Insight } from "@/features/biometrics/engine/insights"
import { MEDICAL_KIND_LABELS } from "@/config/constants"
import { daysBetween, formatDate, formatNumber, isNum, parseISODate } from "@/lib/format"
import type { Json } from "@/types/database.types"
import type { LabFlag, MedicalMeasurement, MedicalReport, MedicalReportKind, Sex } from "@/types/domain"

import { defaultRange, MEASURE_BY_CODE, RECHECK_MONTHS } from "./catalog"

/* ----------------------------- Normalizzazione ----------------------------- */

const num = (v: unknown): number | null => {
  if (typeof v === "number" && Number.isFinite(v)) return v
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v.replace(",", "."))
    return Number.isFinite(n) ? n : null
  }
  return null
}
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null)

export function parseMeasurements(j: Json | unknown): MedicalMeasurement[] {
  if (!Array.isArray(j)) return []
  const out: MedicalMeasurement[] = []
  for (const x of j) {
    if (!x || typeof x !== "object") continue
    const o = x as Record<string, unknown>
    const code = str(o.code)
    if (!code) continue
    const value = num(o.value)
    const valueText = str(o.value_text)
    if (value === null && !valueText) continue
    out.push({
      code,
      label: str(o.label) ?? MEASURE_BY_CODE.get(code)?.label ?? code,
      value,
      value_text: valueText,
      unit: str(o.unit) ?? MEASURE_BY_CODE.get(code)?.unit ?? null,
      ref_low: num(o.ref_low),
      ref_high: num(o.ref_high),
    })
  }
  return out
}

/* ------------------------------- Stato misura ------------------------------ */

export function measureRange(m: MedicalMeasurement, sex: Sex | null) {
  if (isNum(m.ref_low) || isNum(m.ref_high)) return { low: m.ref_low ?? null, high: m.ref_high ?? null, fromReport: true }
  return { ...defaultRange(m.code, sex), fromReport: false }
}

export function measureFlag(m: MedicalMeasurement, sex: Sex | null): LabFlag {
  if (!isNum(m.value)) return "unknown"
  const { low, high } = measureRange(m, sex)
  if (!isNum(low) && !isNum(high)) return "unknown"
  if (isNum(low) && m.value < low) return "low"
  if (isNum(high) && m.value > high) return "high"
  return "normal"
}

export function measureDigits(code: string) {
  return MEASURE_BY_CODE.get(code)?.digits ?? 1
}

/* --------------------------------- Serie ----------------------------------- */

export interface MeasurePoint {
  date: string
  value: number
  flag: LabFlag
  reportId: string
}

export interface MeasureSeries {
  code: string
  label: string
  unit: string | null
  digits: number
  points: MeasurePoint[]
}

export function buildMeasureSeries(reports: MedicalReport[], sex: Sex | null): MeasureSeries[] {
  const map = new Map<string, MeasureSeries>()
  const sorted = [...reports].sort((a, b) => a.report_date.localeCompare(b.report_date))
  for (const r of sorted) {
    for (const m of r.measurements) {
      if (!isNum(m.value)) continue
      const s = map.get(m.code) ?? {
        code: m.code,
        label: MEASURE_BY_CODE.get(m.code)?.label ?? m.label,
        unit: m.unit ?? null,
        digits: measureDigits(m.code),
        points: [],
      }
      // stessa data: tiene l'ultimo valore
      s.points = s.points.filter((p) => p.date !== r.report_date)
      s.points.push({ date: r.report_date, value: m.value, flag: measureFlag(m, sex), reportId: r.id })
      map.set(m.code, s)
    }
  }
  return [...map.values()]
}

/* ------------------------------- Scadenze ---------------------------------- */

export function addMonthsISO(iso: string, months: number): string {
  const d = parseISODate(iso)
  d.setMonth(d.getMonth() + months)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export interface UpcomingCheck {
  kind: MedicalReportKind
  label: string
  lastDate: string
  dueDate: string
  /** true se la data è indicata dal medico nel referto */
  fromReport: boolean
  daysLeft: number
  status: "overdue" | "soon" | "planned"
}

export function upcomingChecks(reports: MedicalReport[], today: string): UpcomingCheck[] {
  const latestByKind = new Map<MedicalReportKind, MedicalReport>()
  for (const r of reports) {
    const cur = latestByKind.get(r.kind)
    if (!cur || r.report_date > cur.report_date) latestByKind.set(r.kind, r)
  }
  const out: UpcomingCheck[] = []
  for (const [kind, r] of latestByKind) {
    const months = RECHECK_MONTHS[kind]
    const due = r.next_check_date ?? (months ? addMonthsISO(r.report_date, months) : null)
    if (!due) continue
    const daysLeft = daysBetween(today, due)
    out.push({
      kind,
      label: MEDICAL_KIND_LABELS[kind],
      lastDate: r.report_date,
      dueDate: due,
      fromReport: Boolean(r.next_check_date),
      daysLeft,
      status: daysLeft < 0 ? "overdue" : daysLeft <= 45 ? "soon" : "planned",
    })
  }
  return out.sort((a, b) => a.dueDate.localeCompare(b.dueDate))
}

/* ------------------------------ Osservazioni -------------------------------- */

export type BpClass = "optimal" | "elevated" | "hypertension"

/** Classificazione ESC 2024 della pressione in ambulatorio. */
export function bpClass(sys: number, dia: number): { cls: BpClass; label: string } {
  if (sys >= 140 || dia >= 90) return { cls: "hypertension", label: "Ipertensione" }
  if (sys >= 120 || dia >= 70) return { cls: "elevated", label: "Pressione elevata (120–139 / 70–89)" }
  return { cls: "optimal", label: "Pressione non elevata" }
}

export function latestValue(reports: MedicalReport[], code: string): { value: number; date: string; m: MedicalMeasurement } | null {
  const sorted = [...reports].sort((a, b) => b.report_date.localeCompare(a.report_date))
  for (const r of sorted) {
    const m = r.measurements.find((x) => x.code === code && isNum(x.value))
    if (m && isNum(m.value)) return { value: m.value, date: r.report_date, m }
  }
  return null
}

export interface MedicalAnalysis {
  reports: MedicalReport[]
  series: MeasureSeries[]
  upcoming: UpcomingCheck[]
  insights: Insight[]
  latestByKind: Map<MedicalReportKind, MedicalReport>
  abnormalCount: number
}

export function analyzeMedical(reports: MedicalReport[], sex: Sex | null, today: string): MedicalAnalysis {
  const sorted = [...reports].sort((a, b) => b.report_date.localeCompare(a.report_date))
  const latestByKind = new Map<MedicalReportKind, MedicalReport>()
  for (const r of sorted) if (!latestByKind.has(r.kind)) latestByKind.set(r.kind, r)

  const series = buildMeasureSeries(sorted, sex)
  const upcoming = upcomingChecks(sorted, today)
  const insights: Insight[] = []

  for (const r of latestByKind.values()) {
    // la pressione ha già un'osservazione dedicata basata sui valori
    const bpWithValues = r.kind === "blood_pressure" && r.measurements.some((m) => m.code === "systolic")
    if (!bpWithValues && (r.outcome === "abnormal" || r.outcome === "borderline")) {
      insights.push({
        id: `outcome-${r.id}`,
        kind: r.outcome === "abnormal" ? "alert" : "watch",
        title: `${r.title}: ${r.outcome === "abnormal" ? "esito alterato" : "da monitorare"}`,
        detail: `${formatDate(r.report_date, "long")}. ${r.conclusion ?? r.summary ?? "Rileggi il referto con il medico."}`,
      })
    }
  }

  const qtc = latestValue(sorted, "qtc_ms")
  if (qtc) {
    const high = measureRange(qtc.m, sex).high ?? (sex === "female" ? 460 : 450)
    if (qtc.value > high) {
      insights.push({
        id: "qtc-long",
        kind: qtc.value >= 500 ? "alert" : "watch",
        title: `QTc ${formatNumber(qtc.value, 0)} ms: sopra il limite`,
        detail: "Un QT lungo va valutato dal cardiologo. Alcuni farmaci e integratori (e carenze di potassio o magnesio) possono allungarlo.",
      })
    } else {
      insights.push({ id: "qtc-ok", kind: "strength", title: `QTc ${formatNumber(qtc.value, 0)} ms nella norma`, detail: `ECG del ${formatDate(qtc.date, "long")}.` })
    }
  }

  const sys = latestValue(sorted, "systolic")
  const dia = latestValue(sorted, "diastolic")
  if (sys && dia && sys.date === dia.date) {
    const c = bpClass(sys.value, dia.value)
    insights.push({
      id: "bp",
      kind: c.cls === "optimal" ? "strength" : c.cls === "elevated" ? "watch" : "alert",
      title: `Pressione ${formatNumber(sys.value, 0)}/${formatNumber(dia.value, 0)} mmHg: ${c.label.toLowerCase()}`,
      detail:
        c.cls === "optimal"
          ? "Valori ottimali secondo le linee guida europee 2024."
          : "Una singola misura in ambulatorio può essere alta per l'ansia: confermala con misure a casa (mattina e sera per 7 giorni).",
    })
  }

  const hr = latestValue(sorted, "heart_rate")
  if (hr && hr.value < 50) {
    insights.push({
      id: "brady",
      kind: "info",
      title: `Frequenza a riposo ${formatNumber(hr.value, 0)} bpm`,
      detail: "Frequenza bassa: negli sportivi è spesso un adattamento all'allenamento. Se hai capogiri o affaticamento parlane con il medico.",
    })
  }

  for (const u of upcoming) {
    if (u.status === "overdue") {
      insights.push({
        id: `due-${u.kind}`,
        kind: "watch",
        title: `${u.label}: controllo scaduto da ${Math.abs(u.daysLeft)} giorni`,
        detail: `Ultimo il ${formatDate(u.lastDate, "long")}${u.fromReport ? " (data indicata nel referto)" : ""}.`,
      })
    }
  }

  const order = { alert: 0, watch: 1, strength: 2, info: 3 } as const
  insights.sort((a, b) => order[a.kind] - order[b.kind])

  return {
    reports: sorted,
    series,
    upcoming,
    insights,
    latestByKind,
    abnormalCount: [...latestByKind.values()].filter((r) => r.outcome === "abnormal").length,
  }
}
