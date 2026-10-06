-- =============================================================================
--  VITRUVIAN · Health & Body Composition Tracker
--  Migrazione 0001 — Schema iniziale
--  Target: Supabase (PostgreSQL 15+)
--
--  Contenuto:
--    1. Tipi ENUM
--    2. Funzioni utility (updated_at, validazione date)
--    3. Profilo utente (+ trigger auto-creazione su signup)
--    4. Dominio "Controlli": checkups · bia_protocols · bia_readings
--                           measurement_sites · circumferences
--    5. Dominio "Nutrizione": diet_plans · diet_days · meals · meal_items · meal_logs
--    6. Audit AI Bridge: ai_imports
--    7. Indici
--    8. Row Level Security
--    9. Viste analitiche (security_invoker)
--   10. RPC transazionali per l'AI Bridge e i form
--
--  Principi:
--    • Ogni tabella possiede user_id (default auth.uid()) → RLS semplice e veloce.
--    • Le tabelle figlie usano FK COMPOSITE (parent_id, user_id): il database
--      rende impossibile agganciare un record figlio a un padre di un altro utente.
--    • Un "checkup" è la visita: il peso vive lì UNA sola volta, BIA e
--      circonferenze sono satelliti opzionali (niente doppioni come nel foglio).
--    • Le circonferenze sono un modello "sito + valore": aggiungere fianchi,
--      polpacci o spalle non richiede migrazioni, solo una riga in measurement_sites.
-- =============================================================================

-- Tutto in un'unica transazione: o va a buon fine tutto, o non viene creato nulla.
begin;

-- -----------------------------------------------------------------------------
-- 1. ENUM
-- -----------------------------------------------------------------------------
create type public.sex_type        as enum ('male', 'female');
create type public.activity_level  as enum ('sedentary', 'light', 'moderate', 'active', 'very_active');
create type public.data_source     as enum ('manual', 'ai_import', 'sheet_import');
create type public.body_side       as enum ('none', 'left', 'right');
create type public.meal_slot       as enum (
  'breakfast', 'morning_snack', 'lunch', 'afternoon_snack',
  'dinner', 'evening_snack', 'pre_workout', 'post_workout', 'other'
);
create type public.meal_log_status as enum ('done', 'skipped', 'swapped');
create type public.import_kind     as enum ('checkup', 'diet');
create type public.import_status   as enum ('pending', 'applied', 'rejected', 'failed');

-- -----------------------------------------------------------------------------
-- 2. FUNZIONI UTILITY
-- -----------------------------------------------------------------------------

-- Aggiorna automaticamente updated_at
create or replace function public.tg_set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Valida una colonna data passata come argomento del trigger:
--   • non nel futuro (tolleranza +1 giorno per fusi orari)
--   • non prima del 2000 (evita errori di parsing tipo 0026-05-25)
create or replace function public.tg_validate_date_column()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_col  text := tg_argv[0];
  v_date date := (to_jsonb(new) ->> v_col)::date;
