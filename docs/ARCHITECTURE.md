# Vitruvian — Architettura

> Web app personale per monitorare composizione corporea (BIA), circonferenze e nutrizione.
> Evoluzione dei fogli Google "Dati Fisico" e "Misure Fisico".

## 1. Decisioni chiave

| Area | Scelta | Perché |
|---|---|---|
| Framework | **Next.js (App Router, TypeScript)**, ultima stable via `create-next-app@latest` | Route groups per separare auth/app, server-side auth gate, deploy nativo su Vercel |
| UI | Tailwind CSS + shadcn/ui (Radix) + Lucide | Componenti accessibili che *possiedi* nel repo, niente lock-in |
| Animazioni | Solo CSS (utility `stagger`, `hover-lift`, `animate-*`) + Web Audio per i suoni | Zero JavaScript extra, rispetto di "riduci movimento" |
| Grafici | Recharts | `ComposedChart` per linee+barre, tooltip custom |
| Server state | **TanStack Query** | Cache, refetch, mutazioni ottimistiche per il CRUD |
| UI state | Zustand (minimo) | Solo sidebar, range temporale selezionato, preferenze grafici |
| Validazione | **Zod come unica fonte di verità** | Lo stesso schema valida il form, il JSON dell'AI Bridge e genera il prompt per l'IA esterna |
| DB / Auth | Supabase (Postgres + RLS + Auth email/password, signup disabilitato) | Single-user ma sicuro: anche con la chiave pubblica nessuno legge i dati |
| Test | Vitest sul motore biometrico | Il motore è TypeScript puro → testabile senza DB né browser |
| Deploy | GitHub → Vercel (preview su ogni PR, prod su `main`) | Costo zero |

**Rendering:** l'area `(app)` è una dashboard privata: niente SEO, tanta interattività.
I dati si caricano lato client con TanStack Query; il server fa solo da *gate* di autenticazione
(refresh della sessione Supabase prima di ogni richiesta).

## 2. Struttura cartelle (feature-based)

```
vitruvian/
├─ supabase/
│  ├─ migrations/                 # SQL versionato (Fase 1)
│  └─ seed.sql                    # storico dal Google Foglio
├─ docs/ARCHITECTURE.md
├─ src/
│  ├─ app/
│  │  ├─ (auth)/login/page.tsx
│  │  ├─ (app)/                   # tutto ciò che richiede login
│  │  │  ├─ layout.tsx            # shell: sidebar, topbar, providers
│  │  │  ├─ dashboard/page.tsx    # Health Status + KPI + grafici
│  │  │  ├─ checkups/page.tsx     # tabella visite + CRUD
│  │  │  ├─ trends/page.tsx       # analisi approfondita circonferenze/BIA
│  │  │  ├─ bridge/page.tsx       # AI Bridge (prompt + incolla JSON)
│  │  │  ├─ nutrition/page.tsx    # piano alimentare + checklist
│  │  │  └─ settings/page.tsx     # profilo, protocolli BIA, siti di misura
│  │  ├─ auth/callback/route.ts
│  │  ├─ layout.tsx · globals.css
│  ├─ components/
│  │  ├─ ui/                      # shadcn (generati, non toccati a mano)
│  │  ├─ layout/                  # Sidebar, Topbar, PageHeader
│  │  ├─ charts/                  # wrapper Recharts riusabili + tooltip
│  │  └─ shared/                  # GlassCard, StatBadge, DeltaPill, EmptyState
│  ├─ features/                   # ogni feature è autonoma
│  │  ├─ checkups/   { api/ hooks/ components/ schemas/ }
│  │  ├─ biometrics/ { engine/ components/ __tests__/ }
│  │  ├─ ai-bridge/  { prompts/ parsers/ components/ }
│  │  ├─ nutrition/  { api/ hooks/ components/ schemas/ }
│  │  └─ profile/    { api/ hooks/ components/ }
│  ├─ lib/
│  │  ├─ supabase/   { client.ts server.ts session.ts }
│  │  ├─ query-client.ts · format.ts (it-IT) · utils.ts
│  ├─ types/
│  │  ├─ database.types.ts        # GENERATO da Supabase CLI
│  │  └─ domain.ts                # tipi di dominio derivati
│  └─ config/  { nav.ts constants.ts thresholds.ts }
│  ├─ stores/ui-store.ts           # Zustand (sidebar, range temporale)
│  ├─ providers/app-providers.tsx  # Theme · Query · Motion · Tooltip · Toaster
│  └─ proxy.ts                     # refresh sessione + redirect login (Next 15: middleware.ts)
```

Regola d'oro: **una feature importa da `lib/`, `components/` e `types/`, mai da un'altra feature**
(eccezione: `biometrics/engine`, che è puro e può essere usato ovunque).

## 3. Modello dati

