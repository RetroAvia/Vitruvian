/**
 * Tipi di dominio — derivati dai tipi del database, con le garanzie che il
 * database già offre ma che i tipi generati delle viste non esprimono
 * (es. id e data sempre presenti in v_checkups).
 */
import type { Enums, Json, Tables } from "./database.types"

/* ----------------------------- Enum ----------------------------- */
export type Sex = Enums<"sex_type">
export type ActivityLevel = Enums<"activity_level">
export type DataSource = Enums<"data_source">
export type BodySide = Enums<"body_side">
export type MealSlot = Enums<"meal_slot">
export type MealLogStatus = Enums<"meal_log_status">
export type LabCategory = Enums<"lab_category">
export type LabFlag = Enums<"lab_flag">

/* ----------------------------- Righe ---------------------------- */
export type Profile = Tables<"profiles">
export type BiaProtocol = Tables<"bia_protocols">
export type MeasurementSite = Tables<"measurement_sites">
export type DietPlan = Tables<"diet_plans">

type NonNullableKeys<T, K extends keyof T> = Omit<T, K> & { [P in K]-?: NonNullable<T[P]> }

/** Una visita completa, come restituita dalla vista v_checkups. */
export type Checkup = NonNullableKeys<
  Tables<"v_checkups">,
  "id" | "user_id" | "checkup_date" | "visit_number"
>

export type LabAnalyte = Tables<"lab_analytes">
export type LabReport = Tables<"lab_reports">

/** Un risultato di laboratorio con range effettivo (vista v_lab_results). */
export type LabResult = NonNullableKeys<
  Tables<"v_lab_results">,
  "id" | "report_id" | "report_date" | "analyte_id" | "code" | "name" | "category" | "digits" | "sort_order"
>

export type CircumferencePoint = NonNullableKeys<
  Tables<"v_circumference_series">,
  "checkup_date" | "site_code" | "site_label" | "value_cm"
>

/* ----------------------- Payload delle RPC ----------------------- */
/** Payload v1 di public.upsert_checkup — semantica merge (null = non toccare). */
export interface CheckupPayload {
  checkup_date: string // YYYY-MM-DD
  weight_kg?: number | null
  professional?: string | null
  notes?: string | null
  source?: DataSource
  bia?: {
    protocol_id?: string | null
    bmr_kcal?: number | null
    fat_mass_pct?: number | null
    lean_mass_kg?: number | null
    muscle_mass_kg?: number | null
    bone_mass_kg?: number | null
    total_body_water_pct?: number | null
    visceral_fat?: number | null
    phase_angle_deg?: number | null
    metabolic_age?: number | null
    extra?: { [key: string]: Json | undefined }
  } | null
  circumferences?: Array<{
    site: string // code di measurement_sites
    value_cm: number
    side?: BodySide
  }>
}

/* ------------------------- Utente sessione ----------------------- */
export interface SessionUser {
  id: string
  email: string
  displayName: string
}