begin
  if v_date is null then
    return new;
  end if;
  if v_date > current_date + 1 then
    raise exception 'La data % (%) è nel futuro', v_date, v_col
      using errcode = '22007', hint = 'Controlla il formato della data (YYYY-MM-DD).';
  end if;
  if v_date < date '2000-01-01' then
    raise exception 'La data % (%) è troppo vecchia: probabile errore di formato', v_date, v_col
      using errcode = '22007';
  end if;
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- 3. PROFILO
-- -----------------------------------------------------------------------------
create table public.profiles (
  id              uuid primary key references auth.users (id) on delete cascade,
  display_name    text,
  sex             public.sex_type,
  birth_date      date check (birth_date between date '1900-01-01' and current_date),
  height_cm       numeric(5,1) check (height_cm between 100 and 250),
  activity_level  public.activity_level not null default 'moderate',
  goal            text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
comment on table public.profiles is 'Dati anagrafici necessari al motore biometrico (altezza → BMI/FFMI/WHtR, sesso → range di riferimento, attività → TDEE).';

-- Crea il profilo alla registrazione dell'utente
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- 4. DOMINIO CONTROLLI
-- -----------------------------------------------------------------------------

-- 4.1 Protocolli BIA
-- Un protocollo = strumento + studio + definizione delle grandezze.
-- Serve a NON confrontare mele con pere: se cambia la bilancia/il software,
-- il motore biometrico segmenta i trend invece di segnalare falsi "+20 kg di magra".
create table public.bia_protocols (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name                  text not null check (length(trim(name)) > 0),
  device                text,
  location              text,
  lean_mass_definition  text,   -- es. "Massa muscolare scheletrica" vs "Fat-Free Mass"
  notes                 text,
  active_from           date,
  active_to             date,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (user_id, name),
  unique (id, user_id),
  check (active_to is null or active_from is null or active_to >= active_from)
);

-- 4.2 Checkup (la visita)
create table public.checkups (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  checkup_date  date not null,
  weight_kg     numeric(5,2) check (weight_kg between 20 and 350),
  professional  text,
  notes         text,
  source        public.data_source not null default 'manual',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (user_id, checkup_date),
  unique (id, user_id)
);
comment on table public.checkups is 'Una riga per visita/controllo. Il peso è registrato qui una sola volta.';

-- 4.3 Lettura BIA (1:1 con checkup, opzionale)
create table public.bia_readings (
  checkup_id            uuid primary key,
  user_id               uuid not null default auth.uid(),
  protocol_id           uuid,
  bmr_kcal              integer      check (bmr_kcal between 600 and 5000),
  fat_mass_pct          numeric(4,1) check (fat_mass_pct between 2 and 70),
  lean_mass_kg          numeric(5,2) check (lean_mass_kg between 10 and 150),
  muscle_mass_kg        numeric(5,2) check (muscle_mass_kg between 5 and 120),
  bone_mass_kg          numeric(4,2) check (bone_mass_kg between 0.5 and 10),
  total_body_water_pct  numeric(4,1) check (total_body_water_pct between 30 and 80),
  visceral_fat          numeric(4,1) check (visceral_fat between 0 and 60),
  phase_angle_deg       numeric(4,2) check (phase_angle_deg between 1 and 15),
  metabolic_age         smallint     check (metabolic_age between 10 and 120),
  extra                 jsonb not null default '{}'::jsonb,   -- campi device-specifici (ECW/ICW, segmentale…)
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  foreign key (checkup_id, user_id)  references public.checkups (id, user_id) on delete cascade,
  foreign key (protocol_id, user_id) references public.bia_protocols (id, user_id) on delete set null (protocol_id),
  check (jsonb_typeof(extra) = 'object')
);
comment on column public.bia_readings.fat_mass_pct is 'Massa grassa in %. I kg sono derivati (peso × %) nella vista v_checkups.';
comment on column public.bia_readings.lean_mass_kg is 'Massa magra come RIPORTATA dal referto. La definizione dipende dal protocollo.';

-- 4.4 Siti di misura (catalogo estendibile)
create table public.measurement_sites (
  id            smallint generated by default as identity primary key,
  user_id       uuid references auth.users (id) on delete cascade,  -- NULL = sito di sistema
  code          text not null check (code ~ '^[a-z][a-z0-9_]*$'),
  label         text not null,
  description   text,
  is_bilateral  boolean not null default false,
  sort_order    smallint not null default 100,
  created_at    timestamptz not null default now(),
  constraint measurement_sites_code_uq unique nulls not distinct (user_id, code)
);

insert into public.measurement_sites (code, label, description, is_bilateral, sort_order) values
  ('waist',     'Vita',       'Punto più stretto del tronco, tra costole e cresta iliaca', false, 10),
  ('abdomen',   'Addome',     'Altezza ombelicale',                                         false, 20),
  ('chest',     'Torace',     'Linea dei capezzoli, fine espirazione',                      false, 30),
  ('arm',       'Braccio',    'Punto medio acromion–olecrano, braccio rilassato',           true,  40),
  ('thigh',     'Coscia',     'Punto medio / sotto-gluteo',                                 true,  50),
  ('hips',      'Fianchi',    'Massima circonferenza dei glutei',                           false, 60),
  ('shoulders', 'Spalle',     'Massima circonferenza deltoidea',                            false, 70),
  ('neck',      'Collo',      'Sotto la laringe',                                           false, 80),
  ('forearm',   'Avambraccio','Massima circonferenza',                                      true,  90),
  ('calf',      'Polpaccio',  'Massima circonferenza',                                      true, 100);

-- 4.5 Circonferenze
create table public.circumferences (
  id          uuid primary key default gen_random_uuid(),
  checkup_id  uuid not null,
  user_id     uuid not null default auth.uid(),
  site_id     smallint not null references public.measurement_sites (id) on delete restrict,
  side        public.body_side not null default 'none',
  value_cm    numeric(5,1) not null check (value_cm between 5 and 250),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  foreign key (checkup_id, user_id) references public.checkups (id, user_id) on delete cascade,
  unique (checkup_id, site_id, side)
);

-- -----------------------------------------------------------------------------
-- 5. DOMINIO NUTRIZIONE
-- -----------------------------------------------------------------------------
create table public.diet_plans (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name              text not null check (length(trim(name)) > 0),
  professional      text,
  valid_from        date,
  valid_to          date,
  is_active         boolean not null default false,
  target_kcal       integer      check (target_kcal between 500 and 10000),
  target_protein_g  numeric(6,1) check (target_protein_g >= 0),
  target_carbs_g    numeric(6,1) check (target_carbs_g >= 0),
  target_fat_g      numeric(6,1) check (target_fat_g >= 0),
  target_fiber_g    numeric(6,1) check (target_fiber_g >= 0),
  notes             text,
  source            public.data_source not null default 'manual',
  raw_payload       jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (id, user_id),
  check (valid_to is null or valid_from is null or valid_to >= valid_from)
);

-- Un solo piano attivo per utente: attivarne uno disattiva gli altri
create or replace function public.tg_single_active_diet_plan()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.is_active then
    update public.diet_plans
       set is_active = false
     where user_id = new.user_id
       and id <> new.id
       and is_active;
  end if;
  return new;
end;
$$;

-- Giorni del piano: day_of_week ISO (1 = lunedì … 7 = domenica), NULL = "giorno tipo"
create table public.diet_days (
  id           uuid primary key default gen_random_uuid(),
  plan_id      uuid not null,
  user_id      uuid not null default auth.uid(),
  day_of_week  smallint check (day_of_week between 1 and 7),
  label        text not null,
  sort_order   smallint not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  foreign key (plan_id, user_id) references public.diet_plans (id, user_id) on delete cascade,
  unique (id, user_id)
);

create table public.meals (
  id          uuid primary key default gen_random_uuid(),
  day_id      uuid not null,
  user_id     uuid not null default auth.uid(),
  slot        public.meal_slot not null,
  label       text,
  time_hint   time,
  notes       text,
  sort_order  smallint not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  foreign key (day_id, user_id) references public.diet_days (id, user_id) on delete cascade,
  unique (id, user_id)
);

-- alternative_group: NULL = alimento fisso; stesso numero nello stesso pasto = alternative ("oppure")
create table public.meal_items (
  id                 uuid primary key default gen_random_uuid(),
  meal_id            uuid not null,
  user_id            uuid not null default auth.uid(),
  food_name          text not null check (length(trim(food_name)) > 0),
  quantity           numeric(7,1) check (quantity >= 0),
  unit               text not null default 'g',
  kcal               numeric(7,1) check (kcal >= 0),
  protein_g          numeric(6,1) check (protein_g >= 0),
  carbs_g            numeric(6,1) check (carbs_g >= 0),
  fat_g              numeric(6,1) check (fat_g >= 0),
  fiber_g            numeric(6,1) check (fiber_g >= 0),
  alternative_group  smallint,
  notes              text,
  sort_order         smallint not null default 0,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  foreign key (meal_id, user_id) references public.meals (id, user_id) on delete cascade
);

-- Checklist giornaliera dei pasti
create table public.meal_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid(),
  meal_id     uuid not null,
  log_date    date not null default current_date,
  status      public.meal_log_status not null default 'done',
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  foreign key (meal_id, user_id) references public.meals (id, user_id) on delete cascade,
  unique (user_id, meal_id, log_date)
);

