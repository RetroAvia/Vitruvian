# Vitruvian

Health & Body Composition Tracker — BIA, circonferenze, nutrizione.
Stack: Next.js · TypeScript · Tailwind · shadcn/ui · Recharts · Supabase · Vercel (tutto gratuito).

Architettura completa: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)

---

## Setup (Fase 1)

### 0. Prerequisiti
- Node.js 20+ (consigliato LTS più recente), Git
- Account gratuiti: GitHub, Supabase, Vercel

### 1. Progetto locale
```powershell
cd C:\Vitruvian
npm install
copy .env.example .env.local   # poi compila URL e chiave (punto 2.6)
npm run dev                    # http://localhost:3000
```
Il progetto è già completo (Next.js, Tailwind v4, componenti shadcn/ui in `src/components/ui`):
non serve `create-next-app` né `shadcn init`. Per aggiungere altri componenti shadcn: `npx shadcn@latest add <nome>`.

### 2. Supabase
1. **New project** (regione: *Central EU – Frankfurt*). Annota la password del DB.
2. **SQL Editor → New query** → incolla ed esegui
   `supabase/migrations/20261006000001_init_schema.sql`.
   Incolla **tutto il file** e premi *Run* senza selezionare righe (se selezioni del testo, Supabase esegue solo quello).
   Se esce "already exists", esegui prima `supabase/reset.sql` e poi rilancia la migrazione.
3. **Authentication → Sign In / Providers** → *Email* attivo, **"Allow new users to sign up" OFF**.
4. **Authentication → Users → Add user** → la tua email + password (spunta *Auto confirm*).
5. **SQL Editor** → apri `supabase/seed.sql`, sostituisci email (e altezza in cm), esegui.
   Importa le 17 visite del Google Foglio.
6. **Project Settings → API** → copia URL e publishable/anon key in `.env.local`.
7. Genera i tipi TypeScript (sostituisce `src/types/database.types.ts`):
   ```bash
   npx supabase login
   npx supabase link --project-ref <ref>
   npm run db:types
   ```

> In alternativa al punto 2 puoi usare la CLI: `npx supabase link --project-ref <ref>` e `npx supabase db push`.

**Verifica rapida** (SQL Editor):
```sql
select checkup_date, weight_kg, fat_mass_kg, ffm_kg, ffmi, waist_to_height
from v_checkups order by checkup_date;
```

### 3. GitHub
```bash
gh repo create vitruvian --private --source=. --push
# oppure crea il repo dal sito e: git remote add origin … && git push -u origin main
```

### 4. Vercel
1. **Add New → Project → Import** il repo `vitruvian`.
2. **Environment Variables**: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
3. Deploy. Da qui ogni `git push` su `main` va in produzione, ogni PR ha la sua preview.
4. In Supabase → **Authentication → URL Configuration** imposta *Site URL* = dominio Vercel.

---

## Fase 2 — Shell dell'app, auth e design system
Incluso nel progetto. Verifica: `npm run typecheck`, poi `npm run dev` e accedi con l'utente creato su Supabase.
Il gate di autenticazione è in `src/proxy.ts` (Next.js 16).

---

## Fase 3 — Gestione dati
1. `npm i @radix-ui/react-dialog @radix-ui/react-alert-dialog`
2. SQL Editor → esegui `supabase/migrations/20261007000001_save_checkup.sql`.
3. `npm run dev` → **Visite** (tabella, nuova visita, modifica, elimina con annulla, export CSV) e **Impostazioni** (profilo, strumenti BIA).

---

## Fase 5 — AI Bridge e analisi del sangue
1. SQL Editor → esegui `supabase/migrations/20261008000001_lab_results.sql`.
2. **AI Bridge** → scheda *Visita* o *Analisi del sangue* → copia il prompt → incollalo in Gemini/ChatGPT/Claude con il referto allegato → incolla la risposta → verifica → importa.
3. **Analisi** → valori, range, tendenze, indici calcolati (non-HDL, TG/HDL, HOMA-IR, eGFR…).

---

## Fase 6 — Nutrizione
Nessuna migrazione. **AI Bridge → Dieta**: prompt → risposta dell'IA → anteprima → import.
**Nutrizione**: checklist dei pasti, bilancio energetico vs TDEE, macro e g/kg, aderenza, osservazioni incrociate con la composizione corporea.

---

## Rifinitura pre-pubblicazione
1. SQL Editor → esegui `supabase/migrations/20261009000001_goals.sql` (obiettivi personali).
2. Novità: dashboard a sezioni con riepilogo, obiettivi, glossario ⓘ, report stampabile (`/report`), app installabile (manifest + icone), header di sicurezza.

---

## Convenzioni
- Migrazioni: mai modificare un file già applicato → crea `supabase/migrations/<timestamp>_descrizione.sql`.
- Dopo ogni migrazione: `npm run db:types`.
- Commit: `feat:`, `fix:`, `chore:`, `refactor:` (Conventional Commits).
