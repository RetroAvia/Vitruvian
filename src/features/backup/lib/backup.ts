/**
 * Backup completo dei dati personali e ripristino.
 *
 * - Esportazione: tutte le tabelle dell'utente in un unico JSON leggibile
 *   (le policy RLS garantiscono che arrivino solo i tuoi dati).
 * - Ripristino: passa dalle stesse RPC transazionali dell'AI Bridge, in modalità
 *   "unione": aggiunge o aggiorna, non cancella mai nulla. Visite, analisi,
 *   referti e integratori sono idempotenti (stessa data/nome = aggiornamento);
 *   le diete vengono ricreate solo se non esiste già un piano con lo stesso nome.
 */
import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database, Json, Tables, TablesUpdate } from "@/types/database.types"

type Client = SupabaseClient<Database>

export const BACKUP_FORMAT = "vitruvian.backup.v1"

const TABLES = [
  "profiles",
  "bia_protocols",
  "measurement_sites",
  "checkups",
  "bia_readings",
  "circumferences",
  "lab_analytes",
  "lab_reports",
  "lab_results",
  "medical_reports",
  "supplements",
  "supplement_logs",
  "diet_plans",
  "diet_days",
  "meals",
  "meal_items",
  "meal_logs",
  "training_plans",
  "training_days",
  "training_exercises",
  "workouts",
] as const

type TableName = (typeof TABLES)[number]

/** Tabella delle serie della migrazione 0007 (backup precedenti alla 0008). */
interface LegacySet {
  workout_id: string
  exercise_code: string
  exercise_name: string
  set_index: number
  reps: number | null
  weight_kg: number | null
  rpe: number | null
  duration_min: number | null
  is_warmup: boolean
}

export interface BackupFile {
  format: typeof BACKUP_FORMAT
  app: "Vitruvian"
  exported_at: string
  account: string
  counts: Partial<Record<TableName, number>>
  tables: Partial<Record<TableName | "workout_sets", unknown[]>>
}

const PAGE = 1000

async function fetchAll(client: Client, table: TableName): Promise<unknown[]> {
  const rows: unknown[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await client.from(table).select("*").range(from, from + PAGE - 1)
    if (error) {
      // tabella non ancora creata (migrazione non eseguita): la saltiamo
      if (error.code === "42P01" || error.code === "PGRST205") return []
      throw new Error(`${table}: ${error.message}`)
    }
    rows.push(...(data ?? []))
    if (!data || data.length < PAGE) break
  }
  return rows
}

export async function createBackup(client: Client, account: string, onProgress?: (p: number) => void): Promise<BackupFile> {
  const tables: BackupFile["tables"] = {}
  const counts: BackupFile["counts"] = {}
  let i = 0
  for (const t of TABLES) {
    let rows = await fetchAll(client, t)
    // cataloghi di sistema (user_id null) esclusi: si ricreano con le migrazioni
    if (t === "measurement_sites" || t === "lab_analytes") rows = rows.filter((r) => (r as { user_id: string | null }).user_id !== null)
    tables[t] = rows
    counts[t] = rows.length
    onProgress?.(++i / TABLES.length)
  }
  // i siti/esami di sistema servono per tradurre gli id in codici durante il ripristino
  const sites = await fetchAll(client, "measurement_sites")
  const analytes = await fetchAll(client, "lab_analytes")
  tables.measurement_sites = sites
  tables.lab_analytes = analytes
  return { format: BACKUP_FORMAT, app: "Vitruvian", exported_at: new Date().toISOString(), account, counts, tables }
}

export function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export function parseBackup(text: string): BackupFile {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error("Il file non è un JSON valido")
  }
  const b = data as Partial<BackupFile>
  if (!b || b.format !== BACKUP_FORMAT || typeof b.tables !== "object" || b.tables === null) {
    throw new Error("Il file non è un backup di Vitruvian")
  }
  return b as BackupFile
}

/* ------------------------------- Ripristino -------------------------------- */

export interface RestoreReport {
  protocols: number
  checkups: number
  labs: number
  medical: number
  supplements: number
  supplementLogs: number
  diets: number
  mealLogs: number
  skippedDiets: string[]
  trainingPlans: number
  workouts: number
}