-- -----------------------------------------------------------------------------
-- 6. AUDIT AI BRIDGE
-- -----------------------------------------------------------------------------
create table public.ai_imports (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind            public.import_kind not null,
  status          public.import_status not null default 'pending',
  schema_version  text not null default '1',
  payload         jsonb not null,
  error           text,
  target_ids      uuid[] not null default '{}',
  created_at      timestamptz not null default now(),
  applied_at      timestamptz
);
comment on table public.ai_imports is 'Storico dei JSON incollati dall''AI Bridge: tracciabilità e possibilità di re-import.';

-- -----------------------------------------------------------------------------
-- TRIGGER
-- -----------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'bia_protocols', 'checkups', 'bia_readings', 'circumferences',
    'diet_plans', 'diet_days', 'meals', 'meal_items', 'meal_logs'
  ]
  loop
    execute format(
      'create trigger set_updated_at before update on public.%I
         for each row execute function public.tg_set_updated_at()', t);
  end loop;
end;
$$;

create trigger validate_checkup_date
  before insert or update of checkup_date on public.checkups
  for each row execute function public.tg_validate_date_column('checkup_date');

create trigger validate_log_date
  before insert or update of log_date on public.meal_logs
  for each row execute function public.tg_validate_date_column('log_date');

create trigger single_active_plan
  before insert or update of is_active on public.diet_plans
  for each row when (new.is_active)
  execute function public.tg_single_active_diet_plan();

-- -----------------------------------------------------------------------------
-- 7. INDICI
--    (checkups(user_id, checkup_date) e circumferences(checkup_id, …) sono già
--     coperti dai vincoli UNIQUE)
-- -----------------------------------------------------------------------------
create unique index diet_plans_one_active_uq on public.diet_plans (user_id) where is_active;

create index bia_readings_user_idx        on public.bia_readings (user_id);
create index bia_readings_protocol_idx    on public.bia_readings (protocol_id) where protocol_id is not null;
create index circumferences_user_site_idx on public.circumferences (user_id, site_id);
create index circumferences_site_idx      on public.circumferences (site_id);
create index bia_protocols_user_idx       on public.bia_protocols (user_id);
create index diet_plans_user_idx          on public.diet_plans (user_id, valid_from desc);
create index diet_days_plan_idx           on public.diet_days (plan_id, sort_order);
create index meals_day_idx                on public.meals (day_id, sort_order);
create index meal_items_meal_idx          on public.meal_items (meal_id, sort_order);
create index meal_logs_meal_idx           on public.meal_logs (meal_id);
create index meal_logs_user_date_idx      on public.meal_logs (user_id, log_date desc);
create index ai_imports_user_idx          on public.ai_imports (user_id, created_at desc);

-- -----------------------------------------------------------------------------
-- 8. ROW LEVEL SECURITY
--    (select auth.uid()) è valutato una volta per query → più veloce di auth.uid()
-- -----------------------------------------------------------------------------
alter table public.profiles          enable row level security;
alter table public.bia_protocols     enable row level security;
alter table public.checkups          enable row level security;
alter table public.bia_readings      enable row level security;
alter table public.measurement_sites enable row level security;
alter table public.circumferences    enable row level security;
alter table public.diet_plans        enable row level security;
alter table public.diet_days         enable row level security;
alter table public.meals             enable row level security;
alter table public.meal_items        enable row level security;
alter table public.meal_logs         enable row level security;
alter table public.ai_imports        enable row level security;

-- Profilo: solo il proprio
create policy profiles_select_own on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy profiles_insert_own on public.profiles
  for insert to authenticated with check (id = (select auth.uid()));
create policy profiles_update_own on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Tabelle "owned" generiche: CRUD completo solo sulle proprie righe
do $$
declare
  t text;
begin
  foreach t in array array[
    'bia_protocols', 'checkups', 'bia_readings',
    'diet_plans', 'diet_days', 'meals', 'meal_items', 'meal_logs', 'ai_imports'
  ]
  loop
    execute format(
      'create policy %I on public.%I for all to authenticated
         using (user_id = (select auth.uid()))
         with check (user_id = (select auth.uid()))',
      t || '_owner_all', t);
  end loop;
end;
$$;

-- Siti di misura: leggo quelli di sistema + i miei; modifico solo i miei
create policy measurement_sites_select on public.measurement_sites
  for select to authenticated
  using (user_id is null or user_id = (select auth.uid()));
create policy measurement_sites_insert_own on public.measurement_sites
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy measurement_sites_update_own on public.measurement_sites
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy measurement_sites_delete_own on public.measurement_sites
  for delete to authenticated using (user_id = (select auth.uid()));

-- Circonferenze: proprie righe + il sito deve essere visibile (sistema o mio)
create policy circumferences_owner_select on public.circumferences
  for select to authenticated using (user_id = (select auth.uid()));
create policy circumferences_owner_delete on public.circumferences
  for delete to authenticated using (user_id = (select auth.uid()));
create policy circumferences_owner_insert on public.circumferences
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.measurement_sites s
      where s.id = site_id and (s.user_id is null or s.user_id = (select auth.uid()))
    )
  );
