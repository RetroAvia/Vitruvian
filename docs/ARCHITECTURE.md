# Vitruvian — Architettura

> Web app personale per monitorare composizione corporea (BIA), circonferenze e nutrizione.
> Evoluzione dei fogli Google "Dati Fisico" e "Misure Fisico".

## 1. Decisioni chiave

| Area | Scelta | Perché |
|---|---|---|
| Framework | **Next.js (App Router, TypeScript)**, ultima stable via `create-next-app@latest` | Route groups per separare auth/app, server-side auth gate, deploy nativo su Vercel |
| UI | Tailwind CSS + shadcn/ui (Radix) + Lucide | Componenti accessibili che *possiedi* nel repo, niente lock-in |
| Animazioni | `motion` (ex Framer Motion) | Solo `transform`/`opacity`, `LazyMotion` per tenere leggero il bundle |
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
