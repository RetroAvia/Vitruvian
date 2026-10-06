-- =============================================================================
--  VITRUVIAN · Migrazione 0005 — Referti medici, integratori, backup
--
--  medical_reports       ECG, ecocardiogramma, spirometria, visita sportiva,
--                        pressione, DEXA, Holter, imaging, altro
--  supplements           integratori con ingredienti per dose (jsonb)
--  supplement_logs       checklist giornaliera di assunzione
--  import_medical_reports(jsonb) · import_supplements(jsonb)   AI Bridge
--  profiles.last_backup_at                                     indicatore backup
-- =============================================================================

-- I nuovi valori enum vanno aggiunti fuori dalla transazione principale
alter type public.import_kind add value if not exists 'medical';
alter type public.import_kind add value if not exists 'supplement';

begin;

create type public.medical_report_kind as enum (
  'ecg', 'echo', 'stress_test', 'holter', 'blood_pressure', 'spirometry',
  'sports_medical', 'dexa', 'imaging', 'specialist', 'other'
);

create type public.medical_outcome as enum ('normal', 'borderline', 'abnormal', 'unknown');

-- -----------------------------------------------------------------------------
-- Referti medici
--   measurements: [{ "code": "qtc_ms", "label": "QTc", "value": 412, "value_text": null,
--                    "unit": "ms", "ref_low": 350, "ref_high": 450 }]
-- -----------------------------------------------------------------------------
create table public.medical_reports (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  report_date      date not null,
  kind             public.medical_report_kind not null default 'other',
  title            text not null check (length(title) between 1 and 200),
  facility         text,
  physician        text,
  summary          text,
  conclusion       text,
  outcome          public.medical_outcome not null default 'unknown',
  measurements     jsonb not null default '[]' check (jsonb_typeof(measurements) = 'array'),
  findings         text[] not null default '{}',
  recommendations  text[] not null default '{}',
  next_check_date  date,
  notes            text,
  source           public.data_source not null default 'ai_import',
  raw_payload      jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (id, user_id)
);

create index medical_reports_user_date_idx on public.medical_reports (user_id, report_date desc);

create trigger set_updated_at before update on public.medical_reports
  for each row execute function public.tg_set_updated_at();
create trigger validate_report_date before insert or update of report_date on public.medical_reports
  for each row execute function public.tg_validate_date_column('report_date');

-- -----------------------------------------------------------------------------
-- Integratori
--   ingredients (per UNA dose): [{ "code": "vitamin_d3", "name": "Vitamina D3",
--                                  "amount": 2000, "unit": "IU" }]
-- -----------------------------------------------------------------------------
create table public.supplements (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name             text not null check (length(name) between 1 and 120),
  brand            text,
  form             text not null default 'other'
                   check (form in ('capsule','tablet','softgel','powder','liquid','drops','gummy','sachet','other')),
  dose_label       text,                                -- es. "1 capsula", "5 g (1 misurino)"
  servings_per_day numeric(4,2) not null default 1 check (servings_per_day > 0 and servings_per_day <= 20),
  timing           text[] not null default '{}',        -- morning, breakfast, lunch, pre_workout, post_workout, dinner, bedtime, with_meal, empty_stomach
  frequency        text not null default 'daily'
                   check (frequency in ('daily','training_days','weekly','as_needed','cycle')),
  days_per_week    smallint check (days_per_week between 1 and 7),
  ingredients      jsonb not null default '[]' check (jsonb_typeof(ingredients) = 'array'),
  purpose          text,
  notes            text,
  start_date       date,
  end_date         date,
  is_active        boolean not null default true,
  sort_order       smallint not null default 100,
  source           public.data_source not null default 'manual',
  raw_payload      jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (id, user_id),
  check (end_date is null or start_date is null or end_date >= start_date)
);

create unique index supplements_user_name_uq
  on public.supplements (user_id, lower(name), lower(coalesce(brand, '')));

create table public.supplement_logs (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid(),
  supplement_id  uuid not null,
  log_date       date not null default current_date,
  taken          boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  foreign key (supplement_id, user_id) references public.supplements (id, user_id) on delete cascade,
  unique (user_id, supplement_id, log_date)
);

