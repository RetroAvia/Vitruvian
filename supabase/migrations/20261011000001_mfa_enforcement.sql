-- =============================================================================
--  VITRUVIAN · Migrazione 0006 — Verifica in due passaggi (MFA) a livello DB
--
--  Policy RESTRICTIVE su tutte le tabelle: se l'utente ha un fattore MFA
--  verificato, il database risponde SOLO a sessioni con livello aal2
--  (password + codice dell'app di autenticazione). Senza fattori MFA
--  configurati non cambia nulla.
--
--  Così, anche se qualcuno scoprisse la password, senza il telefono non
--  legge né modifica alcun dato — neppure chiamando direttamente le API.
--  Pattern ufficiale Supabase: https://supabase.com/docs/guides/auth/auth-mfa
--
--  Esegui DOPO la 0005. Attiva poi la verifica in Impostazioni → Sicurezza.
-- =============================================================================
begin;

do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'bia_protocols', 'checkups', 'bia_readings', 'circumferences', 'measurement_sites',
    'diet_plans', 'diet_days', 'meals', 'meal_items', 'meal_logs', 'ai_imports',
    'lab_analytes', 'lab_reports', 'lab_results',
    'medical_reports', 'supplements', 'supplement_logs'
  ]
  loop
    execute format('drop policy if exists mfa_required on public.%I', t);
    execute format($p$
      create policy mfa_required on public.%I
        as restrictive
        for all
        to authenticated
        using (
          array[(select auth.jwt() ->> 'aal')] <@ (
            select case when count(id) > 0 then array['aal2'] else array['aal1', 'aal2'] end
              from auth.mfa_factors
             where user_id = (select auth.uid()) and status = 'verified'
          )
        )
        with check (
          array[(select auth.jwt() ->> 'aal')] <@ (
            select case when count(id) > 0 then array['aal2'] else array['aal1', 'aal2'] end
              from auth.mfa_factors
             where user_id = (select auth.uid()) and status = 'verified'
          )
        )
    $p$, t);
  end loop;
end
$$;

commit;
