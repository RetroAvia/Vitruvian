-- =============================================================================
--  VITRUVIAN · Migrazione 0002 — save_checkup (Fase 3)
--
--  RPC per i form di inserimento/modifica. A differenza di upsert_checkup
--  (semantica MERGE, pensata per l'AI Bridge) qui la semantica è REPLACE:
--  il payload descrive la visita COMPLETA.
--    • campo assente o null        → il valore viene svuotato
--    • "bia": null / assente       → la lettura BIA viene eliminata
--    • circonferenze non presenti  → vengono eliminate
--  Tutto avviene in un'unica transazione.
--
--  Payload:
--  {
--    "id": "<uuid>" | null,              -- null = nuova visita
--    "checkup_date": "2026-05-25",
--    "weight_kg": 75.2, "professional": null, "notes": null, "source": "manual",
--    "bia": { "protocol_id": "...", "bmr_kcal": 1856, "fat_mass_pct": 16.5, ... } | null,
--    "circumferences": [ { "site": "waist", "side": "none", "value_cm": 79 }, ... ]
--  }
-- =============================================================================
begin;

create or replace function public.save_checkup(p jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid       uuid := auth.uid();
  v_id        uuid := nullif(p ->> 'id', '')::uuid;
  v_date      date;
  v_bia       jsonb := p -> 'bia';
  v_c         jsonb;
  v_site      smallint;
  v_circ_id   uuid;
  v_keep      uuid[] := '{}';
begin
  if v_uid is null then
    raise exception 'Non autenticato' using errcode = '28000';
  end if;
  if jsonb_typeof(p) is distinct from 'object' or nullif(p ->> 'checkup_date', '') is null then
    raise exception 'La data della visita è obbligatoria' using errcode = '22023';
  end if;
  v_date := (p ->> 'checkup_date')::date;

  -- 1. Visita
  begin
    if v_id is null then
      insert into public.checkups (user_id, checkup_date, weight_kg, professional, notes, source)
      values (
        v_uid, v_date,
        (p ->> 'weight_kg')::numeric,
        nullif(trim(p ->> 'professional'), ''),
        nullif(trim(p ->> 'notes'), ''),
        coalesce((p ->> 'source')::public.data_source, 'manual')
      )
      returning id into v_id;
    else
      update public.checkups
         set checkup_date = v_date,
             weight_kg    = (p ->> 'weight_kg')::numeric,
             professional = nullif(trim(p ->> 'professional'), ''),
             notes        = nullif(trim(p ->> 'notes'), '')
       where id = v_id and user_id = v_uid;
      if not found then
        raise exception 'Visita non trovata' using errcode = 'P0002';
      end if;
    end if;
  exception
    when unique_violation then
      raise exception 'Esiste già una visita in data %', to_char(v_date, 'DD/MM/YYYY')
        using errcode = '23505', hint = 'Apri quella visita e modificala.';
  end;

  -- 2. BIA (replace)
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
      protocol_id          = excluded.protocol_id,
      bmr_kcal             = excluded.bmr_kcal,
      fat_mass_pct         = excluded.fat_mass_pct,
      lean_mass_kg         = excluded.lean_mass_kg,
      muscle_mass_kg       = excluded.muscle_mass_kg,
      bone_mass_kg         = excluded.bone_mass_kg,
      total_body_water_pct = excluded.total_body_water_pct,
      visceral_fat         = excluded.visceral_fat,
      phase_angle_deg      = excluded.phase_angle_deg,
      metabolic_age        = excluded.metabolic_age,
      -- i campi extra (es. importati dall'AI) si conservano se il form non li invia
      extra                = case when v_bia ? 'extra' then excluded.extra else b.extra end;
  else
    delete from public.bia_readings where checkup_id = v_id;
  end if;

  -- 3. Circonferenze (replace)
  if jsonb_typeof(p -> 'circumferences') = 'array' then
    for v_c in select value from jsonb_array_elements(p -> 'circumferences')
    loop
      continue when nullif(v_c ->> 'value_cm', '') is null;

      select s.id into v_site
        from public.measurement_sites s
       where s.code = v_c ->> 'site'
         and (s.user_id is null or s.user_id = v_uid)
       order by s.user_id nulls last
       limit 1;

      if v_site is null then
        raise exception 'Sito di misura sconosciuto: "%"', v_c ->> 'site' using errcode = '22023';
      end if;

      insert into public.circumferences as ci (checkup_id, user_id, site_id, side, value_cm)
      values (
        v_id, v_uid, v_site,
        coalesce(nullif(v_c ->> 'side', '')::public.body_side, 'none'),
        (v_c ->> 'value_cm')::numeric
      )
      on conflict (checkup_id, site_id, side) do update set value_cm = excluded.value_cm
      returning ci.id into v_circ_id;

      v_keep := v_keep || v_circ_id;
    end loop;
  end if;

  delete from public.circumferences
   where checkup_id = v_id
     and not (id = any (v_keep));

  return v_id;
end;
$$;

revoke execute on function public.save_checkup(jsonb) from public, anon;
grant  execute on function public.save_checkup(jsonb) to authenticated;

commit;
