/**
 * Tipi del database — formato identico a `supabase gen types typescript`.
 *
 * ⚠️  Questo file è una versione scritta a mano allineata alla migrazione 0001,
 *     così il progetto compila subito. Appena possibile rigeneralo con:
 *       SUPABASE_PROJECT_REF=<ref> npm run db:types
 *     I nomi esportati (Database, Json, Tables, TablesInsert, TablesUpdate,
 *     Enums, Constants) restano gli stessi → nessun import da cambiare.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          target_weight_kg: number | null
          target_fat_pct: number | null
          target_waist_cm: number | null
          target_ffm_kg: number | null
          goals_start_date: string | null
          target_date: string | null
          id: string
          display_name: string | null
          sex: Database["public"]["Enums"]["sex_type"] | null
          birth_date: string | null
          height_cm: number | null
          activity_level: Database["public"]["Enums"]["activity_level"]
          goal: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          target_weight_kg?: number | null
          target_fat_pct?: number | null
          target_waist_cm?: number | null
          target_ffm_kg?: number | null
          goals_start_date?: string | null
          target_date?: string | null
          id: string
          display_name?: string | null
          sex?: Database["public"]["Enums"]["sex_type"] | null
          birth_date?: string | null
          height_cm?: number | null
          activity_level?: Database["public"]["Enums"]["activity_level"]
          goal?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          target_weight_kg?: number | null
          target_fat_pct?: number | null
          target_waist_cm?: number | null
          target_ffm_kg?: number | null
          goals_start_date?: string | null
          target_date?: string | null
          id?: string
          display_name?: string | null
          sex?: Database["public"]["Enums"]["sex_type"] | null
          birth_date?: string | null
          height_cm?: number | null
          activity_level?: Database["public"]["Enums"]["activity_level"]
          goal?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      bia_protocols: {
        Row: {
          id: string
          user_id: string
          name: string
          device: string | null
          location: string | null
          lean_mass_definition: string | null
          notes: string | null
          active_from: string | null
          active_to: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string
          name: string
          device?: string | null
          location?: string | null
          lean_mass_definition?: string | null
          notes?: string | null
          active_from?: string | null
          active_to?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          device?: string | null
          location?: string | null
          lean_mass_definition?: string | null
          notes?: string | null
          active_from?: string | null
          active_to?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      checkups: {
        Row: {
          id: string
          user_id: string
          checkup_date: string
          weight_kg: number | null
          professional: string | null
          notes: string | null
          source: Database["public"]["Enums"]["data_source"]
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string
          checkup_date: string
          weight_kg?: number | null
          professional?: string | null
          notes?: string | null
          source?: Database["public"]["Enums"]["data_source"]
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          checkup_date?: string
          weight_kg?: number | null
          professional?: string | null
          notes?: string | null
          source?: Database["public"]["Enums"]["data_source"]
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      bia_readings: {
        Row: {
          checkup_id: string
          user_id: string
          protocol_id: string | null
          bmr_kcal: number | null
          fat_mass_pct: number | null
          lean_mass_kg: number | null
          muscle_mass_kg: number | null
          bone_mass_kg: number | null
          total_body_water_pct: number | null
          visceral_fat: number | null
          phase_angle_deg: number | null
          metabolic_age: number | null
          extra: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          checkup_id: string
          user_id?: string
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
          extra?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          checkup_id?: string
          user_id?: string
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
          extra?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      measurement_sites: {
        Row: {
          id: number
          user_id: string | null
          code: string
          label: string
          description: string | null
          is_bilateral: boolean
          sort_order: number
          created_at: string
        }
        Insert: {
          id?: number
          user_id?: string | null
          code: string
          label: string
          description?: string | null
          is_bilateral?: boolean
          sort_order?: number
          created_at?: string
        }
        Update: {
          id?: number
          user_id?: string | null
          code?: string
          label?: string
          description?: string | null
          is_bilateral?: boolean
          sort_order?: number
          created_at?: string
        }
        Relationships: []
      }
      circumferences: {
        Row: {
          id: string
          checkup_id: string
          user_id: string
          site_id: number
          side: Database["public"]["Enums"]["body_side"]
          value_cm: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          checkup_id: string
          user_id?: string
          site_id: number
          side?: Database["public"]["Enums"]["body_side"]
          value_cm: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          checkup_id?: string
          user_id?: string
          site_id?: number
          side?: Database["public"]["Enums"]["body_side"]
          value_cm?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      diet_plans: {
        Row: {
          id: string
          user_id: string
          name: string
          professional: string | null
          valid_from: string | null
          valid_to: string | null
          is_active: boolean
          target_kcal: number | null
          target_protein_g: number | null
          target_carbs_g: number | null
          target_fat_g: number | null
          target_fiber_g: number | null
          notes: string | null
          source: Database["public"]["Enums"]["data_source"]
          raw_payload: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string
          name: string
          professional?: string | null
          valid_from?: string | null
          valid_to?: string | null
          is_active?: boolean
          target_kcal?: number | null
          target_protein_g?: number | null
          target_carbs_g?: number | null
          target_fat_g?: number | null
          target_fiber_g?: number | null
          notes?: string | null
          source?: Database["public"]["Enums"]["data_source"]
          raw_payload?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          professional?: string | null
          valid_from?: string | null
          valid_to?: string | null
          is_active?: boolean
          target_kcal?: number | null
          target_protein_g?: number | null
          target_carbs_g?: number | null
          target_fat_g?: number | null
          target_fiber_g?: number | null
          notes?: string | null
          source?: Database["public"]["Enums"]["data_source"]
          raw_payload?: Json | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      diet_days: {
        Row: {
          id: string
          plan_id: string
          user_id: string
          day_of_week: number | null
          label: string
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          plan_id: string
          user_id?: string
          day_of_week?: number | null
          label: string
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          plan_id?: string
          user_id?: string
          day_of_week?: number | null
          label?: string
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      meals: {
        Row: {
          id: string
          day_id: string
          user_id: string
          slot: Database["public"]["Enums"]["meal_slot"]
          label: string | null
          time_hint: string | null
          notes: string | null
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          day_id: string
          user_id?: string
          slot: Database["public"]["Enums"]["meal_slot"]
          label?: string | null
          time_hint?: string | null
          notes?: string | null
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          day_id?: string
          user_id?: string
          slot?: Database["public"]["Enums"]["meal_slot"]
          label?: string | null
          time_hint?: string | null
          notes?: string | null
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      meal_items: {
        Row: {
          id: string
          meal_id: string
          user_id: string
          food_name: string
          quantity: number | null
          unit: string
          kcal: number | null
          protein_g: number | null
          carbs_g: number | null
          fat_g: number | null
          fiber_g: number | null
          alternative_group: number | null
          notes: string | null
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          meal_id: string
          user_id?: string
          food_name: string
          quantity?: number | null
          unit?: string
          kcal?: number | null
          protein_g?: number | null
          carbs_g?: number | null
          fat_g?: number | null
          fiber_g?: number | null
          alternative_group?: number | null
          notes?: string | null
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          meal_id?: string
          user_id?: string
          food_name?: string
          quantity?: number | null
          unit?: string
          kcal?: number | null
          protein_g?: number | null
          carbs_g?: number | null
          fat_g?: number | null
          fiber_g?: number | null
          alternative_group?: number | null
          notes?: string | null
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      meal_logs: {
        Row: {
          id: string
          user_id: string
          meal_id: string
          log_date: string
          status: Database["public"]["Enums"]["meal_log_status"]
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string
          meal_id: string
          log_date?: string
          status?: Database["public"]["Enums"]["meal_log_status"]
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          meal_id?: string
          log_date?: string
          status?: Database["public"]["Enums"]["meal_log_status"]
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      ai_imports: {
        Row: {
          id: string
          user_id: string
          kind: Database["public"]["Enums"]["import_kind"]
          status: Database["public"]["Enums"]["import_status"]
          schema_version: string
          payload: Json
          error: string | null
          target_ids: string[]
          created_at: string
          applied_at: string | null
        }
        Insert: {
          id?: string
          user_id?: string
          kind: Database["public"]["Enums"]["import_kind"]
          status?: Database["public"]["Enums"]["import_status"]
          schema_version?: string
          payload: Json
          error?: string | null
          target_ids?: string[]
          created_at?: string
          applied_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          kind?: Database["public"]["Enums"]["import_kind"]
          status?: Database["public"]["Enums"]["import_status"]
          schema_version?: string
          payload?: Json
          error?: string | null
          target_ids?: string[]
          created_at?: string
          applied_at?: string | null
        }
        Relationships: []
      }
      lab_analytes: {
        Row: {
          id: number
          user_id: string | null
          code: string
          name: string
          category: Database["public"]["Enums"]["lab_category"]
          unit: string | null
          ref_low_m: number | null
          ref_high_m: number | null
          ref_low_f: number | null
          ref_high_f: number | null
          digits: number
          description: string | null
          sort_order: number
          created_at: string
        }
        Insert: {
          id?: number
          user_id?: string | null
          code: string
          name: string
          category?: Database["public"]["Enums"]["lab_category"]
          unit?: string | null
          ref_low_m?: number | null
          ref_high_m?: number | null
          ref_low_f?: number | null
          ref_high_f?: number | null
          digits?: number
          description?: string | null
          sort_order?: number
          created_at?: string
        }
        Update: {
          id?: number
          user_id?: string | null
          code?: string
          name?: string
          category?: Database["public"]["Enums"]["lab_category"]
          unit?: string | null
          ref_low_m?: number | null
          ref_high_m?: number | null
          ref_low_f?: number | null
          ref_high_f?: number | null
          digits?: number
          description?: string | null
          sort_order?: number
          created_at?: string
        }
        Relationships: []
      }
      lab_reports: {
        Row: {
          id: string
          user_id: string
          report_date: string
          lab_name: string | null
          fasting: boolean | null
          notes: string | null
          source: Database["public"]["Enums"]["data_source"]
          raw_payload: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string
          report_date: string
          lab_name?: string | null
          fasting?: boolean | null
          notes?: string | null
          source?: Database["public"]["Enums"]["data_source"]
          raw_payload?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          report_date?: string
          lab_name?: string | null
          fasting?: boolean | null
          notes?: string | null
          source?: Database["public"]["Enums"]["data_source"]
          raw_payload?: Json | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      lab_results: {
        Row: {
          id: string
          report_id: string
          user_id: string
          analyte_id: number
          value: number | null
          value_text: string | null
          unit: string | null
          ref_low: number | null
          ref_high: number | null
          note: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          report_id: string
          user_id?: string
          analyte_id: number
          value?: number | null
          value_text?: string | null
          unit?: string | null
          ref_low?: number | null
          ref_high?: number | null
          note?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          report_id?: string
          user_id?: string
          analyte_id?: number
          value?: number | null
          value_text?: string | null
          unit?: string | null
          ref_low?: number | null
          ref_high?: number | null
          note?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      v_checkups: {
        Row: {
          id: string | null
          user_id: string | null
          checkup_date: string | null
          weight_kg: number | null
          professional: string | null
          notes: string | null
          source: Database["public"]["Enums"]["data_source"] | null
          protocol_id: string | null
          protocol_name: string | null
          bmr_kcal: number | null
          fat_mass_pct: number | null
          lean_mass_kg: number | null
          muscle_mass_kg: number | null
          bone_mass_kg: number | null
          total_body_water_pct: number | null
          visceral_fat: number | null
          phase_angle_deg: number | null
          metabolic_age: number | null
          bia_extra: Json | null
          fat_mass_kg: number | null
          ffm_kg: number | null
          tbw_kg: number | null
          lean_mass_pct: number | null
          waist_cm: number | null
          abdomen_cm: number | null
          chest_cm: number | null
          arm_cm: number | null
          thigh_cm: number | null
          hips_cm: number | null
          all_sites: Json | null
          height_cm: number | null
          bmi: number | null
          ffmi: number | null
          ffmi_normalized: number | null
          waist_to_height: number | null
          waist_to_abdomen: number | null
          waist_to_hip: number | null
          visit_number: number | null
          days_since_prev: number | null
        }
        Relationships: []
      }
      v_circumference_series: {
        Row: {
          user_id: string | null
          checkup_date: string | null
          site_code: string | null
          site_label: string | null
          side: Database["public"]["Enums"]["body_side"] | null
          value_cm: number | null
          sort_order: number | null
        }
        Relationships: []
      }
      v_diet_day_totals: {
        Row: {
          user_id: string | null
          plan_id: string | null
          day_id: string | null
          day_of_week: number | null
          day_label: string | null
          kcal: number | null
          protein_g: number | null
          carbs_g: number | null
          fat_g: number | null
          fiber_g: number | null
          meals_count: number | null
        }
        Relationships: []
      }
      v_lab_results: {
        Row: {
          id: string | null
          user_id: string | null
          report_id: string | null
          report_date: string | null
          lab_name: string | null
          fasting: boolean | null
          analyte_id: number | null
          code: string | null
          name: string | null
          category: Database["public"]["Enums"]["lab_category"] | null
          digits: number | null
          sort_order: number | null
          unit: string | null
          value: number | null
          value_text: string | null
          note: string | null
          ref_low: number | null
          ref_high: number | null
          ref_from_lab: boolean | null
        }
        Relationships: []
      }
    }
    Functions: {
      upsert_checkup: {
        Args: { p: Json }
        Returns: string
      }
      save_checkup: {
        Args: { p: Json }
        Returns: string
      }
      import_lab_reports: {
        Args: { p: Json }
        Returns: string[]
      }
      import_checkups: {
        Args: { p: Json }
        Returns: string[]
      }
      import_diet_plan: {
        Args: { p: Json }
        Returns: string
      }
    }
    Enums: {
      activity_level: "sedentary" | "light" | "moderate" | "active" | "very_active"
      body_side: "none" | "left" | "right"
      data_source: "manual" | "ai_import" | "sheet_import"
      import_kind: "checkup" | "diet" | "lab"
      import_status: "pending" | "applied" | "rejected" | "failed"
      lab_category:
        | "metabolic"
        | "lipids"
        | "liver"
        | "kidney"
        | "blood_count"
        | "iron"
        | "vitamins"
        | "thyroid"
        | "hormones"
        | "inflammation"
        | "electrolytes"
        | "muscle"
        | "other"
      lab_flag: "low" | "normal" | "high" | "unknown"
      meal_log_status: "done" | "skipped" | "swapped"
      meal_slot:
        | "breakfast"
        | "morning_snack"
        | "lunch"
        | "afternoon_snack"
        | "dinner"
        | "evening_snack"
        | "pre_workout"
        | "post_workout"
        | "other"
      sex_type: "male" | "female"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

/* ---------- Helper (stessa firma d'uso della CLI: Tables<"checkups">) ---------- */