const rows = <T,>(b: BackupFile, t: TableName | "workout_sets") => (b.tables[t] ?? []) as T[]

export async function restoreBackup(client: Client, b: BackupFile, onStep?: (label: string) => void): Promise<RestoreReport> {
  const report: RestoreReport = { protocols: 0, checkups: 0, labs: 0, medical: 0, supplements: 0, supplementLogs: 0, diets: 0, mealLogs: 0, skippedDiets: [], trainingPlans: 0, workouts: 0 }

  /* 1. Strumenti BIA: per nome, creando quelli mancanti */
  onStep?.("Strumenti BIA")
  const oldProtocols = rows<Tables<"bia_protocols">>(b, "bia_protocols")
  const { data: curProtocols, error: pe } = await client.from("bia_protocols").select("id, name")
  if (pe) throw new Error(pe.message)
  const protocolMap = new Map<string, string>()
  for (const p of oldProtocols) {
    let id = curProtocols?.find((c) => c.name === p.name)?.id
    if (!id) {
      const { data, error } = await client
        .from("bia_protocols")
        .insert({ name: p.name, device: p.device, location: p.location, lean_mass_definition: p.lean_mass_definition, notes: p.notes, active_from: p.active_from, active_to: p.active_to })
        .select("id")
        .single()
      if (error) throw new Error(`Strumento ${p.name}: ${error.message}`)
      id = data.id
      report.protocols++
    }
    protocolMap.set(p.id, id)
  }

  /* 2. Profilo: solo campi vuoti (non sovrascrive ciò che hai già impostato) */
  const oldProfile = rows<Tables<"profiles">>(b, "profiles")[0]
  if (oldProfile) {
    const { data: cur } = await client.from("profiles").select("*").maybeSingle()
    if (cur) {
      const patch: Record<string, unknown> = {}
      for (const k of ["display_name", "sex", "birth_date", "height_cm", "goal", "target_weight_kg", "target_fat_pct", "target_waist_cm", "target_ffm_kg", "goals_start_date", "target_date"] as const) {
        if ((cur as Record<string, unknown>)[k] == null && (oldProfile as Record<string, unknown>)[k] != null) patch[k] = (oldProfile as Record<string, unknown>)[k]
      }
      if (Object.keys(patch).length) await client.from("profiles").update(patch as TablesUpdate<"profiles">).eq("id", cur.id)
    }
  }

  /* 3. Visite (import_checkups, idempotente per data) */
  onStep?.("Visite")
  // siti di misura personalizzati: ricreati se mancano (altrimenti le visite verrebbero rifiutate)
  const customSites = rows<Tables<"measurement_sites">>(b, "measurement_sites").filter((x) => x.user_id)
  if (customSites.length) {
    const { data: curSites, error: se } = await client.from("measurement_sites").select("code")
    if (se) throw new Error(se.message)
    const known = new Set((curSites ?? []).map((x) => x.code))
    const { data: auth } = await client.auth.getUser()
    const missing = customSites.filter((x) => !known.has(x.code))
    const uid = auth.user?.id
    if (missing.length && uid) {
      const { error } = await client
        .from("measurement_sites")
        .insert(missing.map((x) => ({ user_id: uid, code: x.code, label: x.label, description: x.description, is_bilateral: x.is_bilateral, sort_order: x.sort_order })))
      if (error) throw new Error(`Siti di misura: ${error.message}`)
    }
  }
  const sites = new Map(rows<Tables<"measurement_sites">>(b, "measurement_sites").map((s) => [s.id, s.code]))
  const bia = new Map(rows<Tables<"bia_readings">>(b, "bia_readings").map((r) => [r.checkup_id, r]))
  const circ = rows<Tables<"circumferences">>(b, "circumferences")
  const checkups = rows<Tables<"checkups">>(b, "checkups").map((c) => {
    const r = bia.get(c.id)
    return {
      checkup_date: c.checkup_date,
      weight_kg: c.weight_kg,
      professional: c.professional,
      notes: c.notes,
      source: c.source,
      bia: r
        ? {
            protocol_id: r.protocol_id ? (protocolMap.get(r.protocol_id) ?? null) : null,
            bmr_kcal: r.bmr_kcal,
            fat_mass_pct: r.fat_mass_pct,
            lean_mass_kg: r.lean_mass_kg,
            muscle_mass_kg: r.muscle_mass_kg,
            bone_mass_kg: r.bone_mass_kg,
            total_body_water_pct: r.total_body_water_pct,
            visceral_fat: r.visceral_fat,
            phase_angle_deg: r.phase_angle_deg,
            metabolic_age: r.metabolic_age,
            extra: r.extra,
          }
        : null,
      circumferences: circ
        .filter((x) => x.checkup_id === c.id && sites.has(x.site_id))
        .map((x) => ({ site: sites.get(x.site_id), side: x.side, value_cm: x.value_cm })),
    }
  })
  if (checkups.length) {
    const { data, error } = await client.rpc("import_checkups", { p: { checkups, source: "manual" } as unknown as Json })
    if (error) throw new Error(`Visite: ${error.message}`)
    report.checkups = data?.length ?? 0
  }

  /* 4. Analisi del sangue */
  onStep?.("Analisi del sangue")
  const analytes = new Map(rows<Tables<"lab_analytes">>(b, "lab_analytes").map((a) => [a.id, a]))
  const results = rows<Tables<"lab_results">>(b, "lab_results")
  const labReports = rows<Tables<"lab_reports">>(b, "lab_reports").map((r) => ({
    report_date: r.report_date,
    lab_name: r.lab_name,
    fasting: r.fasting,
    notes: r.notes,
    results: results
      .filter((x) => x.report_id === r.id && analytes.has(x.analyte_id))
      .map((x) => {
        const a = analytes.get(x.analyte_id) as Tables<"lab_analytes">
        return { code: a.code, name: a.name, category: a.category, value: x.value, value_text: x.value_text, unit: x.unit, ref_low: x.ref_low, ref_high: x.ref_high, note: x.note }
      }),
  }))
  if (labReports.length) {
    const { data, error } = await client.rpc("import_lab_reports", { p: { reports: labReports, source: "manual" } as unknown as Json })
    if (error) throw new Error(`Analisi: ${error.message}`)
    report.labs = data?.length ?? 0
  }

  /* 5. Referti medici */
  onStep?.("Referti")
  const medical = rows<Tables<"medical_reports">>(b, "medical_reports").map(({ id: _id, user_id: _u, created_at: _c, updated_at: _up, raw_payload: _r, ...rest }) => rest)
  if (medical.length) {
    const { data, error } = await client.rpc("import_medical_reports", { p: { reports: medical, source: "manual" } as unknown as Json })
    if (error) throw new Error(`Referti: ${error.message}`)
    report.medical = data?.length ?? 0
  }

  /* 6. Integratori + checklist */
  onStep?.("Integratori")
  const oldSups = rows<Tables<"supplements">>(b, "supplements")
  if (oldSups.length) {
    const payload = oldSups.map(({ id: _id, user_id: _u, created_at: _c, updated_at: _up, raw_payload: _r, source: _s, sort_order: _o, ...rest }) => rest)
    const { data, error } = await client.rpc("import_supplements", { p: { supplements: payload, source: "manual" } as unknown as Json })
    if (error) throw new Error(`Integratori: ${error.message}`)
    report.supplements = data?.length ?? 0
    // la RPC restituisce gli id nello stesso ordine del payload
    const idMap = new Map(oldSups.map((s, i) => [s.id, data?.[i]]))
    const logs = rows<Tables<"supplement_logs">>(b, "supplement_logs")
      .filter((l) => idMap.get(l.supplement_id))
      .map((l) => ({ supplement_id: idMap.get(l.supplement_id) as string, log_date: l.log_date, taken: l.taken }))
    for (let i = 0; i < logs.length; i += 500) {
      const { error: le } = await client.from("supplement_logs").upsert(logs.slice(i, i + 500), { onConflict: "user_id,supplement_id,log_date" })
      if (le) throw new Error(`Checklist integratori: ${le.message}`)
    }
    report.supplementLogs = logs.length
  }

  /* 7. Diete (solo quelle che non esistono già) */
  onStep?.("Diete")
  const { data: curPlans } = await client.from("diet_plans").select("name")
  const existing = new Set((curPlans ?? []).map((p) => p.name))
  const days = rows<Tables<"diet_days">>(b, "diet_days")
  const meals = rows<Tables<"meals">>(b, "meals")
  const items = rows<Tables<"meal_items">>(b, "meal_items")
  for (const plan of rows<Tables<"diet_plans">>(b, "diet_plans")) {
    if (existing.has(plan.name)) {
      report.skippedDiets.push(plan.name)
      continue
    }
    const payload = {
      name: plan.name,
      professional: plan.professional,
      valid_from: plan.valid_from,
      valid_to: plan.valid_to,
      activate: plan.is_active,
      notes: plan.notes,
      source: "manual",
      targets: { kcal: plan.target_kcal, protein_g: plan.target_protein_g, carbs_g: plan.target_carbs_g, fat_g: plan.target_fat_g, fiber_g: plan.target_fiber_g },
      days: days
        .filter((d) => d.plan_id === plan.id)
        .sort((a, c) => a.sort_order - c.sort_order)
        .map((d) => ({
          day_of_week: d.day_of_week,
          label: d.label,
          meals: meals
            .filter((m) => m.day_id === d.id)
            .sort((a, c) => a.sort_order - c.sort_order)
            .map((m) => ({
              slot: m.slot,
              label: m.label,
              time: m.time_hint ? m.time_hint.slice(0, 5) : null,
              notes: m.notes,
              items: items
                .filter((it) => it.meal_id === m.id)
                .sort((a, c) => a.sort_order - c.sort_order)
                .map((it) => ({ food: it.food_name, quantity: it.quantity, unit: it.unit, kcal: it.kcal, protein_g: it.protein_g, carbs_g: it.carbs_g, fat_g: it.fat_g, fiber_g: it.fiber_g, alternative_group: it.alternative_group, notes: it.notes })),
            })),
        })),
    }
    const { data: newPlanId, error } = await client.rpc("import_diet_plan", { p: payload as unknown as Json })
    if (error) throw new Error(`Dieta ${plan.name}: ${error.message}`)
    report.diets++

    // checklist dei pasti: i pasti nuovi corrispondono ai vecchi nello stesso ordine (giorno → pasto)
    const oldLogs = rows<Tables<"meal_logs">>(b, "meal_logs")
    if (oldLogs.length && newPlanId) {
      const { data: nDays } = await client.from("diet_days").select("id, sort_order").eq("plan_id", newPlanId).order("sort_order")
      const { data: nMeals } = await client.from("meals").select("id, day_id, sort_order").in("day_id", (nDays ?? []).map((d) => d.id)).order("sort_order")
      const oDays = days.filter((d) => d.plan_id === plan.id).sort((a, c) => a.sort_order - c.sort_order)
      const mealMap = new Map<string, string>()
      oDays.forEach((od, i) => {
        const nd = nDays?.[i]
        if (!nd) return
        const om = meals.filter((m) => m.day_id === od.id).sort((a, c) => a.sort_order - c.sort_order)
        const nm = (nMeals ?? []).filter((m) => m.day_id === nd.id)
        om.forEach((m, j) => {
          const target = nm[j]
          if (target) mealMap.set(m.id, target.id)
        })
      })
      const logs = oldLogs.filter((l) => mealMap.has(l.meal_id)).map((l) => ({ meal_id: mealMap.get(l.meal_id) as string, log_date: l.log_date, status: l.status, notes: l.notes }))
      for (let i = 0; i < logs.length; i += 500) {
        const { error: le } = await client.from("meal_logs").upsert(logs.slice(i, i + 500), { onConflict: "user_id,meal_id,log_date" })
        if (le) throw new Error(`Checklist pasti: ${le.message}`)
      }
      report.mealLogs += logs.length
    }
  }

  /* 8. Allenamento: schede (con le sessioni collegate) e poi le sessioni libere */
  onStep?.("Allenamento")
  const tDays = rows<Tables<"training_days">>(b, "training_days")
  const tEx = rows<Tables<"training_exercises">>(b, "training_exercises")
  const legacy = rows<LegacySet>(b, "workout_sets")
  const allWorkouts = rows<Tables<"workouts">>(b, "workouts")
  const dayLabel = new Map(tDays.map((d) => [d.id, d.label]))
  const TYPES = ["normal", "warmup", "drop", "rest_pause", "failure"] as const
  const toHistory = (w: Tables<"workouts">) => {
    let exercises: Array<{ code: string; name: string; sets: unknown[] }>
    if (Array.isArray(w.exercises) && w.exercises.length > 0) {
      // formato compatto (0008): { c, n, s: [[reps, kg, rpe, tipo]], m }
      exercises = (w.exercises as Array<{ c: string; n: string; s?: Array<[number, number | null, number | null, number]>; m?: number | null }>).map((e) => ({
        code: e.c,
        name: e.n,
        sets: e.m ? [{ reps: null, weight_kg: null, duration_min: e.m }] : (e.s ?? []).map((x) => ({ reps: x[0], weight_kg: x[1], rpe: x[2], type: TYPES[x[3]] ?? "normal" })),
      }))
    } else {
      const byCode = new Map<string, { code: string; name: string; sets: unknown[] }>()
      for (const s of legacy.filter((x) => x.workout_id === w.id).sort((a, c) => a.set_index - c.set_index)) {
        const g = byCode.get(s.exercise_code) ?? { code: s.exercise_code, name: s.exercise_name, sets: [] }
        g.sets.push({ reps: s.reps, weight_kg: s.weight_kg, rpe: s.rpe, duration_min: s.duration_min, warmup: s.is_warmup })
        byCode.set(s.exercise_code, g)
      }
      exercises = [...byCode.values()]
    }
    return { date: w.workout_date, title: w.title, day_label: w.plan_day_id ? (dayLabel.get(w.plan_day_id) ?? null) : null, duration_min: w.duration_min, session_rpe: w.session_rpe, notes: w.notes, exercises }
  }
  const linked = new Set<string>()
  for (const plan of rows<Tables<"training_plans">>(b, "training_plans")) {
    const days = tDays.filter((d) => d.plan_id === plan.id).sort((a, c) => a.sort_order - c.sort_order)
    const dayIds = new Set(days.map((d) => d.id))
    const history = allWorkouts.filter((w) => w.plan_day_id && dayIds.has(w.plan_day_id))
    history.forEach((w) => linked.add(w.id))
    const payload = {
      source: "manual",
      activate: plan.is_active,
      plan: {
        name: plan.name,
        coach: plan.coach,
        goal: plan.goal,
        split: plan.split,
        days_per_week: plan.days_per_week,
        valid_from: plan.valid_from,
        valid_to: plan.valid_to,
        notes: plan.notes,
        days: days.map((d) => ({
          label: d.label,
          day_of_week: d.day_of_week,
          focus: d.focus,
          exercises: tEx
            .filter((e) => e.day_id === d.id)
            .sort((a, c) => a.sort_order - c.sort_order)
            .map(({ id: _i, day_id: _d, user_id: _u, created_at: _c, updated_at: _up, sort_order: _o, exercise_code, ...rest }) => ({ code: exercise_code, ...rest })),
        })),
      },
      history: history.map(toHistory),
    }
    const { data, error } = await client.rpc("import_training", { p: payload as unknown as Json })
    if (error) throw new Error(`Scheda ${plan.name}: ${error.message}`)
    report.trainingPlans++
    report.workouts += (data as { workouts?: number } | null)?.workouts ?? 0
  }
  const free = allWorkouts.filter((w) => !linked.has(w.id)).map(toHistory)
  for (let i = 0; i < free.length; i += 200) {
    const { data, error } = await client.rpc("import_training", { p: { source: "manual", history: free.slice(i, i + 200) } as unknown as Json })
    if (error) throw new Error(`Sessioni: ${error.message}`)
    report.workouts += (data as { workouts?: number } | null)?.workouts ?? 0
  }

  return report
}
