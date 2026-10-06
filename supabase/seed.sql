-- =============================================================================
--  VITRUVIAN · Seed — Storico importato dal Google Foglio "Dati Fisico" + "Misure Fisico"
--
--  COME USARLO
--   1. Supabase → Authentication → Users → "Add user" (la tua email + password).
--   2. Sostituisci l'email qui sotto (v_email).
--   3. Esegui tutto nello SQL Editor. È idempotente: puoi rilanciarlo senza duplicati.
--
--  NOTA SUI PROTOCOLLI
--   A giugno 2025 i dati mostrano una discontinuità non fisiologica
--   (BMR +238 kcal, "massa magra" +20,9 kg, viscerale 5 → 1,5 in 3 mesi):
--   confermato: a giugno 2025 il nutrizionista è passato a una bilancia più professionale.
--   Le visite sono quindi assegnate a due protocolli distinti, così il motore
--   biometrico confronterà i trend solo all'interno dello stesso protocollo.
-- =============================================================================

do $$
declare
  v_email     text := 'INSERISCI_LA_TUA_EMAIL@example.com';   -- ← MODIFICA QUI
  v_height    numeric := 180.0;
  v_sex       public.sex_type := 'male';
  v_birth     date := date '2003-02-25';
  v_uid       uuid;
  v_proto_a   uuid;
  v_proto_b   uuid;
  v_cid       uuid;
  r           record;
begin
  select id into v_uid from auth.users where email = v_email;
  if v_uid is null then
    raise exception 'Utente % non trovato. Crealo prima in Authentication → Users.', v_email;
  end if;

  -- Profilo
  insert into public.profiles (id, sex, height_cm, birth_date)
  values (v_uid, v_sex, v_height, v_birth)
  on conflict (id) do update
    set sex        = excluded.sex,
        height_cm  = excluded.height_cm,
        birth_date = excluded.birth_date;

  -- Protocolli BIA
  insert into public.bia_protocols (user_id, name, device, lean_mass_definition, notes, active_from, active_to)
  values (v_uid, 'Bilancia 2022–2025', 'Bilancia impedenziometrica dello studio (prima)', 'Da verificare sul referto',
          'Stesso nutrizionista. Visite nov 2022 → mar 2025', date '2022-11-14', date '2025-03-17')
  on conflict (user_id, name) do update set notes = excluded.notes
  returning id into v_proto_a;

  insert into public.bia_protocols (user_id, name, device, lean_mass_definition, notes, active_from)
  values (v_uid, 'Bilancia professionale 2025→', 'Bilancia impedenziometrica professionale', 'Da verificare sul referto',
          'Stesso nutrizionista, strumento cambiato a giugno 2025: valori non confrontabili con la bilancia precedente', date '2025-06-16')
  on conflict (user_id, name) do update set notes = excluded.notes
  returning id into v_proto_b;

  -- Dati storici (unione dei due fogli: stesse date, stesso peso)
  for r in
    select * from (values
      --  data          peso   BMR   MG%   magra  H2O%  visc  vita addome torace braccio coscia
      (date '2022-11-14', 67.2, 1607, 16.7, 41.6, 61.0, 3.0, 77, 83.0,  91, 32.0, 54.5),
      (date '2023-01-23', 66.3, 1590, 16.2, 41.6, 60.0, 3.0, 77, 83.0,  93, 30.0, 55.0),
      (date '2023-03-23', 67.3, 1609, 16.0, 41.2, 62.0, 3.0, 79, 83.0,  94, 31.0, 55.0),
      (date '2023-06-07', 67.2, 1613, 15.0, 42.7, 64.0, 3.0, 79, 83.0,  93, 31.0, 55.0),
      (date '2023-08-01', 67.3, 1613, 14.1, 43.4, 66.0, 3.0, 77, 82.0,  95, 32.5, 54.0),
      (date '2023-10-09', 66.3, 1597, 15.0, 42.6, 63.0, 3.0, 79, 83.0,  94, 32.5, 54.0),
      (date '2024-01-02', 69.5, 1639, 17.3, 41.3, 65.0, 4.0, 79, 82.0,  96, 33.0, 56.0),
      (date '2024-03-11', 71.4, 1661, 19.6, 39.9, 66.0, 4.0, 81, 83.5,  96, 34.0, 57.0),
      (date '2024-07-08', 67.4, 1619, 13.6, 43.6, 60.0, 3.0, 76, 80.0,  93, 32.0, 54.0),
      (date '2024-09-30', 68.9, 1642, 14.0, 43.4, 65.0, 3.0, 76, 81.0,  94, 33.0, 55.0),
      (date '2024-12-12', 71.7, 1678, 15.8, 42.4, 66.0, 4.0, 79, 83.0,  95, 34.5, 56.0),
      (date '2025-03-17', 72.7, 1688, 17.8, 41.2, 68.0, 5.0, 80, 83.0,  97, 35.0, 57.0),
      (date '2025-06-16', 74.9, 1926, 12.8, 62.1, 62.0, 1.5, 80, 83.0,  99, 36.0, 58.0),
      (date '2025-09-29', 73.3, 1848, 14.8, 59.4, 60.4, 2.0, 80, 83.0,  96, 35.0, 55.0),
      (date '2026-01-02', 75.1, 1836, 17.8, 58.7, 58.0, 3.0, 80, 86.0, 100, 36.0, 57.0),
      (date '2026-03-09', 74.6, 1873, 14.9, 60.3, 60.3, 2.0, 79, 83.5,  99, 37.0, 58.0),
      (date '2026-05-25', 75.2, 1856, 16.5, 59.6, 59.0, 2.5, 79, 84.0, 101, 37.0, 58.5)
    ) as t(d, weight, bmr, fm_pct, lean, tbw, visc, waist, abdomen, chest, arm, thigh)
  loop
    insert into public.checkups (user_id, checkup_date, weight_kg, source)
    values (v_uid, r.d, r.weight, 'sheet_import')
    on conflict (user_id, checkup_date) do update set weight_kg = excluded.weight_kg
    returning id into v_cid;

    insert into public.bia_readings (
      checkup_id, user_id, protocol_id, bmr_kcal, fat_mass_pct, lean_mass_kg,
      total_body_water_pct, visceral_fat
    ) values (
      v_cid, v_uid,
      case when r.d >= date '2025-06-16' then v_proto_b else v_proto_a end,
      r.bmr, r.fm_pct, r.lean, r.tbw, r.visc
    )
    on conflict (checkup_id) do update set
      protocol_id          = excluded.protocol_id,
      bmr_kcal             = excluded.bmr_kcal,
      fat_mass_pct         = excluded.fat_mass_pct,
      lean_mass_kg         = excluded.lean_mass_kg,
      total_body_water_pct = excluded.total_body_water_pct,
      visceral_fat         = excluded.visceral_fat;

    insert into public.circumferences (checkup_id, user_id, site_id, side, value_cm)
    select v_cid, v_uid, s.id, 'none', x.v
      from (values ('waist', r.waist::numeric), ('abdomen', r.abdomen), ('chest', r.chest::numeric),
                   ('arm', r.arm), ('thigh', r.thigh)) as x(code, v)
      join public.measurement_sites s on s.code = x.code and s.user_id is null
    on conflict (checkup_id, site_id, side) do update set value_cm = excluded.value_cm;
  end loop;

  raise notice 'Seed completato per % (%): 17 visite importate.', v_email, v_uid;
end;
$$;
