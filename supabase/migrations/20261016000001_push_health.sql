-- =============================================================================
--  VITRUVIAN · Migrazione 0011 — Notifiche del recupero e dati di Apple Salute
--
--  1. push_subscriptions: i dispositivi su cui hai attivato le notifiche
--     (endpoint del servizio push di Apple/Google + chiavi pubbliche del browser).
--  2. rest_timers: recuperi in corso; il server manda la notifica solo se il
--     timer esiste ancora (saltato o modificato = riga cancellata = niente avviso).
--  3. health_daily: un valore al giorno da Apple Salute (passi, sonno, battiti…),
--     inviato dall'app Comandi Rapidi di iPhone.
--  4. health_tokens: codice personale usato dal Comando Rapido. Nel database c'è
--     solo la sua impronta SHA-256: il codice in chiaro lo vedi una volta sola.
--
--  Si può rieseguire senza problemi.
-- =============================================================================
begin;

create extension if not exists pgcrypto with schema extensions;

-- -----------------------------------------------------------------------------
-- Tabelle
-- -----------------------------------------------------------------------------
create table if not exists public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  endpoint   text not null unique check (endpoint ~ '^https://' and length(endpoint) <= 1000),
  p256dh     text not null check (length(p256dh) between 40 and 200),
  auth       text not null check (length(auth) between 10 and 100),
  device     text check (length(device) <= 120),
  created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);

create table if not exists public.rest_timers (
  id         uuid primary key,
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  fire_at    timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists rest_timers_user_idx on public.rest_timers (user_id);

create table if not exists public.health_daily (
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day         date not null,
  steps       integer check (steps between 0 and 200000),
  active_kcal numeric(6, 0) check (active_kcal between 0 and 20000),
  resting_hr  numeric(4, 1) check (resting_hr between 20 and 220),
  hrv_ms      numeric(5, 1) check (hrv_ms between 1 and 500),
  sleep_min   numeric(5, 0) check (sleep_min between 0 and 1440),
  weight_kg   numeric(5, 2) check (weight_kg between 20 and 400),
  source      text not null default 'apple_health' check (length(source) <= 40),
  updated_at  timestamptz not null default now(),
  primary key (user_id, day)
);

create table if not exists public.health_tokens (
  user_id      uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  token_hash   text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  created_at   timestamptz not null default now(),
  last_used_at timestamptz
);

-- -----------------------------------------------------------------------------
-- RLS (+ verifica in due passaggi come nella 0006)
-- -----------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['push_subscriptions', 'rest_timers', 'health_daily', 'health_tokens']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_owner_all', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))',
      t || '_owner_all', t);
    execute format('drop policy if exists mfa_required on public.%I', t);
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
-- Ricezione dei dati dal Comando Rapido (nessuna sessione: basta il codice)
--   Valori come testo: Comandi Rapidi in italiano invia "7,5" o "8.432 passi".
--   p_date vuota = oggi (fuso Europa/Roma). Campi vuoti = non toccati.
-- -----------------------------------------------------------------------------
create or replace function public._health_num(t text)
returns numeric
language plpgsql
immutable
set search_path = ''
as $$
declare
  s text;
begin
  if t is null then
    return null;
  end if;
  s := regexp_replace(t, '[^0-9,.]', '', 'g');
  if s = '' then
    return null;
  end if;
  -- "8.432" o "1.234,5": punto come separatore delle migliaia (formato italiano)
  if s ~ '^\d{1,3}(\.\d{3})+(,\d+)?$' then
    s := replace(s, '.', '');
  end if;
  s := replace(s, ',', '.');
  return s::numeric;
exception when others then
  return null;
end;
$$;

