-- =============================================================================
--  VITRUVIAN · Migrazione 0007 — Allenamento
--
--  training_plans      schede (una attiva alla volta)
--  training_days       giorni della scheda (es. "Push A", lunedì)
--  training_exercises  esercizi con serie, ripetizioni, recupero, muscoli
--  workouts            sessioni svolte (dal registro dell'app o importate)
--  workout_sets        serie svolte: ripetizioni × carico, RPE
--  import_training(jsonb)  scheda + storico dall'AI Bridge (idempotente)
--  save_workout(jsonb)     salvataggio di una sessione dal registro (replace)
-- =============================================================================

alter type public.import_kind add value if not exists 'training';

begin;

-- -----------------------------------------------------------------------------
-- Schede
-- -----------------------------------------------------------------------------
create table public.training_plans (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name           text not null check (length(trim(name)) between 1 and 120),
  coach          text,
  goal           text not null default 'hypertrophy'
                 check (goal in ('hypertrophy', 'strength', 'recomp', 'fat_loss', 'endurance', 'general')),
  split          text,
  days_per_week  smallint check (days_per_week between 1 and 7),
  valid_from     date,
  valid_to       date,
  is_active      boolean not null default false,
  notes          text,
  source         public.data_source not null default 'ai_import',
  raw_payload    jsonb,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (id, user_id),
  check (valid_to is null or valid_from is null or valid_to >= valid_from)
);

create unique index training_plans_one_active_uq on public.training_plans (user_id) where is_active;
create unique index training_plans_user_name_uq on public.training_plans (user_id, lower(name));

create table public.training_days (
  id           uuid primary key default gen_random_uuid(),
  plan_id      uuid not null,
  user_id      uuid not null default auth.uid(),
  label        text not null check (length(trim(label)) > 0),
  day_of_week  smallint check (day_of_week between 1 and 7),   -- ISO: 1 = lunedì; NULL = a rotazione
  focus        text,
  sort_order   smallint not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  foreign key (plan_id, user_id) references public.training_plans (id, user_id) on delete cascade,
  unique (id, user_id)
);

create table public.training_exercises (
  id                 uuid primary key default gen_random_uuid(),
  day_id             uuid not null,
  user_id            uuid not null default auth.uid(),
  exercise_code      text not null check (exercise_code ~ '^[a-z][a-z0-9_]*$'),
  name               text not null check (length(trim(name)) > 0),
  muscle_primary     text,
  muscles_secondary  text[] not null default '{}',
  pattern            text,
  sets               smallint check (sets between 1 and 20),
  reps_min           smallint check (reps_min between 1 and 100),
  reps_max           smallint check (reps_max between 1 and 100),
  target_rir         numeric(3,1) check (target_rir between 0 and 10),
  rest_seconds       smallint check (rest_seconds between 0 and 900),
  tempo              text,
  load_kg            numeric(6,2) check (load_kg >= 0),
  duration_min       numeric(5,1) check (duration_min > 0),
  superset_group     smallint,
  notes              text,
  sort_order         smallint not null default 0,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  foreign key (day_id, user_id) references public.training_days (id, user_id) on delete cascade,
  check (reps_max is null or reps_min is null or reps_max >= reps_min)
);

-- -----------------------------------------------------------------------------
-- Sessioni svolte
-- -----------------------------------------------------------------------------
create table public.workouts (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  workout_date   date not null,
  plan_day_id    uuid,
  title          text not null default 'Allenamento' check (length(trim(title)) > 0),
  duration_min   smallint check (duration_min between 1 and 600),
  session_rpe    numeric(3,1) check (session_rpe between 1 and 10),
  notes          text,
  source         public.data_source not null default 'manual',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (id, user_id),
  foreign key (plan_day_id, user_id) references public.training_days (id, user_id) on delete set null (plan_day_id)
);

create table public.workout_sets (
  id             uuid primary key default gen_random_uuid(),
  workout_id     uuid not null,
  user_id        uuid not null default auth.uid(),
  exercise_code  text not null check (exercise_code ~ '^[a-z][a-z0-9_]*$'),
  exercise_name  text not null,
  set_index      smallint not null default 1 check (set_index between 1 and 50),
  reps           smallint check (reps between 0 and 200),
  weight_kg      numeric(6,2) check (weight_kg between 0 and 1000),
  rpe            numeric(3,1) check (rpe between 1 and 10),
  duration_min   numeric(5,1) check (duration_min > 0),
  is_warmup      boolean not null default false,
  created_at     timestamptz not null default now(),
  foreign key (workout_id, user_id) references public.workouts (id, user_id) on delete cascade
);

create index training_days_plan_idx      on public.training_days (plan_id);
create index training_exercises_day_idx  on public.training_exercises (day_id);
create index workouts_user_date_idx      on public.workouts (user_id, workout_date desc);
create index workout_sets_workout_idx    on public.workout_sets (workout_id);
create index workout_sets_user_code_idx  on public.workout_sets (user_id, exercise_code);

create or replace function public.tg_single_active_training_plan()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.is_active then
    update public.training_plans set is_active = false
     where user_id = new.user_id and id <> new.id and is_active;
  end if;
  return new;
end;
$$;

create trigger single_active_plan
  before insert or update of is_active on public.training_plans
  for each row when (new.is_active)
  execute function public.tg_single_active_training_plan();

create trigger set_updated_at before update on public.training_plans
  for each row execute function public.tg_set_updated_at();
create trigger set_updated_at before update on public.training_days
  for each row execute function public.tg_set_updated_at();
create trigger set_updated_at before update on public.training_exercises
  for each row execute function public.tg_set_updated_at();
create trigger set_updated_at before update on public.workouts
  for each row execute function public.tg_set_updated_at();
create trigger validate_workout_date before insert or update of workout_date on public.workouts
  for each row execute function public.tg_validate_date_column('workout_date');

-- -----------------------------------------------------------------------------
-- RLS (+ verifica in due passaggi come nella 0006)
-- -----------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['training_plans', 'training_days', 'training_exercises', 'workouts', 'workout_sets']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))',
      t || '_owner_all', t);
    execute format($p$
      create policy mfa_required on public.%I
        as restrictive for all to authenticated
        using (
          array[(select auth.jwt() ->> 'aal')] <@ (
            select case when count(id) > 0 then array['aal2'] else array['aal1', 'aal2'] end
              from auth.mfa_factors where user_id = (select auth.uid()) and status = 'verified'))
        with check (
          array[(select auth.jwt() ->> 'aal')] <@ (
            select case when count(id) > 0 then array['aal2'] else array['aal1', 'aal2'] end
              from auth.mfa_factors where user_id = (select auth.uid()) and status = 'verified'))
    $p$, t);
  end loop;