type PublicSchema = Database["public"]
type TablesAndViews = PublicSchema["Tables"] & PublicSchema["Views"]

export type Tables<T extends keyof TablesAndViews> = TablesAndViews[T]["Row"]
export type TablesInsert<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Insert"]
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Update"]
export type Enums<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T]

export const Constants = {
  public: {
    Enums: {
      activity_level: ["sedentary", "light", "moderate", "active", "very_active"],
      body_side: ["none", "left", "right"],
      data_source: ["manual", "ai_import", "sheet_import"],
      import_kind: ["checkup", "diet", "lab"],
      import_status: ["pending", "applied", "rejected", "failed"],
      lab_category: [
        "metabolic",
        "lipids",
        "liver",
        "kidney",
        "blood_count",
        "iron",
        "vitamins",
        "thyroid",
        "hormones",
        "inflammation",
        "electrolytes",
        "muscle",
        "other",
      ],
      lab_flag: ["low", "normal", "high", "unknown"],
      meal_log_status: ["done", "skipped", "swapped"],
      meal_slot: [
        "breakfast",
        "morning_snack",
        "lunch",
        "afternoon_snack",
        "dinner",
        "evening_snack",
        "pre_workout",
        "post_workout",
        "other",
      ],
      sex_type: ["male", "female"],
    },
  },
} as const
