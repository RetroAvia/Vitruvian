-- =============================================================================
--  VITRUVIAN · Migrazione 0004 — Obiettivi personali
--  Valori obiettivo nel profilo + data da cui misurare i progressi.
-- =============================================================================
begin;

alter table public.profiles
  add column if not exists target_weight_kg  numeric(5,2) check (target_weight_kg between 30 and 300),
  add column if not exists target_fat_pct    numeric(4,1) check (target_fat_pct between 3 and 60),
  add column if not exists target_waist_cm   numeric(5,1) check (target_waist_cm between 40 and 200),
  add column if not exists target_ffm_kg     numeric(5,2) check (target_ffm_kg between 20 and 150),
  add column if not exists goals_start_date  date,
  add column if not exists target_date       date;

comment on column public.profiles.goals_start_date is 'Data da cui calcolare l''avanzamento verso gli obiettivi (default: data di impostazione).';

commit;