create index supplement_logs_user_date_idx on public.supplement_logs (user_id, log_date desc);

create trigger set_updated_at before update on public.supplements
  for each row execute function public.tg_set_updated_at();
create trigger set_updated_at before update on public.supplement_logs
  for each row execute function public.tg_set_updated_at();
create trigger validate_log_date before insert or update of log_date on public.supplement_logs
  for each row execute function public.tg_validate_date_column('log_date');

-- -----------------------------------------------------------------------------
-- Backup
-- -----------------------------------------------------------------------------
alter table public.profiles add column if not exists last_backup_at timestamptz;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.medical_reports enable row level security;
alter table public.supplements     enable row level security;
alter table public.supplement_logs enable row level security;

create policy medical_reports_owner_all on public.medical_reports
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy supplements_owner_all on public.supplements
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy supplement_logs_owner_all on public.supplement_logs
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- Helper: array di testo da jsonb (accetta array o stringa singola)
-- -----------------------------------------------------------------------------
create or replace function public.jsonb_text_array(j jsonb)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select case jsonb_typeof(j)
    when 'array'  then coalesce(
      (select array_agg(trim(x)) from jsonb_array_elements_text(j) as t(x) where nullif(trim(x), '') is not null),
      '{}'::text[])
    when 'string' then case when nullif(trim(j #>> '{}'), '') is null then '{}'::text[] else array[trim(j #>> '{}')] end
    else '{}'::text[]
  end
$$;

-- -----------------------------------------------------------------------------
-- RPC: import referti medici (atomico, idempotente per data + tipo + titolo)
--  Payload: { "reports": [ { "report_date": "2026-03-02", "kind": "ecg", "title": "ECG a riposo",
--             "facility": null, "physician": null, "summary": "...", "conclusion": "...",
--             "outcome": "normal", "measurements": [...], "findings": [...],
--             "recommendations": [...], "next_check_date": null, "notes": null } ] }
-- -----------------------------------------------------------------------------
create or replace function public.import_medical_reports(p jsonb)
returns uuid[]
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid      uuid := auth.uid();
  v_reports  jsonb;
  v_rep      jsonb;
  v_id       uuid;
  v_kind     public.medical_report_kind;
  v_outcome  public.medical_outcome;
  v_title    text;
  v_ids      uuid[] := '{}';
begin
  if v_uid is null then
    raise exception 'Non autenticato' using errcode = '28000';
  end if;

  v_reports := case jsonb_typeof(p)
                 when 'array'  then p
                 when 'object' then coalesce(p -> 'reports', jsonb_build_array(p))
               end;
  if jsonb_typeof(v_reports) is distinct from 'array' or jsonb_array_length(v_reports) = 0 then
    raise exception 'Nessun referto da importare' using errcode = '22023';
  end if;

  for v_rep in select value from jsonb_array_elements(v_reports)
  loop
    if nullif(v_rep ->> 'report_date', '') is null then
      raise exception 'Ogni referto deve avere report_date' using errcode = '22023';
    end if;

    v_kind := coalesce(
      case when (v_rep ->> 'kind') in (select unnest(enum_range(null::public.medical_report_kind))::text)
           then (v_rep ->> 'kind')::public.medical_report_kind end,
      'other');
    v_outcome := coalesce(
      case when (v_rep ->> 'outcome') in (select unnest(enum_range(null::public.medical_outcome))::text)
           then (v_rep ->> 'outcome')::public.medical_outcome end,
      'unknown');
    v_title := coalesce(nullif(trim(v_rep ->> 'title'), ''), initcap(replace(v_kind::text, '_', ' ')));

    select id into v_id
      from public.medical_reports
     where user_id = v_uid
       and report_date = (v_rep ->> 'report_date')::date
       and kind = v_kind
       and lower(title) = lower(v_title);

    if v_id is null then
      insert into public.medical_reports (
        user_id, report_date, kind, title, facility, physician, summary, conclusion, outcome,
        measurements, findings, recommendations, next_check_date, notes, source, raw_payload)
      values (
        v_uid,
        (v_rep ->> 'report_date')::date,
        v_kind, v_title,
        nullif(trim(v_rep ->> 'facility'), ''),
        nullif(trim(v_rep ->> 'physician'), ''),
        nullif(trim(v_rep ->> 'summary'), ''),
        nullif(trim(v_rep ->> 'conclusion'), ''),
        v_outcome,
        case when jsonb_typeof(v_rep -> 'measurements') = 'array' then v_rep -> 'measurements' else '[]'::jsonb end,
        public.jsonb_text_array(v_rep -> 'findings'),
        public.jsonb_text_array(v_rep -> 'recommendations'),
        nullif(v_rep ->> 'next_check_date', '')::date,
        nullif(trim(v_rep ->> 'notes'), ''),
        coalesce((p ->> 'source')::public.data_source, 'ai_import'),
        v_rep
      )
      returning id into v_id;
    else
      update public.medical_reports set
        facility        = coalesce(nullif(trim(v_rep ->> 'facility'), ''), facility),
        physician       = coalesce(nullif(trim(v_rep ->> 'physician'), ''), physician),
        summary         = coalesce(nullif(trim(v_rep ->> 'summary'), ''), summary),
        conclusion      = coalesce(nullif(trim(v_rep ->> 'conclusion'), ''), conclusion),
        outcome         = case when v_outcome = 'unknown' then outcome else v_outcome end,
        measurements    = case when jsonb_typeof(v_rep -> 'measurements') = 'array'
                                and jsonb_array_length(v_rep -> 'measurements') > 0
                               then v_rep -> 'measurements' else measurements end,
        findings        = case when cardinality(public.jsonb_text_array(v_rep -> 'findings')) > 0
                               then public.jsonb_text_array(v_rep -> 'findings') else findings end,
        recommendations = case when cardinality(public.jsonb_text_array(v_rep -> 'recommendations')) > 0
                               then public.jsonb_text_array(v_rep -> 'recommendations') else recommendations end,
        next_check_date = coalesce(nullif(v_rep ->> 'next_check_date', '')::date, next_check_date),
        notes           = coalesce(nullif(trim(v_rep ->> 'notes'), ''), notes),
        raw_payload     = v_rep
      where id = v_id;
    end if;

    v_ids := v_ids || v_id;
  end loop;

  insert into public.ai_imports (user_id, kind, status, payload, target_ids, applied_at)
  values (v_uid, 'medical', 'applied', p, v_ids, now());

  return v_ids;
end;
$$;

-- -----------------------------------------------------------------------------
-- RPC: import integratori (atomico, idempotente per nome + marca)
--  Payload: { "supplements": [ { "name": "Vitamina D3", "brand": "...", "form": "softgel",
--             "dose_label": "1 softgel", "servings_per_day": 1, "timing": ["breakfast"],
--             "frequency": "daily", "days_per_week": null, "purpose": "...",
--             "ingredients": [ { "code": "vitamin_d3", "name": "Vitamina D3", "amount": 2000, "unit": "IU" } ],
--             "start_date": null, "end_date": null, "is_active": true, "notes": null } ],
--             "deactivate_missing": false }
--  deactivate_missing = true → gli integratori non presenti nel payload vengono disattivati
--  (utile quando incolli la lista COMPLETA di ciò che prendi oggi).
-- -----------------------------------------------------------------------------
create or replace function public.import_supplements(p jsonb)
returns uuid[]
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid    uuid := auth.uid();
  v_list   jsonb;
  v_s      jsonb;
  v_id     uuid;
  v_name   text;
  v_brand  text;
  v_form   text;
  v_freq   text;
  v_ids    uuid[] := '{}';
begin
  if v_uid is null then
    raise exception 'Non autenticato' using errcode = '28000';
  end if;

  v_list := case jsonb_typeof(p)
              when 'array'  then p
              when 'object' then coalesce(p -> 'supplements', jsonb_build_array(p))
            end;
  if jsonb_typeof(v_list) is distinct from 'array' or jsonb_array_length(v_list) = 0 then
    raise exception 'Nessun integratore da importare' using errcode = '22023';
  end if;

  for v_s in select value from jsonb_array_elements(v_list)
  loop
    v_name := nullif(trim(v_s ->> 'name'), '');
    if v_name is null then
      raise exception 'Ogni integratore deve avere un nome' using errcode = '22023';
    end if;
    v_brand := nullif(trim(v_s ->> 'brand'), '');
    v_form  := case when (v_s ->> 'form') in ('capsule','tablet','softgel','powder','liquid','drops','gummy','sachet','other')
                    then v_s ->> 'form' else 'other' end;
    v_freq  := case when (v_s ->> 'frequency') in ('daily','training_days','weekly','as_needed','cycle')
                    then v_s ->> 'frequency' else 'daily' end;

    select id into v_id
      from public.supplements
     where user_id = v_uid
       and lower(name) = lower(v_name)
       and lower(coalesce(brand, '')) = lower(coalesce(v_brand, ''));

    if v_id is null then
      insert into public.supplements (
        user_id, name, brand, form, dose_label, servings_per_day, timing, frequency, days_per_week,
        ingredients, purpose, notes, start_date, end_date, is_active, source, raw_payload)
      values (
        v_uid, v_name, v_brand, v_form,
        nullif(trim(v_s ->> 'dose_label'), ''),
        coalesce(nullif(v_s ->> 'servings_per_day', '')::numeric, 1),
        public.jsonb_text_array(v_s -> 'timing'),
        v_freq,
        nullif(v_s ->> 'days_per_week', '')::smallint,
        case when jsonb_typeof(v_s -> 'ingredients') = 'array' then v_s -> 'ingredients' else '[]'::jsonb end,
        nullif(trim(v_s ->> 'purpose'), ''),
        nullif(trim(v_s ->> 'notes'), ''),
        nullif(v_s ->> 'start_date', '')::date,
        nullif(v_s ->> 'end_date', '')::date,
        coalesce((v_s ->> 'is_active')::boolean, true),
        coalesce((p ->> 'source')::public.data_source, 'ai_import'),
        v_s
      )
      returning id into v_id;
    else
      update public.supplements set
        form             = v_form,
        dose_label       = coalesce(nullif(trim(v_s ->> 'dose_label'), ''), dose_label),
        servings_per_day = coalesce(nullif(v_s ->> 'servings_per_day', '')::numeric, servings_per_day),
        timing           = case when cardinality(public.jsonb_text_array(v_s -> 'timing')) > 0
                                then public.jsonb_text_array(v_s -> 'timing') else timing end,
        frequency        = v_freq,
        days_per_week    = coalesce(nullif(v_s ->> 'days_per_week', '')::smallint, days_per_week),
        ingredients      = case when jsonb_typeof(v_s -> 'ingredients') = 'array'
                                 and jsonb_array_length(v_s -> 'ingredients') > 0
                                then v_s -> 'ingredients' else ingredients end,
        purpose          = coalesce(nullif(trim(v_s ->> 'purpose'), ''), purpose),
        notes            = coalesce(nullif(trim(v_s ->> 'notes'), ''), notes),
        start_date       = coalesce(nullif(v_s ->> 'start_date', '')::date, start_date),
        end_date         = nullif(v_s ->> 'end_date', '')::date,
        is_active        = coalesce((v_s ->> 'is_active')::boolean, true),
        raw_payload      = v_s
      where id = v_id;
    end if;

    v_ids := v_ids || v_id;
  end loop;

  if coalesce((p ->> 'deactivate_missing')::boolean, false) then
    update public.supplements
       set is_active = false,
           end_date  = coalesce(end_date, current_date)
     where user_id = v_uid and is_active and not (id = any (v_ids));
  end if;

  insert into public.ai_imports (user_id, kind, status, payload, target_ids, applied_at)
  values (v_uid, 'supplement', 'applied', p, v_ids, now());

  return v_ids;
end;
$$;

revoke execute on function public.import_medical_reports(jsonb) from public, anon;
grant  execute on function public.import_medical_reports(jsonb) to authenticated;
revoke execute on function public.import_supplements(jsonb) from public, anon;
grant  execute on function public.import_supplements(jsonb) to authenticated;

commit;
