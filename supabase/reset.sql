-- =============================================================================
--  VITRUVIAN · RESET — elimina TUTTI gli oggetti creati dalla migrazione.
--  Usalo solo se una migrazione è rimasta a metà. Cancella anche i dati!
--  Non tocca gli utenti di Authentication.
-- =============================================================================
begin;

drop trigger  if exists on_auth_user_created on auth.users;

drop view     if exists public.v_diet_day_totals, public.v_circumference_series, public.v_checkups cascade;

drop function if exists public.upsert_checkup(jsonb), public.import_checkups(jsonb),
                        public.import_diet_plan(jsonb), public.handle_new_user(),
                        public.tg_set_updated_at(), public.tg_validate_date_column(),
                        public.tg_single_active_diet_plan() cascade;

drop table    if exists public.ai_imports, public.meal_logs, public.meal_items, public.meals,
                        public.diet_days, public.diet_plans, public.circumferences,
                        public.measurement_sites, public.bia_readings, public.checkups,
                        public.bia_protocols, public.profiles cascade;

drop type     if exists public.sex_type, public.activity_level, public.data_source,
                        public.body_side, public.meal_slot, public.meal_log_status,
                        public.import_kind, public.import_status cascade;

commit;
