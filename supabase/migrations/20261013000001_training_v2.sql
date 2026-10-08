-- =============================================================================
--  VITRUVIAN · Migrazione 0008 — Allenamento v2: archiviazione compatta e tecniche
--
--  1. Le serie non sono più una riga ciascuna: ogni sessione salva i suoi
--     esercizi in un JSON compatto + un riepilogo calcolato dal database
--     (massimale stimato, volume, serie). Un anno a 3 allenamenti/settimana
--     occupa ~150 KB invece di ~1,5 MB e l'app scarica solo i riepiloghi.
--  2. Tecniche di allenamento per esercizio (piramide, drop set, rest-pause…)
--     e schema serie personalizzato.
--  3. save_training_plan(jsonb): creazione/modifica delle schede dall'app.
--
--  Formato compatto di workouts.exercises:
--    [ { "c": "bench_press", "n": "Panca piana", "m": null,
--        "s": [ [reps, kg, rpe, tipo], ... ] } ]
--    tipo: 0 allenante · 1 riscaldamento · 2 drop · 3 rest-pause · 4 cedimento/AMRAP
--    "m" = minuti (cardio)
--  Riepilogo workouts.summary (per esercizio):
--    { "c", "n", "sets", "reps", "vol", "e1rm", "top": [kg, reps], "maxr", "min" }
-- =============================================================================
begin;

-- -----------------------------------------------------------------------------
-- 1. Tecniche sugli esercizi della scheda
-- -----------------------------------------------------------------------------
alter table public.training_exercises
  add column if not exists technique text not null default 'straight'
    check (technique in ('straight', 'pyramid', 'reverse_pyramid', 'drop_set', 'rest_pause', 'myo_reps', 'cluster', 'amrap', 'emom', 'tempo')),
  add column if not exists set_scheme jsonb
    check (set_scheme is null or jsonb_typeof(set_scheme) = 'array');

comment on column public.training_exercises.set_scheme is 'Serie personalizzate: [{ "reps": 12, "load_pct": 70 }, …] (percentuale del carico di lavoro)';

-- -----------------------------------------------------------------------------
-- 2. Sessioni compatte
-- -----------------------------------------------------------------------------
alter table public.workouts
  add column if not exists exercises    jsonb not null default '[]' check (jsonb_typeof(exercises) = 'array'),
  add column if not exists summary      jsonb not null default '[]' check (jsonb_typeof(summary) = 'array'),
  add column if not exists total_sets   smallint not null default 0,
  add column if not exists total_volume numeric(10,1) not null default 0;