create policy circumferences_owner_update on public.circumferences
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.measurement_sites s
      where s.id = site_id and (s.user_id is null or s.user_id = (select auth.uid()))
    )
  );

-- -----------------------------------------------------------------------------
-- 9. VISTE ANALITICHE
--    security_invoker = true → la vista rispetta la RLS di chi la interroga.
-- -----------------------------------------------------------------------------

-- Vista "larga": una riga per visita con BIA, circonferenze principali e indici derivati.
-- È la sorgente unica per tabella, grafici e Smart Biometric Engine.
create view public.v_checkups
with (security_invoker = true)
as
select
  c.id,
  c.user_id,
  c.checkup_date,
  c.weight_kg,
  c.professional,
  c.notes,
  c.source,
  -- BIA grezza
  b.protocol_id,
  bp.name                                                          as protocol_name,
  b.bmr_kcal,
  b.fat_mass_pct,
  b.lean_mass_kg,
  b.muscle_mass_kg,
  b.bone_mass_kg,
  b.total_body_water_pct,
  b.visceral_fat,
  b.phase_angle_deg,
  b.metabolic_age,
  b.extra                                                          as bia_extra,
  -- BIA derivata (indipendente dalla definizione di "massa magra" del device)
  round(c.weight_kg * b.fat_mass_pct / 100, 2)                     as fat_mass_kg,
  round(c.weight_kg * (1 - b.fat_mass_pct / 100), 2)               as ffm_kg,
  round(c.weight_kg * b.total_body_water_pct / 100, 2)             as tbw_kg,
  round(b.lean_mass_kg / nullif(c.weight_kg, 0) * 100, 1)          as lean_mass_pct,
  -- Circonferenze principali
  circ.waist_cm,
  circ.abdomen_cm,
  circ.chest_cm,
  circ.arm_cm,
  circ.thigh_cm,
  circ.hips_cm,
  circ.all_sites,
  -- Indici antropometrici
  p.height_cm,
  round(c.weight_kg / power(p.height_cm / 100, 2), 2)              as bmi,
  round(c.weight_kg * (1 - b.fat_mass_pct / 100)
        / power(p.height_cm / 100, 2), 2)                          as ffmi,
  round(c.weight_kg * (1 - b.fat_mass_pct / 100)
        / power(p.height_cm / 100, 2)
        + 6.1 * (1.8 - p.height_cm / 100), 2)                      as ffmi_normalized,
  round(circ.waist_cm / nullif(p.height_cm, 0), 3)                 as waist_to_height,
  round(circ.waist_cm / nullif(circ.abdomen_cm, 0), 3)             as waist_to_abdomen,
  round(circ.waist_cm / nullif(circ.hips_cm, 0), 3)                as waist_to_hip,
  -- Contesto temporale
  row_number() over w_asc                                          as visit_number,
  (c.checkup_date - lag(c.checkup_date) over w_asc)                as days_since_prev