```
auth.users ─1:1─ profiles (sesso, altezza, attività)
     │
     ├─< checkups (data, peso)            ← una riga per visita
     │      ├─1:1─ bia_readings ──>─ bia_protocols
     │      └─1:N─ circumferences ──>─ measurement_sites (catalogo: vita, addome, …, polpaccio)
     │
     ├─< diet_plans ─< diet_days ─< meals ─< meal_items
     │                                 └─< meal_logs (checklist giornaliera)
     └─< ai_imports (audit di ogni JSON incollato)
```

- **Peso una sola volta.** Nel foglio era duplicato in due tab; qui vive in `checkups`.
- **Circonferenze estendibili.** Nuovo punto di repere = una riga in `measurement_sites`, zero migrazioni.
  Supporto a lato sinistro/destro per braccio, coscia, polpaccio.
- **FK composite `(parent_id, user_id)`.** È fisicamente impossibile collegare dati di utenti diversi.
- **Protocolli BIA.** Strumenti diversi danno numeri non confrontabili; il motore segmenta i trend per protocollo.

### Viste
- `v_checkups` — serie unica per tabella/grafici: BIA + derivati (`fat_mass_kg`, `ffm_kg`, `tbw_kg`),
  circonferenze principali + `all_sites` (JSON), `bmi`, `ffmi`, `ffmi_normalized`,
  `waist_to_height`, `waist_to_abdomen`, `waist_to_hip`, `visit_number`, `days_since_prev`.
- `v_circumference_series` — formato lungo per i grafici ad area con selettori.
- `v_diet_day_totals` — totali kcal/macro per giorno (le alternative "oppure" non si sommano).