create or replace function public.ingest_health(
  p_token text,
  p_date text default null,
  p_steps text default null,
  p_active_kcal text default null,
  p_resting_hr text default null,
  p_hrv text default null,
  p_sleep_hours text default null,
  p_weight_kg text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
  v_day  date;
  v_num  numeric;
  v_steps integer;
  v_kcal numeric;
  v_hr   numeric;
  v_hrv  numeric;
  v_sleep numeric;
  v_weight numeric;
begin
  if p_token is null or length(p_token) < 20 or length(p_token) > 200 then
    raise exception 'Codice non valido' using errcode = '28000';
  end if;
  select user_id into v_user
    from public.health_tokens
   where token_hash = encode(extensions.digest(btrim(p_token), 'sha256'), 'hex');
  if v_user is null then
    raise exception 'Codice non valido' using errcode = '28000';
  end if;

  -- data: oggi, "2026-10-09", "09/10/2026" o "9 ott 2026" non supportato → oggi
  begin
    v_day := case
      when p_date is null or btrim(p_date) = '' then (now() at time zone 'Europe/Rome')::date
      when p_date ~ '^\d{4}-\d{2}-\d{2}' then substr(p_date, 1, 10)::date
      when p_date ~ '^\d{1,2}/\d{1,2}/\d{4}' then to_date(substring(p_date from '^\d{1,2}/\d{1,2}/\d{4}'), 'DD/MM/YYYY')
      else (now() at time zone 'Europe/Rome')::date
    end;
  exception when others then
    v_day := (now() at time zone 'Europe/Rome')::date;
  end;
  if v_day > (now() at time zone 'Europe/Rome')::date + 1 or v_day < date '2000-01-01' then
    raise exception 'Data non valida' using errcode = '22008';
  end if;

  -- valori fuori scala ignorati (non bloccano gli altri)
  v_num := public._health_num(p_steps);        v_steps := case when v_num between 0 and 200000 then round(v_num)::integer end;
  v_num := public._health_num(p_active_kcal);  v_kcal := case when v_num between 0 and 20000 then round(v_num) end;
  v_num := public._health_num(p_resting_hr);   v_hr := case when v_num between 20 and 220 then round(v_num, 1) end;
  v_num := public._health_num(p_hrv);          v_hrv := case when v_num between 1 and 500 then round(v_num, 1) end;
  v_num := public._health_num(p_sleep_hours);
  -- ore (7,5), minuti (450) o secondi (27000): il Comando può inviare la durata in modi diversi
  v_sleep := case
    when v_num <= 0 then null  -- somma di nessun campione: non è "zero ore di sonno"
    when v_num <= 24 then round(v_num * 60)
    when v_num > 24 and v_num <= 1440 then round(v_num)
    when v_num > 1440 and v_num <= 86400 then round(v_num / 60)
  end;
  v_num := public._health_num(p_weight_kg);    v_weight := case when v_num between 20 and 400 then round(v_num, 2) end;

  if coalesce(v_steps::numeric, v_kcal, v_hr, v_hrv, v_sleep, v_weight) is null then
    return jsonb_build_object('ok', true, 'day', v_day, 'empty', true);
  end if;

  insert into public.health_daily as h (user_id, day, steps, active_kcal, resting_hr, hrv_ms, sleep_min, weight_kg, updated_at)
  values (v_user, v_day, v_steps, v_kcal, v_hr, v_hrv, v_sleep, v_weight, now())
  on conflict (user_id, day) do update set
    -- passi, calorie e sonno crescono durante il giorno: un invio parziale non abbassa il valore
    steps       = greatest(excluded.steps, h.steps),
    active_kcal = greatest(excluded.active_kcal, h.active_kcal),
    resting_hr  = coalesce(excluded.resting_hr, h.resting_hr),
    hrv_ms      = coalesce(excluded.hrv_ms, h.hrv_ms),
    sleep_min   = greatest(excluded.sleep_min, h.sleep_min),
    weight_kg   = coalesce(excluded.weight_kg, h.weight_kg),
    updated_at  = now();

  update public.health_tokens set last_used_at = now() where user_id = v_user;

  return jsonb_build_object(
    'ok', true, 'day', v_day,
    'steps', v_steps, 'active_kcal', v_kcal, 'resting_hr', v_hr, 'hrv_ms', v_hrv,
    'sleep_min', v_sleep, 'weight_kg', v_weight
  );
end;
$$;

revoke all on function public.ingest_health(text, text, text, text, text, text, text, text) from public;
grant execute on function public.ingest_health(text, text, text, text, text, text, text, text) to anon, authenticated;
revoke all on function public._health_num(text) from public;

-- -----------------------------------------------------------------------------
-- Usati dal server a fine recupero (dopo l'attesa la sessione dell'utente può
-- essere scaduta): l'id del timer e l'endpoint sono casuali e non indovinabili,
-- quindi valgono come "biglietto" monouso.
-- -----------------------------------------------------------------------------
create or replace function public.consume_rest_timer(p_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_found boolean;
begin
  delete from public.rest_timers where id = p_id returning true into v_found;
  -- pulizia dei timer rimasti appesi
  delete from public.rest_timers where fire_at < now() - interval '1 day';
  return coalesce(v_found, false);
end;
$$;

create or replace function public.drop_push_subscription(p_endpoint text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.push_subscriptions where endpoint = p_endpoint;
$$;

revoke all on function public.consume_rest_timer(uuid) from public;
grant execute on function public.consume_rest_timer(uuid) to anon, authenticated;
revoke all on function public.drop_push_subscription(text) from public;
grant execute on function public.drop_push_subscription(text) to anon, authenticated;

-- pulizia: timer rimasti appesi (es. telefono spento a metà recupero)
delete from public.rest_timers where fire_at < now() - interval '1 day';

commit;