end
$$;

-- -----------------------------------------------------------------------------
-- Helper: codice esercizio normalizzato (snake_case che inizia con una lettera)
-- -----------------------------------------------------------------------------
create or replace function public.normalize_code(t text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when c = '' then null
    when c ~ '^[a-z]' then c
    else 'x_' || c
  end
  from (
    select regexp_replace(regexp_replace(lower(coalesce(t, '')), '[^a-z0-9]+', '_', 'g'), '^_+|_+$', '', 'g') as c
  ) s
$$;

-- -----------------------------------------------------------------------------
-- Inserimento delle serie di una sessione (usato da import e salvataggio)
--   exercises: [{ "code", "name", "sets": [{ "reps", "weight_kg", "rpe", "duration_min", "warmup" }] }]
-- -----------------------------------------------------------------------------
create or replace function public._insert_workout_sets(p_workout uuid, p_exercises jsonb)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid  uuid := auth.uid();
  v_ex   jsonb;
  v_set  jsonb;
  v_code text;
  v_name text;
  v_i    integer;
  v_n    integer := 0;
begin
  for v_ex in select value from jsonb_array_elements(coalesce(p_exercises, '[]'::jsonb))
  loop
    v_code := public.normalize_code(coalesce(nullif(v_ex ->> 'code', ''), v_ex ->> 'name'));
    continue when v_code is null;
    v_name := coalesce(nullif(trim(v_ex ->> 'name'), ''), v_code);
    v_i := 0;
    for v_set in select value from jsonb_array_elements(coalesce(v_ex -> 'sets', '[]'::jsonb))
    loop
      continue when nullif(v_set ->> 'reps', '') is null and nullif(v_set ->> 'duration_min', '') is null;
      v_i := v_i + 1;
      insert into public.workout_sets (workout_id, user_id, exercise_code, exercise_name, set_index, reps, weight_kg, rpe, duration_min, is_warmup)
      values (
        p_workout, v_uid, v_code, v_name, least(v_i, 50),
        round((v_set ->> 'reps')::numeric)::smallint,
        nullif(v_set ->> 'weight_kg', '')::numeric,
        nullif(v_set ->> 'rpe', '')::numeric,
        nullif(v_set ->> 'duration_min', '')::numeric,
        coalesce((v_set ->> 'warmup')::boolean, false)
      );
      v_n := v_n + 1;
    end loop;
  end loop;
  return v_n;
end;
$$;

-- -----------------------------------------------------------------------------
-- RPC: import scheda + storico (atomico)
--  {
--    "plan": { "name", "coach", "goal", "split", "days_per_week", "valid_from", "valid_to", "notes",
--              "days": [ { "label", "day_of_week", "focus",
--                          "exercises": [ { "code", "name", "muscle_primary", "muscles_secondary": [],
--                                           "pattern", "sets", "reps_min", "reps_max", "target_rir",
--                                           "rest_seconds", "tempo", "load_kg", "duration_min",
--                                           "superset_group", "notes" } ] } ] },
--    "activate": true,
--    "history": [ { "date", "title", "day_label", "duration_min", "session_rpe", "notes",
--                   "exercises": [ { "code", "name", "sets": [ { "reps", "weight_kg", "rpe", "warmup" } ] } ] } ]
--  }
--  Scheda con lo stesso nome → giorni ed esercizi sostituiti (re-import sicuro).
--  Sessione con stessa data e titolo → serie sostituite.
-- -----------------------------------------------------------------------------
create or replace function public.import_training(p jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid      uuid := auth.uid();
  v_plan     jsonb := p -> 'plan';
  v_plan_id  uuid;
  v_day      jsonb;
  v_day_id   uuid;
  v_ex       jsonb;
  v_w        jsonb;
  v_w_id     uuid;
  v_title    text;
  v_dsort    integer := 0;
  v_esort    integer;
  v_days     jsonb := '{}'::jsonb;   -- label minuscola → id
  v_wids     uuid[] := '{}';
  v_sets     integer := 0;
  v_goal     text;
  v_links    jsonb := '{}'::jsonb;   -- sessione → etichetta del giorno (per ricollegarle dopo il re-import)
begin
  if v_uid is null then
    raise exception 'Non autenticato' using errcode = '28000';
  end if;
  if jsonb_typeof(v_plan) is distinct from 'object' and jsonb_typeof(p -> 'history') is distinct from 'array' then
    raise exception 'Serve una scheda ("plan") o uno storico ("history")' using errcode = '22023';
  end if;

  -- 1. Scheda
  if jsonb_typeof(v_plan) = 'object' then
    if nullif(trim(v_plan ->> 'name'), '') is null then
      raise exception 'La scheda deve avere un nome' using errcode = '22023';
    end if;
    v_goal := case when (v_plan ->> 'goal') in ('hypertrophy','strength','recomp','fat_loss','endurance','general')
                   then v_plan ->> 'goal' else 'hypertrophy' end;

    select id into v_plan_id from public.training_plans
     where user_id = v_uid and lower(name) = lower(trim(v_plan ->> 'name'));

    if v_plan_id is null then
      insert into public.training_plans (user_id, name, coach, goal, split, days_per_week, valid_from, valid_to, is_active, notes, source, raw_payload)
      values (
        v_uid, trim(v_plan ->> 'name'),
        nullif(trim(v_plan ->> 'coach'), ''), v_goal,
        nullif(trim(v_plan ->> 'split'), ''),
        nullif(v_plan ->> 'days_per_week', '')::smallint,
        nullif(v_plan ->> 'valid_from', '')::date,
        nullif(v_plan ->> 'valid_to', '')::date,
        coalesce((p ->> 'activate')::boolean, true),
        nullif(trim(v_plan ->> 'notes'), ''),
        coalesce((p ->> 'source')::public.data_source, 'ai_import'),
        v_plan
      )
      returning id into v_plan_id;
    else
      update public.training_plans set
        coach = coalesce(nullif(trim(v_plan ->> 'coach'), ''), coach),
        goal = v_goal,
        split = coalesce(nullif(trim(v_plan ->> 'split'), ''), split),
        days_per_week = coalesce(nullif(v_plan ->> 'days_per_week', '')::smallint, days_per_week),
        valid_from = coalesce(nullif(v_plan ->> 'valid_from', '')::date, valid_from),
        valid_to = nullif(v_plan ->> 'valid_to', '')::date,
        is_active = coalesce((p ->> 'activate')::boolean, true) or is_active,
        notes = coalesce(nullif(trim(v_plan ->> 'notes'), ''), notes),
        raw_payload = v_plan
      where id = v_plan_id;
      select coalesce(jsonb_object_agg(w.id, lower(d.label)), '{}'::jsonb) into v_links
        from public.workouts w
        join public.training_days d on d.id = w.plan_day_id
       where d.plan_id = v_plan_id;
      delete from public.training_days where plan_id = v_plan_id;
    end if;

    for v_day in select value from jsonb_array_elements(coalesce(v_plan -> 'days', '[]'::jsonb))
    loop
      continue when nullif(trim(v_day ->> 'label'), '') is null;
      v_dsort := v_dsort + 1;
      insert into public.training_days (plan_id, user_id, label, day_of_week, focus, sort_order)
      values (
        v_plan_id, v_uid, trim(v_day ->> 'label'),
        nullif(v_day ->> 'day_of_week', '')::smallint,
        nullif(trim(v_day ->> 'focus'), ''),
        v_dsort
      )
      returning id into v_day_id;
      v_days := v_days || jsonb_build_object(lower(trim(v_day ->> 'label')), v_day_id);

      v_esort := 0;
      for v_ex in select value from jsonb_array_elements(coalesce(v_day -> 'exercises', '[]'::jsonb))
      loop
        continue when public.normalize_code(coalesce(nullif(v_ex ->> 'code', ''), v_ex ->> 'name')) is null;
        v_esort := v_esort + 1;
        insert into public.training_exercises (
          day_id, user_id, exercise_code, name, muscle_primary, muscles_secondary, pattern, sets, reps_min, reps_max,
          target_rir, rest_seconds, tempo, load_kg, duration_min, superset_group, notes, sort_order)
        values (
          v_day_id, v_uid,
          public.normalize_code(coalesce(nullif(v_ex ->> 'code', ''), v_ex ->> 'name')),
          coalesce(nullif(trim(v_ex ->> 'name'), ''), v_ex ->> 'code'),
          nullif(trim(v_ex ->> 'muscle_primary'), ''),
          public.jsonb_text_array(v_ex -> 'muscles_secondary'),
          nullif(trim(v_ex ->> 'pattern'), ''),
          nullif(v_ex ->> 'sets', '')::smallint,
          nullif(v_ex ->> 'reps_min', '')::smallint,
          greatest(nullif(v_ex ->> 'reps_max', '')::smallint, nullif(v_ex ->> 'reps_min', '')::smallint),
          nullif(v_ex ->> 'target_rir', '')::numeric,
          nullif(v_ex ->> 'rest_seconds', '')::smallint,
          nullif(trim(v_ex ->> 'tempo'), ''),
          nullif(v_ex ->> 'load_kg', '')::numeric,
          nullif(v_ex ->> 'duration_min', '')::numeric,
          nullif(v_ex ->> 'superset_group', '')::smallint,
          nullif(trim(v_ex ->> 'notes'), ''),
          v_esort
        );
      end loop;
    end loop;

    -- sessioni già registrate: ricollegate al giorno con la stessa etichetta
    update public.workouts w
       set plan_day_id = (v_days ->> (v_links ->> w.id::text))::uuid
     where w.user_id = v_uid and v_links ? w.id::text;
  end if;

  -- 2. Storico sessioni
  for v_w in select value from jsonb_array_elements(coalesce(p -> 'history', '[]'::jsonb))
  loop
    continue when nullif(v_w ->> 'date', '') is null;
    v_title := coalesce(nullif(trim(v_w ->> 'title'), ''), nullif(trim(v_w ->> 'day_label'), ''), 'Allenamento');

    select id into v_w_id from public.workouts
     where user_id = v_uid and workout_date = (v_w ->> 'date')::date and lower(title) = lower(v_title)
     limit 1;

    if v_w_id is null then
      insert into public.workouts (user_id, workout_date, plan_day_id, title, duration_min, session_rpe, notes, source)
      values (
        v_uid, (v_w ->> 'date')::date,
        nullif(v_days ->> lower(coalesce(trim(v_w ->> 'day_label'), '')), '')::uuid,
        v_title,
        nullif(v_w ->> 'duration_min', '')::smallint,
        nullif(v_w ->> 'session_rpe', '')::numeric,
        nullif(trim(v_w ->> 'notes'), ''),
        coalesce((p ->> 'source')::public.data_source, 'ai_import')
      )
      returning id into v_w_id;
    else
      update public.workouts set
        plan_day_id = coalesce(nullif(v_days ->> lower(coalesce(trim(v_w ->> 'day_label'), '')), '')::uuid, plan_day_id),
        duration_min = coalesce(nullif(v_w ->> 'duration_min', '')::smallint, duration_min),
        session_rpe = coalesce(nullif(v_w ->> 'session_rpe', '')::numeric, session_rpe),
        notes = coalesce(nullif(trim(v_w ->> 'notes'), ''), notes)
      where id = v_w_id;
      delete from public.workout_sets where workout_id = v_w_id;
    end if;

    v_sets := v_sets + public._insert_workout_sets(v_w_id, v_w -> 'exercises');
    v_wids := v_wids || v_w_id;
  end loop;

  insert into public.ai_imports (user_id, kind, status, payload, target_ids, applied_at)
  values (v_uid, 'training', 'applied', p, case when v_plan_id is null then v_wids else v_plan_id || v_wids end, now());

  return jsonb_build_object('plan_id', v_plan_id, 'workouts', cardinality(v_wids), 'sets', v_sets);
end;
$$;

-- -----------------------------------------------------------------------------
-- RPC: salvataggio di una sessione dal registro (semantica replace)
--  { "id": null | uuid, "workout_date", "plan_day_id", "title", "duration_min", "session_rpe", "notes",
--    "exercises": [ { "code", "name", "sets": [ ... ] } ] }
-- -----------------------------------------------------------------------------
create or replace function public.save_workout(p jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_id  uuid := nullif(p ->> 'id', '')::uuid;
begin
  if v_uid is null then
    raise exception 'Non autenticato' using errcode = '28000';
  end if;
  if nullif(p ->> 'workout_date', '') is null then
    raise exception 'La data è obbligatoria' using errcode = '22023';
  end if;

  if v_id is null then
    insert into public.workouts (user_id, workout_date, plan_day_id, title, duration_min, session_rpe, notes, source)
    values (
      v_uid, (p ->> 'workout_date')::date,
      nullif(p ->> 'plan_day_id', '')::uuid,
      coalesce(nullif(trim(p ->> 'title'), ''), 'Allenamento'),
      nullif(p ->> 'duration_min', '')::smallint,
      nullif(p ->> 'session_rpe', '')::numeric,
      nullif(trim(p ->> 'notes'), ''),
      'manual'
    )
    returning id into v_id;
  else
    update public.workouts set
      workout_date = (p ->> 'workout_date')::date,
      plan_day_id  = nullif(p ->> 'plan_day_id', '')::uuid,
      title        = coalesce(nullif(trim(p ->> 'title'), ''), 'Allenamento'),
      duration_min = nullif(p ->> 'duration_min', '')::smallint,
      session_rpe  = nullif(p ->> 'session_rpe', '')::numeric,
      notes        = nullif(trim(p ->> 'notes'), '')
    where id = v_id and user_id = v_uid;
    if not found then
      raise exception 'Sessione non trovata' using errcode = 'P0002';
    end if;
    delete from public.workout_sets where workout_id = v_id;
  end if;

  perform public._insert_workout_sets(v_id, p -> 'exercises');
  return v_id;
end;
$$;

revoke execute on function public._insert_workout_sets(uuid, jsonb) from public, anon;
grant  execute on function public._insert_workout_sets(uuid, jsonb) to authenticated;
revoke execute on function public.import_training(jsonb) from public, anon;
grant  execute on function public.import_training(jsonb) to authenticated;
revoke execute on function public.save_workout(jsonb) from public, anon;
grant  execute on function public.save_workout(jsonb) to authenticated;

commit;
