-- =============================================================================
--  VITRUVIAN · Migrazione 0009 — Allenamenti offline (invio idempotente)
--
--  Le sessioni nuove ricevono l'id direttamente dal telefono. Se la rete cade
--  durante il salvataggio, l'app ritenta con lo STESSO id: il database
--  aggiorna la sessione invece di crearne un doppione.
--    • id assente            → nuova sessione (come prima)
--    • id esistente          → modifica
--    • id nuovo (dal telefono) → nuova sessione con quell'id
--    • "is_new": false con id inesistente → errore (modifica di una sessione eliminata)
--  Esegui DOPO la 0008 (training_v2).
-- =============================================================================
begin;

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

  -- il giorno di scheda potrebbe essere stato eliminato mentre si era offline: in quel caso resta vuoto
  if v_id is not null then
    update public.workouts set
      workout_date = (p ->> 'workout_date')::date,
      plan_day_id  = (select d.id from public.training_days d where d.id = nullif(p ->> 'plan_day_id', '')::uuid),
      title        = coalesce(nullif(trim(p ->> 'title'), ''), 'Allenamento'),
      duration_min = nullif(p ->> 'duration_min', '')::smallint,
      session_rpe  = nullif(p ->> 'session_rpe', '')::numeric,
      notes        = nullif(trim(p ->> 'notes'), ''),
      exercises    = v_ex
    where id = v_id and user_id = v_uid;
    if found then
      return v_id;
    end if;
    -- modifica di una sessione eliminata nel frattempo (es. da un altro dispositivo): niente "resurrezioni"
    if coalesce(nullif(p ->> 'is_new', '')::boolean, true) = false then
      raise exception 'Sessione non trovata: potrebbe essere stata eliminata' using errcode = 'P0002';
    end if;
  end if;

  insert into public.workouts (id, user_id, workout_date, plan_day_id, title, duration_min, session_rpe, notes, source, exercises)
  values (
    coalesce(v_id, gen_random_uuid()),
    v_uid,
    (p ->> 'workout_date')::date,
    (select d.id from public.training_days d where d.id = nullif(p ->> 'plan_day_id', '')::uuid),
    coalesce(nullif(trim(p ->> 'title'), ''), 'Allenamento'),
    nullif(p ->> 'duration_min', '')::smallint,
    nullif(p ->> 'session_rpe', '')::numeric,
    nullif(trim(p ->> 'notes'), ''),
    'manual',
    v_ex
  )
  returning id into v_id;
  return v_id;
end;
$$;

revoke execute on function public.save_workout(jsonb) from public, anon;
grant  execute on function public.save_workout(jsonb) to authenticated;

commit;