-- Formato di ingresso (AI Bridge / registro) → formato compatto
--   [ { "code", "name", "sets": [ { "reps", "weight_kg", "rpe", "duration_min", "warmup", "type" } ] } ]
create or replace function public.compact_exercises(p jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select coalesce(jsonb_agg(ex order by ord), '[]'::jsonb)
  from (
    select e.ord,
      jsonb_strip_nulls(jsonb_build_object(
        'c', public.normalize_code(coalesce(nullif(e.v ->> 'code', ''), e.v ->> 'name')),
        'n', coalesce(nullif(trim(e.v ->> 'name'), ''), e.v ->> 'code'),
        'm', (select sum(nullif(s ->> 'duration_min', '')::numeric) from jsonb_array_elements(coalesce(e.v -> 'sets', '[]'::jsonb)) s),
        's', (
          select coalesce(jsonb_agg(jsonb_build_array(
                   round(nullif(s ->> 'reps', '')::numeric)::int,
                   nullif(s ->> 'weight_kg', '')::numeric,
                   nullif(s ->> 'rpe', '')::numeric,
                   case
                     when coalesce((s ->> 'warmup')::boolean, false) or s ->> 'type' = 'warmup' then 1
                     when s ->> 'type' = 'drop' then 2
                     when s ->> 'type' = 'rest_pause' then 3
                     when s ->> 'type' in ('failure', 'amrap') then 4
                     else 0
                   end) order by so), '[]'::jsonb)
          from jsonb_array_elements(coalesce(e.v -> 'sets', '[]'::jsonb)) with ordinality as x(s, so)
          where nullif(s ->> 'reps', '') is not null and (s ->> 'reps')::numeric > 0
        )
      )) as ex
    from jsonb_array_elements(coalesce(p, '[]'::jsonb)) with ordinality as e(v, ord)
    where public.normalize_code(coalesce(nullif(e.v ->> 'code', ''), e.v ->> 'name')) is not null
  ) q
  where jsonb_array_length(coalesce(q.ex -> 's', '[]'::jsonb)) > 0 or (q.ex ->> 'm') is not null
$$;

-- Riepilogo per esercizio (solo serie allenanti; massimale stimato Epley ≤ 12 rip.)
create or replace function public.workout_summary(p jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select coalesce(jsonb_agg(row_data order by ord), '[]'::jsonb)
  from (
    select e.ord, jsonb_strip_nulls(jsonb_build_object(
      'c', e.v ->> 'c',
      'n', e.v ->> 'n',
      'min', (e.v ->> 'm')::numeric,
      'sets', (select count(*) from jsonb_array_elements(coalesce(e.v -> 's', '[]'::jsonb)) s where (s ->> 3)::int <> 1),
      'reps', (select sum((s ->> 0)::int) from jsonb_array_elements(coalesce(e.v -> 's', '[]'::jsonb)) s where (s ->> 3)::int <> 1),
      'vol', (select round(sum(coalesce((s ->> 1)::numeric, 0) * (s ->> 0)::int), 1) from jsonb_array_elements(coalesce(e.v -> 's', '[]'::jsonb)) s where (s ->> 3)::int <> 1),
      'maxr', (select max((s ->> 0)::int) from jsonb_array_elements(coalesce(e.v -> 's', '[]'::jsonb)) s where (s ->> 3)::int <> 1),
      'e1rm', (
        select round(max(case when (s ->> 0)::int = 1 then (s ->> 1)::numeric
                              else (s ->> 1)::numeric * (1 + least((s ->> 0)::int, 12) / 30.0) end), 1)
          from jsonb_array_elements(coalesce(e.v -> 's', '[]'::jsonb)) s
         where (s ->> 3)::int <> 1 and coalesce((s ->> 1)::numeric, 0) > 0 and (s ->> 0)::int > 0
      ),
      'top', (
        select jsonb_build_array((s ->> 1)::numeric, (s ->> 0)::int)
          from jsonb_array_elements(coalesce(e.v -> 's', '[]'::jsonb)) s
         where (s ->> 3)::int <> 1 and coalesce((s ->> 1)::numeric, 0) > 0
         order by (s ->> 1)::numeric * (1 + least((s ->> 0)::int, 12) / 30.0) desc
         limit 1
      )
    )) as row_data
    from jsonb_array_elements(coalesce(p, '[]'::jsonb)) with ordinality as e(v, ord)
  ) q
$$;

create or replace function public.tg_workout_summary()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.summary := public.workout_summary(new.exercises);
  new.total_sets := coalesce((select sum((x ->> 'sets')::int) from jsonb_array_elements(new.summary) x), 0);
  new.total_volume := coalesce((select sum((x ->> 'vol')::numeric) from jsonb_array_elements(new.summary) x), 0);
  return new;
end;
$$;

drop trigger if exists workout_summary on public.workouts;
create trigger workout_summary
  before insert or update of exercises on public.workouts
  for each row execute function public.tg_workout_summary();

-- Conversione delle serie già salvate (migrazione 0007) nel formato compatto
do $$
begin
  if to_regclass('public.workout_sets') is not null then
    update public.workouts w
       set exercises = coalesce((
         select jsonb_agg(ex order by first_idx)
         from (
           select min(ws.set_index) as first_idx,
             jsonb_strip_nulls(jsonb_build_object(
               'c', ws.exercise_code,
               'n', min(ws.exercise_name),
               'm', sum(ws.duration_min),
               's', coalesce(jsonb_agg(jsonb_build_array(ws.reps, ws.weight_kg, ws.rpe, case when ws.is_warmup then 1 else 0 end) order by ws.set_index)
                      filter (where ws.reps is not null and ws.reps > 0), '[]'::jsonb)
             )) as ex
           from public.workout_sets ws
           where ws.workout_id = w.id
           group by ws.exercise_code
         ) g
       ), '[]'::jsonb);
    drop table public.workout_sets;
  end if;
end
$$;

drop function if exists public._insert_workout_sets(uuid, jsonb);

-- -----------------------------------------------------------------------------
-- 3. Import scheda + storico (stesso formato di ingresso della 0007)
--    Opzioni: "mode": "replace" → i campi vuoti della scheda vengono svuotati (editor)
--             "audit": false     → nessuna riga in ai_imports (salvataggi dall'app)
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
  v_replace  boolean := coalesce(p ->> 'mode', '') = 'replace';
  v_plan_id  uuid;
  v_day      jsonb;
  v_day_id   uuid;
  v_ex       jsonb;
  v_w        jsonb;
  v_w_id     uuid;
  v_title    text;
  v_dsort    integer := 0;
  v_esort    integer;
  v_days     jsonb := '{}'::jsonb;
  v_wids     uuid[] := '{}';
  v_sets     integer := 0;
  v_n        integer;
  v_goal     text;
  v_tech     text;
  v_links    jsonb := '{}'::jsonb;
begin
  if v_uid is null then
    raise exception 'Non autenticato' using errcode = '28000';
  end if;
  if jsonb_typeof(v_plan) is distinct from 'object' and jsonb_typeof(p -> 'history') is distinct from 'array' then
    raise exception 'Serve una scheda ("plan") o uno storico ("history")' using errcode = '22023';
  end if;

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
        coach = case when v_replace then nullif(trim(v_plan ->> 'coach'), '') else coalesce(nullif(trim(v_plan ->> 'coach'), ''), coach) end,
        goal = v_goal,
        split = case when v_replace then nullif(trim(v_plan ->> 'split'), '') else coalesce(nullif(trim(v_plan ->> 'split'), ''), split) end,
        days_per_week = case when v_replace then nullif(v_plan ->> 'days_per_week', '')::smallint else coalesce(nullif(v_plan ->> 'days_per_week', '')::smallint, days_per_week) end,
        valid_from = case when v_replace then nullif(v_plan ->> 'valid_from', '')::date else coalesce(nullif(v_plan ->> 'valid_from', '')::date, valid_from) end,
        valid_to = nullif(v_plan ->> 'valid_to', '')::date,
        is_active = case when v_replace then coalesce((p ->> 'activate')::boolean, is_active) else coalesce((p ->> 'activate')::boolean, true) or is_active end,
        notes = case when v_replace then nullif(trim(v_plan ->> 'notes'), '') else coalesce(nullif(trim(v_plan ->> 'notes'), ''), notes) end,
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
      values (v_plan_id, v_uid, trim(v_day ->> 'label'), nullif(v_day ->> 'day_of_week', '')::smallint, nullif(trim(v_day ->> 'focus'), ''), v_dsort)
      returning id into v_day_id;
      v_days := v_days || jsonb_build_object(lower(trim(v_day ->> 'label')), v_day_id);

      v_esort := 0;
      for v_ex in select value from jsonb_array_elements(coalesce(v_day -> 'exercises', '[]'::jsonb))
      loop
        continue when public.normalize_code(coalesce(nullif(v_ex ->> 'code', ''), v_ex ->> 'name')) is null;
        v_esort := v_esort + 1;
        v_tech := case when (v_ex ->> 'technique') in ('straight','pyramid','reverse_pyramid','drop_set','rest_pause','myo_reps','cluster','amrap','emom','tempo')
                       then v_ex ->> 'technique' else 'straight' end;
        insert into public.training_exercises (
          day_id, user_id, exercise_code, name, muscle_primary, muscles_secondary, pattern, sets, reps_min, reps_max,
          target_rir, rest_seconds, tempo, load_kg, duration_min, superset_group, notes, sort_order, technique, set_scheme)
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
          v_esort,
          v_tech,
          case when jsonb_typeof(v_ex -> 'set_scheme') = 'array' and jsonb_array_length(v_ex -> 'set_scheme') > 0 then v_ex -> 'set_scheme' end
        );
      end loop;
    end loop;

    update public.workouts w
       set plan_day_id = (v_days ->> (v_links ->> w.id::text))::uuid
     where w.user_id = v_uid and v_links ? w.id::text;
  end if;

  for v_w in select value from jsonb_array_elements(coalesce(p -> 'history', '[]'::jsonb))
  loop
    continue when nullif(v_w ->> 'date', '') is null;
    v_title := coalesce(nullif(trim(v_w ->> 'title'), ''), nullif(trim(v_w ->> 'day_label'), ''), 'Allenamento');

    select id into v_w_id from public.workouts
     where user_id = v_uid and workout_date = (v_w ->> 'date')::date and lower(title) = lower(v_title)
     limit 1;

    if v_w_id is null then
      insert into public.workouts (user_id, workout_date, plan_day_id, title, duration_min, session_rpe, notes, source, exercises)
      values (
        v_uid, (v_w ->> 'date')::date,
        nullif(v_days ->> lower(coalesce(trim(v_w ->> 'day_label'), '')), '')::uuid,
        v_title,
        nullif(v_w ->> 'duration_min', '')::smallint,
        nullif(v_w ->> 'session_rpe', '')::numeric,
        nullif(trim(v_w ->> 'notes'), ''),
        coalesce((p ->> 'source')::public.data_source, 'ai_import'),
        public.compact_exercises(v_w -> 'exercises')
      )
      returning id, total_sets into v_w_id, v_n;
    else
      update public.workouts set
        plan_day_id = coalesce(nullif(v_days ->> lower(coalesce(trim(v_w ->> 'day_label'), '')), '')::uuid, plan_day_id),
        duration_min = coalesce(nullif(v_w ->> 'duration_min', '')::smallint, duration_min),
        session_rpe = coalesce(nullif(v_w ->> 'session_rpe', '')::numeric, session_rpe),
        notes = coalesce(nullif(trim(v_w ->> 'notes'), ''), notes),
        exercises = public.compact_exercises(v_w -> 'exercises')
      where id = v_w_id
      returning total_sets into v_n;
    end if;

    v_sets := v_sets + coalesce(v_n, 0);
    v_wids := v_wids || v_w_id;
  end loop;

  if coalesce((p ->> 'audit')::boolean, true) then
    insert into public.ai_imports (user_id, kind, status, payload, target_ids, applied_at)
    values (v_uid, 'training', 'applied', p, case when v_plan_id is null then v_wids else v_plan_id || v_wids end, now());
  end if;

  return jsonb_build_object('plan_id', v_plan_id, 'workouts', cardinality(v_wids), 'sets', v_sets);
end;
$$;

-- -----------------------------------------------------------------------------
-- 4. Registro: salvataggio di una sessione (replace)
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
  v_ex  jsonb := public.compact_exercises(p -> 'exercises');
begin
  if v_uid is null then
    raise exception 'Non autenticato' using errcode = '28000';
  end if;
  if nullif(p ->> 'workout_date', '') is null then
    raise exception 'La data è obbligatoria' using errcode = '22023';
  end if;
  if jsonb_array_length(v_ex) = 0 then
    raise exception 'La sessione non contiene serie' using errcode = '22023';
  end if;

  if v_id is null then
    insert into public.workouts (user_id, workout_date, plan_day_id, title, duration_min, session_rpe, notes, source, exercises)
    values (
      v_uid, (p ->> 'workout_date')::date,
      nullif(p ->> 'plan_day_id', '')::uuid,
      coalesce(nullif(trim(p ->> 'title'), ''), 'Allenamento'),
      nullif(p ->> 'duration_min', '')::smallint,
      nullif(p ->> 'session_rpe', '')::numeric,
      nullif(trim(p ->> 'notes'), ''),
      'manual',
      v_ex
    )
    returning id into v_id;
  else
    update public.workouts set
      workout_date = (p ->> 'workout_date')::date,
      plan_day_id  = nullif(p ->> 'plan_day_id', '')::uuid,
      title        = coalesce(nullif(trim(p ->> 'title'), ''), 'Allenamento'),
      duration_min = nullif(p ->> 'duration_min', '')::smallint,
      session_rpe  = nullif(p ->> 'session_rpe', '')::numeric,
      notes        = nullif(trim(p ->> 'notes'), ''),
      exercises    = v_ex
    where id = v_id and user_id = v_uid;
    if not found then
      raise exception 'Sessione non trovata' using errcode = 'P0002';
    end if;
  end if;
  return v_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- 5. Editor delle schede
--    { "id": uuid | null, "name", "goal", "split", "coach", "days_per_week", "valid_from", "valid_to",
--      "notes", "is_active", "days": [ … come import_training … ] }
-- -----------------------------------------------------------------------------
create or replace function public.save_training_plan(p jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid  uuid := auth.uid();
  v_id   uuid := nullif(p ->> 'id', '')::uuid;
  v_name text := nullif(trim(p ->> 'name'), '');
  v_res  jsonb;
begin
  if v_uid is null then
    raise exception 'Non autenticato' using errcode = '28000';
  end if;
  if v_name is null then
    raise exception 'La scheda deve avere un nome' using errcode = '22023';
  end if;
  if exists (select 1 from public.training_plans where user_id = v_uid and lower(name) = lower(v_name) and id is distinct from v_id) then
    raise exception 'Esiste già una scheda chiamata "%"', v_name using errcode = '23505';
  end if;
  if v_id is not null then
    update public.training_plans set name = v_name where id = v_id and user_id = v_uid;
    if not found then
      raise exception 'Scheda non trovata' using errcode = 'P0002';
    end if;
  end if;

  v_res := public.import_training(jsonb_build_object(
    'plan', p, 'mode', 'replace', 'audit', false, 'source', 'manual',
    'activate', case when p ? 'is_active' then p -> 'is_active' else to_jsonb(v_id is null) end
  ));
  return (v_res ->> 'plan_id')::uuid;
end;
$$;

revoke execute on function public.import_training(jsonb) from public, anon;
grant  execute on function public.import_training(jsonb) to authenticated;
revoke execute on function public.save_workout(jsonb) from public, anon;
grant  execute on function public.save_workout(jsonb) to authenticated;
revoke execute on function public.save_training_plan(jsonb) from public, anon;
grant  execute on function public.save_training_plan(jsonb) to authenticated;

commit;