from public.checkups c
left join public.bia_readings  b  on b.checkup_id = c.id
left join public.bia_protocols bp on bp.id = b.protocol_id
left join public.profiles      p  on p.id = c.user_id
left join lateral (
  select
    max(ci.value_cm) filter (where s.code = 'waist')   as waist_cm,
    max(ci.value_cm) filter (where s.code = 'abdomen') as abdomen_cm,
    max(ci.value_cm) filter (where s.code = 'chest')   as chest_cm,
    max(ci.value_cm) filter (where s.code = 'arm')     as arm_cm,
    max(ci.value_cm) filter (where s.code = 'thigh')   as thigh_cm,
    max(ci.value_cm) filter (where s.code = 'hips')    as hips_cm,
    coalesce(
      jsonb_object_agg(
        s.code || case when ci.side = 'none' then '' else '_' || ci.side::text end,
        ci.value_cm
      ) filter (where ci.id is not null),
      '{}'::jsonb
    ) as all_sites
  from public.circumferences ci
  join public.measurement_sites s on s.id = ci.site_id
  where ci.checkup_id = c.id
) circ on true
window w_asc as (partition by c.user_id order by c.checkup_date);

comment on view public.v_checkups is 'Serie storica unificata: BIA + circonferenze + indici derivati (BMI, FFMI, WHtR…).';

-- Serie "lunga" per i grafici delle circonferenze (una riga per sito per visita)
create view public.v_circumference_series
with (security_invoker = true)
as
select
  ci.user_id,
  c.checkup_date,
  s.code      as site_code,
  s.label     as site_label,
  ci.side,
  ci.value_cm,
  s.sort_order
from public.circumferences ci
join public.checkups c          on c.id = ci.checkup_id
join public.measurement_sites s on s.id = ci.site_id;

