-- =============================================================================
--  VITRUVIAN · Migrazione 0010 — Correzioni
--
--  Integratori non ancora iniziati: sospenderli (o disattivarli da un import)
--  impostava la fine prima dell'inizio e il salvataggio falliva. Ora la data di
--  fine non può precedere quella di inizio.
--  Pulizia dei testi importati con l'AI: rimuove i riferimenti alle fonti
--  ("[cite: 4]", "[cite_start]", "【…】") rimasti nelle note.
--  Si può rieseguire senza problemi. Esegui DOPO la 0009.
-- =============================================================================
begin;

create or replace function public.supplements_clamp_dates()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.end_date is not null and new.start_date is not null and new.end_date < new.start_date then
    new.end_date := new.start_date;
  end if;
  return new;
end;
$$;

drop trigger if exists supplements_clamp_dates on public.supplements;
create trigger supplements_clamp_dates
  before insert or update of start_date, end_date on public.supplements
  for each row execute function public.supplements_clamp_dates();

-- Pulizia una tantum dei testi già salvati (solo i tuoi dati: RLS non si applica
-- all'SQL Editor, ma la sostituzione tocca solo i riferimenti alle fonti)
do $$
declare
  r record;
begin
  for r in
    select c.table_name, c.column_name
      from information_schema.columns c
     where c.table_schema = 'public'
       and c.data_type = 'text'
       and c.table_name in ('diet_plans', 'diet_days', 'meals', 'meal_items', 'supplements', 'medical_reports',
                            'lab_reports', 'lab_results', 'training_plans', 'training_days', 'training_exercises', 'workouts', 'checkups')
  loop
    execute format(
      $q$update public.%I set %I = btrim(regexp_replace(regexp_replace(regexp_replace(%I, '\s*\[cite:[^\]]*\]', '', 'gi'), '\[cite_(start|end)\]', '', 'gi'), '\s*【[^】]*】', '', 'g'))
         where %I ~* '\[cite|【'$q$,
      r.table_name, r.column_name, r.column_name, r.column_name);
  end loop;
end
$$;

commit;