### RPC (transazionali, girano con la RLS dell'utente)
- `upsert_checkup(jsonb)` — crea/aggiorna una visita completa in modo atomico, semantica *merge*.
- `import_checkups(jsonb)` — import multiplo tutto-o-niente (es. foto dell'intero storico) + audit.
- `import_diet_plan(jsonb)` — piano completo giorni → pasti → alimenti, attivazione automatica.
- `save_checkup(jsonb)` — (migrazione 0002) salvataggio dai form con semantica *replace*: crea/modifica la visita completa in un'unica transazione; data duplicata → errore leggibile.

## 4. Smart Biometric Engine (anteprima Fase 4)

Funzioni pure in `features/biometrics/engine/`:

| Modulo | Output |
|---|---|
| `deltas.ts` | Δ assoluto e % vs visita precedente e vs baseline, normalizzati a 30 giorni |
| `recomposition.ts` | Classificazione per quadrante ΔFM × ΔFFM: *Ricomposizione*, *Lean bulk*, *Bulk sporco*, *Cut efficace*, *Perdita mista*, *Allarme perdita magra*, *Possibile ritenzione idrica* (Δpeso con ΔTBW% anomalo) |
| `indices.ts` | FFMI (+ normalizzato), BMI, WHtR, vita/addome, vita/fianchi |
| `energy.ts` | TDEE = BMR × fattore attività (+ confronto con target del piano) |
| `insights.ts` | Health Status: punti di forza, anomalie, note da portare al nutrizionista |
| `segments.ts` | Spezza la serie quando cambia protocollo BIA → niente falsi allarmi |

Le soglie stanno in `config/thresholds.ts`, non sparse nel codice.

## 5. Sicurezza
- RLS su **tutte** le tabelle; policy `to authenticated` con `(select auth.uid())`.
- Viste con `security_invoker = true`.
- RPC `security invoker`, `search_path = ''`, `execute` revocato ad `anon`.
- Supabase Auth: signup disabilitati → esiste solo il tuo utente.
- Solo la *publishable/anon key* arriva al browser; la service role key non serve all'app.

## 6. Roadmap
1. ✅ Architettura, setup, SQL
2. ✅ Tipi TS, client Supabase, auth gate, layout futuristico (Sidebar, Topbar, theme)
3. ✅ CRUD visite: form con validazione live, modale modifica, tabella ordinabile/filtrabile, delete con conferma
4. ✅ Motore biometrico + Dashboard Recharts
5. ✅ AI Bridge visite + analisi del sangue (migrazione 0003) (prompt generator + parser Zod + anteprima diff)
6. ✅ Nutrizione (prompt dieta, visualizzatore piano, checklist, macro vs TDEE)
7. ✅ Referti medici, integratori, motore dei consigli, previsioni, backup, MFA (migrazioni 0005–0006)
8. ✅ Allenamento: schede, registro sessioni, progressi, analisi fisico ↔ allenamento (migrazione 0007)
9. ✅ Allenamento v2 (archiviazione compatta, tecniche, editor, registro a schermo intero), mappa corporea, ottimizzazioni (migrazione 0008)

## 9. Archiviazione delle sessioni (0008)

`workouts.exercises` = `[{ c, n, s: [[reps, kg, rpe, tipo]], m }]` (tipo 0 allenante · 1 riscaldamento · 2 drop · 3 rest-pause · 4 cedimento).
Il trigger `workout_summary` calcola `summary` (per esercizio: serie, ripetizioni, volume, massimale stimato, serie migliore), `total_sets`, `total_volume`.

| Query | Cosa scarica | Quando |
|---|---|---|
| `useWorkouts` | intestazione + `summary` di tutte le sessioni | sempre (pochi KB anche dopo anni) |
| `useRecentWorkoutDetails` | serie complete delle ultime 8 settimane | registro (precompilazione, suggerimenti) |
| `useWorkoutDetail(id)` | una sessione completa | apertura nello storico / modifica |

Motore: progressi e volume lavorano sui riepiloghi; `lastPerformance` usa le serie recenti e, per esercizi non fatti di recente, la serie migliore del riepilogo.

## 10. Mappa corporea

`components/body/body-geometry.ts` (poligoni low-poly fronte/retro, specchiati) è condivisa da `BodyMap` (olografica, interattiva) e `MuscleFigure` (miniature degli esercizi). Effetti solo CSS: inclinazione col puntatore (desktop), rotazione fronte/retro, scansione in pausa fuori schermo.

## 8. Allenamento

| Modulo | Cosa fa |
|---|---|
| `training/engine/catalog.ts` | ~80 esercizi con codice, muscolo principale/secondari, schema motorio; esercizi di focus per muscolo; fasce di volume |
| `training/engine/analysis.ts` | Volume settimanale (serie principali 1, secondarie 0,5) da scheda e da sessioni, frequenza, massimale stimato (Epley ≤ 12 rip.), progressione con regressione su 8 settimane, giorno previsto oggi, costanza |
| `training/engine/physique.ts` | Circonferenze (media sx/dx), proporzioni classiche, asimmetrie, crescita a 6 mesi → carenze pesate (proporzioni + volume + crescita) con esercizi consigliati e punti forti; equilibrio della programmazione |
| `training/engine/report.ts` | Report unico + osservazioni |

RPC: `import_training(jsonb)` (scheda per nome, re-import sicuro che ricollega le sessioni ai giorni; storico idempotente per data+titolo) e `save_workout(jsonb)` (registro, semantica replace).

## 7. Motore dei consigli (aggiornamento 2)

| Modulo | Cosa fa |
|---|---|
| `biometrics/engine/forecast.ts` | Regressione lineare pesata (emivita 90 gg, finestra 9 mesi, stesso strumento BIA) → velocità mensile, R², data stimata per ogni obiettivo, valutazione del ritmo; punteggio di affidabilità dei dati |
| `nutrition/engine/foods.ts` | Classifica gli alimenti del piano (parole chiave italiane) → porzioni settimanali di verdura, legumi, pesce, carne rossa, salumi, integrali…; proteine per pasto |
| `supplements/engine/nutrients.ts` | Catalogo principi attivi con fabbisogni e UL EFSA, alias e conversioni (UI → µg) |
| `supplements/engine/analysis.ts` | Dosi giornaliere e medie settimanali, limiti, doppioni, interazioni (ferro/calcio, caffeina serale, zinco/rame, biotina/analisi), aderenza |
| `medical/engine/analysis.ts` | Stato delle misure (range del referto o generale), serie storiche, scadenze dei controlli, pressione ESC 2024, QTc |
| `advice/engine/advice.ts` | Regole indipendenti che incrociano tutti i domini → consigli con priorità, perché e cosa fare; indice di salute 0–100 |

`advice/hooks/use-health-context.ts` riusa la cache di TanStack Query: nessuna richiesta duplicata tra dashboard e pagina Consigli.

### Sicurezza e salvataggio
- Policy RLS **restrictive** `mfa_required` (0006): con un fattore TOTP verificato servono sessioni `aal2`.
- `(app)/layout.tsx` porta al passaggio del codice se la sessione è `aal1`; `proxy.ts` lascia passare `/login?mfa=1` e `/api/keepalive`.
- Backup: export di tutte le tabelle (JSON), ripristino tramite le RPC di import in modalità unione.
- Keep-alive: Vercel Cron → `/api/keepalive` (protetto da `CRON_SECRET`).
- CSP in produzione: il browser può contattare solo il sito e Supabase.

## 11. Sessione globale e offline (0009)
- `features/training/session/`: `workout-session` (store zustand: richiesta today/day/repeat/edit), `workout-host` (registro caricato alla prima apertura + pillola "in corso"), `storage` (bozza e outbox in localStorage, chiavi per utente, evento `vitruvian:workout-storage`), `outbox-sync` (invio al ritorno della rete), `send` (RPC `save_workout`).
- Le nuove sessioni hanno l'id generato sul client (`clientId` della bozza): `save_workout` fa update-or-insert, quindi i tentativi ripetuti sono idempotenti.
- `public/sw.js`: cache-first per `/_next/static`, network-first (4 s) con copia per le pagine, stale-while-revalidate per icone; Supabase e `/api` esclusi. Registrato solo in produzione (`NetworkStatus`), cache delle pagine svuotata al logout e a sessione scaduta.
- Profilo: `Onboarding` chiede sesso/nascita/altezza se mancanti; `bodyGeometry("female")` deforma la figura base; `proportions(sites, sex)` usa riferimenti specifici.