-- Totali nutrizionali per pasto/giorno/piano (alternative escluse: conta solo
-- la prima opzione di ogni alternative_group, così i totali non raddoppiano)
create view public.v_diet_day_totals
with (security_invoker = true)
as
with ranked as (
  select
    mi.*,
    row_number() over (
      partition by mi.meal_id, mi.alternative_group
      order by mi.sort_order, mi.id
    ) as alt_rank
  from public.meal_items mi
)
select
  d.user_id,
  d.plan_id,
  d.id            as day_id,
  d.day_of_week,
  d.label         as day_label,
  round(sum(r.kcal), 0)        as kcal,
  round(sum(r.protein_g), 1)   as protein_g,
  round(sum(r.carbs_g), 1)     as carbs_g,
  round(sum(r.fat_g), 1)       as fat_g,
  round(sum(r.fiber_g), 1)     as fiber_g,
  count(distinct m.id)         as meals_count
from public.diet_days d
left join public.meals  m on m.day_id = d.id
left join ranked        r on r.meal_id = m.id
                         and (r.alternative_group is null or r.alt_rank = 1)
group by d.user_id, d.plan_id, d.id, d.day_of_week, d.label;

-- -----------------------------------------------------------------------------
-- 10. RPC (SECURITY INVOKER: girano con i permessi e la RLS dell'utente)
-- -----------------------------------------------------------------------------

-- 10.1 Upsert atomico di una visita (checkup + BIA + circonferenze).
--      Semantica MERGE: i campi assenti o null NON sovrascrivono i valori esistenti.
--      Payload v1:
--      {
--        "checkup_date": "2026-05-25", "weight_kg": 75.2, "notes": null, "professional": null,
--        "source": "ai_import",
--        "bia": { "bmr_kcal": 1856, "fat_mass_pct": 16.5, "lean_mass_kg": 59.6,
--                 "total_body_water_pct": 59, "visceral_fat": 2.5, "protocol_id": null, ... },
--        "circumferences": [ { "site": "waist", "value_cm": 79, "side": "none" }, ... ]
--      }
create or replace function public.upsert_checkup(p jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid   uuid := auth.uid();
  v_id    uuid;
  v_bia   jsonb := p -> 'bia';
  v_c     jsonb;
  v_site  smallint;
begin
  if v_uid is null then
    raise exception 'Non autenticato' using errcode = '28000';
  end if;
  if jsonb_typeof(p) is distinct from 'object' or nullif(p ->> 'checkup_date', '') is null then
    raise exception 'Payload non valido: checkup_date obbligatoria' using errcode = '22023';
  end if;

  insert into public.checkups as c (user_id, checkup_date, weight_kg, professional, notes, source)
  values (
    v_uid,
    (p ->> 'checkup_date')::date,
    (p ->> 'weight_kg')::numeric,
    p ->> 'professional',
    p ->> 'notes',
    coalesce((p ->> 'source')::public.data_source, 'manual')
  )
  on conflict (user_id, checkup_date) do update set
    weight_kg    = coalesce(excluded.weight_kg,    c.weight_kg),
    professional = coalesce(excluded.professional, c.professional),
    notes        = coalesce(excluded.notes,        c.notes),
    source       = excluded.source
  returning c.id into v_id;

  if jsonb_typeof(v_bia) = 'object' then
    insert into public.bia_readings as b (
      checkup_id, user_id, protocol_id, bmr_kcal, fat_mass_pct, lean_mass_kg, muscle_mass_kg,
      bone_mass_kg, total_body_water_pct, visceral_fat, phase_angle_deg, metabolic_age, extra
    ) values (
      v_id, v_uid,
      nullif(v_bia ->> 'protocol_id', '')::uuid,
      round((v_bia ->> 'bmr_kcal')::numeric)::integer,
      (v_bia ->> 'fat_mass_pct')::numeric,
      (v_bia ->> 'lean_mass_kg')::numeric,
      (v_bia ->> 'muscle_mass_kg')::numeric,
      (v_bia ->> 'bone_mass_kg')::numeric,
      (v_bia ->> 'total_body_water_pct')::numeric,
      (v_bia ->> 'visceral_fat')::numeric,
      (v_bia ->> 'phase_angle_deg')::numeric,
      round((v_bia ->> 'metabolic_age')::numeric)::smallint,
      case when jsonb_typeof(v_bia -> 'extra') = 'object' then v_bia -> 'extra' else '{}'::jsonb end
    )
    on conflict (checkup_id) do update set
      protocol_id          = coalesce(excluded.protocol_id,          b.protocol_id),
      bmr_kcal             = coalesce(excluded.bmr_kcal,             b.bmr_kcal),
      fat_mass_pct         = coalesce(excluded.fat_mass_pct,         b.fat_mass_pct),
      lean_mass_kg         = coalesce(excluded.lean_mass_kg,         b.lean_mass_kg),
      muscle_mass_kg       = coalesce(excluded.muscle_mass_kg,       b.muscle_mass_kg),
      bone_mass_kg         = coalesce(excluded.bone_mass_kg,         b.bone_mass_kg),
      total_body_water_pct = coalesce(excluded.total_body_water_pct, b.total_body_water_pct),
      visceral_fat         = coalesce(excluded.visceral_fat,         b.visceral_fat),
      phase_angle_deg      = coalesce(excluded.phase_angle_deg,      b.phase_angle_deg),
      metabolic_age        = coalesce(excluded.metabolic_age,        b.metabolic_age),
      extra                = b.extra || excluded.extra;
  end if;

  if jsonb_typeof(p -> 'circumferences') = 'array' then
    for v_c in select value from jsonb_array_elements(p -> 'circumferences')
    loop
      continue when nullif(v_c ->> 'value_cm', '') is null;

      -- Il sito personale dell'utente ha precedenza su quello di sistema
      select s.id into v_site
        from public.measurement_sites s
       where s.code = v_c ->> 'site'
         and (s.user_id is null or s.user_id = v_uid)
       order by s.user_id nulls last
       limit 1;

      if v_site is null then
        raise exception 'Sito di misura sconosciuto: "%"', v_c ->> 'site'
          using errcode = '22023', hint = 'Usa un code presente in measurement_sites.';
      end if;

      insert into public.circumferences as ci (checkup_id, user_id, site_id, side, value_cm)
      values (
        v_id, v_uid, v_site,
        coalesce(nullif(v_c ->> 'side', '')::public.body_side, 'none'),
        (v_c ->> 'value_cm')::numeric
      )
      on conflict (checkup_id, site_id, side) do update set value_cm = excluded.value_cm;
    end loop;
  end if;

  return v_id;
end;
$$;

-- 10.2 Import multiplo (es. foto dell'intero storico): tutto-o-niente + audit
create or replace function public.import_checkups(p jsonb)
returns uuid[]
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_items  jsonb;
  v_ids    uuid[] := '{}';
  v_item   jsonb;
begin
  -- Accetta sia { "checkups": [...] } sia direttamente [...]
  v_items := case jsonb_typeof(p)
               when 'array'  then p
               when 'object' then coalesce(p -> 'checkups', jsonb_build_array(p))
             end;

  if jsonb_typeof(v_items) is distinct from 'array' or jsonb_array_length(v_items) = 0 then
    raise exception 'Nessun checkup da importare' using errcode = '22023';
  end if;

  for v_item in select value from jsonb_array_elements(v_items)
  loop
    v_ids := v_ids || public.upsert_checkup(
      jsonb_set(v_item, '{source}', coalesce(v_item -> 'source', '"ai_import"'::jsonb))
    );
  end loop;

  insert into public.ai_imports (user_id, kind, status, payload, target_ids, applied_at)
  values (auth.uid(), 'checkup', 'applied', p, v_ids, now());

  return v_ids;
end;
$$;

-- 10.3 Import atomico di un piano alimentare completo
--      Payload v1:
--      {
--        "name": "Piano autunno 2026", "professional": "Dott.ssa …",
--        "valid_from": "2026-10-01", "valid_to": null, "activate": true,
--        "targets": { "kcal": 2600, "protein_g": 160, "carbs_g": 300, "fat_g": 80, "fiber_g": 30 },
--        "notes": "…",
--        "days": [
--          { "day_of_week": null, "label": "Giorno tipo",
--            "meals": [
--              { "slot": "breakfast", "label": "Colazione", "time": "07:30", "notes": null,
--                "items": [
--                  { "food": "Fiocchi d'avena", "quantity": 60, "unit": "g",
--                    "kcal": 225, "protein_g": 8, "carbs_g": 36, "fat_g": 4, "fiber_g": 6,
--                    "alternative_group": null, "notes": null }
--                ] } ] } ]
--      }
create or replace function public.import_diet_plan(p jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid      uuid := auth.uid();
  v_plan_id  uuid;
  v_day_id   uuid;
  v_meal_id  uuid;
  v_day      jsonb;
  v_meal     jsonb;
  v_item     jsonb;
  v_di       bigint;
  v_mi       bigint;
  v_ii       bigint;
  v_targets  jsonb := coalesce(p -> 'targets', '{}'::jsonb);
begin
  if v_uid is null then
    raise exception 'Non autenticato' using errcode = '28000';
  end if;
  if nullif(trim(p ->> 'name'), '') is null then
    raise exception 'Payload non valido: name obbligatorio' using errcode = '22023';
  end if;
  if jsonb_typeof(p -> 'days') is distinct from 'array' or jsonb_array_length(p -> 'days') = 0 then
    raise exception 'Payload non valido: days deve contenere almeno un giorno' using errcode = '22023';
  end if;

  insert into public.diet_plans (
    user_id, name, professional, valid_from, valid_to, is_active,
    target_kcal, target_protein_g, target_carbs_g, target_fat_g, target_fiber_g,
    notes, source, raw_payload
  ) values (
    v_uid,
    trim(p ->> 'name'),
    p ->> 'professional',
    nullif(p ->> 'valid_from', '')::date,
    nullif(p ->> 'valid_to', '')::date,
    coalesce((p ->> 'activate')::boolean, true),
    round((v_targets ->> 'kcal')::numeric)::integer,
    (v_targets ->> 'protein_g')::numeric,
    (v_targets ->> 'carbs_g')::numeric,
    (v_targets ->> 'fat_g')::numeric,
    (v_targets ->> 'fiber_g')::numeric,
    p ->> 'notes',
    coalesce((p ->> 'source')::public.data_source, 'ai_import'),
    p
  )
  returning id into v_plan_id;

  for v_day, v_di in select value, ordinality from jsonb_array_elements(p -> 'days') with ordinality
  loop
    insert into public.diet_days (plan_id, user_id, day_of_week, label, sort_order)
    values (
      v_plan_id, v_uid,
      (v_day ->> 'day_of_week')::smallint,
      coalesce(nullif(v_day ->> 'label', ''), 'Giorno ' || v_di),
      v_di
    )
    returning id into v_day_id;

    for v_meal, v_mi in
      select value, ordinality from jsonb_array_elements(coalesce(v_day -> 'meals', '[]'::jsonb)) with ordinality
    loop
      insert into public.meals (day_id, user_id, slot, label, time_hint, notes, sort_order)
      values (
        v_day_id, v_uid,
        coalesce(nullif(v_meal ->> 'slot', '')::public.meal_slot, 'other'),
        v_meal ->> 'label',
        nullif(v_meal ->> 'time', '')::time,
        v_meal ->> 'notes',
        v_mi
      )
      returning id into v_meal_id;

      for v_item, v_ii in
        select value, ordinality from jsonb_array_elements(coalesce(v_meal -> 'items', '[]'::jsonb)) with ordinality
      loop
        insert into public.meal_items (
          meal_id, user_id, food_name, quantity, unit,
          kcal, protein_g, carbs_g, fat_g, fiber_g, alternative_group, notes, sort_order
        ) values (
          v_meal_id, v_uid,
          trim(v_item ->> 'food'),
          (v_item ->> 'quantity')::numeric,
          coalesce(nullif(v_item ->> 'unit', ''), 'g'),
          (v_item ->> 'kcal')::numeric,
          (v_item ->> 'protein_g')::numeric,
          (v_item ->> 'carbs_g')::numeric,
          (v_item ->> 'fat_g')::numeric,
          (v_item ->> 'fiber_g')::numeric,
          (v_item ->> 'alternative_group')::smallint,
          v_item ->> 'notes',
          v_ii
        );
      end loop;
    end loop;
  end loop;

  insert into public.ai_imports (user_id, kind, status, payload, target_ids, applied_at)
  values (v_uid, 'diet', 'applied', p, array[v_plan_id], now());

  return v_plan_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- PERMESSI SULLE FUNZIONI: solo utenti autenticati
-- -----------------------------------------------------------------------------
revoke execute on function public.upsert_checkup(jsonb)   from public, anon;
revoke execute on function public.import_checkups(jsonb)  from public, anon;
revoke execute on function public.import_diet_plan(jsonb) from public, anon;
grant  execute on function public.upsert_checkup(jsonb)   to authenticated;
grant  execute on function public.import_checkups(jsonb)  to authenticated;
grant  execute on function public.import_diet_plan(jsonb) to authenticated;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

commit;
