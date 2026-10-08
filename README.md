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

## Aggiornamento 2 — Referti, integratori, consigli, sicurezza
1. SQL Editor → esegui `supabase/migrations/20261010000001_reports_supplements.sql` (referti medici, integratori, checklist, data ultimo backup).
2. SQL Editor → esegui `supabase/migrations/20261011000001_mfa_enforcement.sql` (il database risponde solo a sessioni con codice se la verifica in due passaggi è attiva; senza MFA non cambia nulla).
3. `npm install` (rimuove la libreria `motion`, sostituita da animazioni CSS).
4. Vercel → Settings → Environment Variables → aggiungi `CRON_SECRET` (una stringa casuale lunga, es. generata con un password manager). Serve al keep-alive giornaliero che evita la pausa del progetto Supabase gratuito dopo 7 giorni di inattività.
5. Novità:
   - **Referti medici** (`/reports`): ECG, visita sportiva, pressione, spirometria, eco, DEXA… importati con l'AI Bridge; misure nel tempo, esiti, scadenze dei controlli.
   - **Integratori** (`/supplements`): checklist giornaliera, costanza, dosi totali per principio attivo confrontate con i limiti EFSA, interazioni.
   - **Consigli** (`/advice`): motore che incrocia visite, obiettivi, dieta, analisi, integratori e referti; indice di salute; previsione della data di raggiungimento degli obiettivi; affidabilità dei dati.
   - Dashboard con "Il tuo quadro" (indice, consigli principali, agenda di oggi), ricerca rapida `Ctrl+K`, menu "Altro" su smartphone, suoni discreti (disattivabili), animazioni CSS.
   - **Impostazioni**: verifica in due passaggi (TOTP), disconnessione automatica, esci da tutti i dispositivi, backup completo JSON e ripristino.
   - Sicurezza: Content-Security-Policy in produzione, cache locale cancellata al logout.

---

## Aggiornamento 3 — Allenamento
1. SQL Editor → esegui `supabase/migrations/20261012000001_training.sql` (schede, giorni, esercizi, sessioni, serie; include già la protezione MFA).
2. **AI Bridge → Allenamento**: copia il prompt, dai all'IA la scheda (e il diario degli ultimi mesi), incolla la risposta.
3. **Allenamento** (`/training`):
   - seduta di oggi (giorno fisso o rotazione), registro con serie × carico, RPE, timer di recupero con suono, bozza salvata sul dispositivo, record personali;
   - volume settimanale per muscolo (scheda vs sessioni reali), equilibrio spinte/tirate, femorali/quadricipiti, gambe/busto, frequenza;
   - progressione per esercizio (massimale stimato Epley, tendenza %/mese, esercizi fermi);
   - collegamento con le misure: proporzioni (spalle/vita, torace/vita, braccio/collo, polpaccio/braccio…), asimmetrie sx/dx, crescita delle circonferenze → punti forti e distretti da potenziare con gli esercizi su cui concentrarsi.
4. Integrazioni: consigli "Allenamento" (anche incrociati con proteine, deficit, cardio, pressione, livello di attività del profilo), agenda della dashboard, integratori "solo nei giorni di allenamento", report stampabile, backup e ripristino.
5. Nelle visite, in "Altri siti", ora puoi inserire braccio, avambraccio, coscia e polpaccio sinistro/destro.

---

## Aggiornamento 4 — Allenamento v2, mappa corporea, prestazioni
1. SQL Editor → esegui `supabase/migrations/20261013000001_training_v2.sql`.
   Converte le sessioni già salvate nel nuovo formato compatto (nessun dato perso) e aggiunge tecniche ed editor delle schede.
   **Esegui la migrazione e pubblica il nuovo codice insieme**: la versione precedente dell'app non legge il nuovo formato.
2. **Allenamento** (`/training`), ora organizzato in schede:
   - *Allenati*: seduta di oggi, durata stimata, avvio del registro;
   - *Schede*: editor completo (giorni, esercizi, serie, ripetizioni, recupero, RIR, carico, superserie, tecniche) e modelli pronti (Full body, Upper/Lower, PPL);
   - *Esercizi*: libreria con figura dei muscoli coinvolti, indicazioni tecniche, record, grafico dei progressi;
   - *Storico*: calendario degli ultimi 6 mesi e sessioni (dettagli caricati solo su richiesta);
   - *Analisi*: punti deboli, volume per muscolo, proporzioni, progressione.
   - Registro a schermo intero: carico suggerito (doppia progressione), serie generate in base alla tecnica (piramide, piramide inversa, drop set, rest-pause, myo-reps, cluster, AMRAP, EMOM), riscaldamento automatico, dischi per lato, timer di recupero con suono e vibrazione, superserie, schermo sempre acceso durante l'allenamento, riepilogo finale con record e confronto con l'ultima volta.
3. **Archiviazione compatta**: ogni sessione è una riga con le serie in JSON compatto + un riepilogo calcolato dal database. Un anno a 3 allenamenti/settimana ≈ 150 KB; l'app scarica solo i riepiloghi (pochi KB) e le serie complete delle ultime 8 settimane.
4. **Mappa corporea** (`/body` e in dashboard): corpo olografico fronte/retro con circonferenze e variazioni, muscoli colorati per volume di allenamento o punti deboli, cuore e analisi, composizione e salute a lato.
5. **Prestazioni e batteria**: sfondo senza filtri di sfocatura, vetro delle card disattivato su telefono/tablet, animazioni solo `transform/opacity` e ferme fuori schermo, liste lunghe con `content-visibility`.

## Aggiornamento 5 — Allenamento ovunque, offline, più account
1. SQL Editor → esegui `supabase/migrations/20261014000001_offline_sync.sql` (salvataggio idempotente delle sessioni concluse offline). L'app funziona anche prima della migrazione, ma senza protezione dai doppioni.
2. **Avvio rapido**: card "Allenamento rapido" in dashboard (oggi / altro giorno della scheda / ripeti l'ultima / sessione libera), ricerca rapida (Ctrl+K) e scorciatoia dell'icona dell'app (tieni premuto). Il registro vive nella shell: resta aperto cambiando pagina e una pillola "allenamento in corso" permette di riprenderlo da qualsiasi schermata.
3. **Offline e salvataggi**: la bozza (serie, carichi, posizione, timer di recupero) è salvata sul dispositivo a ogni tocco e sopravvive a chiusure accidentali e riavvii. Senza rete la sessione conclusa va in coda e parte da sola al ritorno della connessione (id generato sul telefono → nessun doppione). Service worker (solo in produzione): file dell'app in cache, pagine principali disponibili offline; i dati restano nella cache locale dell'app (7 giorni, cancellata all'uscita). La disconnessione automatica si sospende durante l'allenamento e offline.
4. **Più account** (es. un secondo utente): ogni account vede solo i propri dati (RLS). Per crearne uno: *Authentication → Users → Add user → Create new user* (email + password provvisoria, *Auto confirm*); le iscrizioni pubbliche restano disattivate. Al primo accesso l'app chiede sesso, data di nascita e altezza; la password si cambia in *Impostazioni → Sicurezza*. Profilo donna: figura femminile nella mappa corporea, proporzioni di riferimento "a clessidra" (fianchi/vita, spalle/fianchi), valori di riferimento femminili già usati da BIA, analisi e integratori. Bozze e code offline sono separate per account anche sullo stesso telefono.
5. **Pagina Allenamento** più leggibile: schede a griglia su telefono, card "Questa settimana" (giorni fatti/previsti, numeri chiave, ultime 12 settimane), ultime sessioni con *ripeti* e *modifica*, consigli principali; tecniche in un pannello richiudibile; calcolatori (massimale stimato con tabella %, dischi per lato) nella sezione Esercizi; nuovo modello "Lower focus 3 giorni".

> Dopo aggiornamenti importanti, se `npm run dev` mostra errori su file che non esistono più (es. `lastSetsFor is not a function`), ferma il server, elimina la cartella `.next` e riavvia: è la cache del compilatore.

## Aggiornamento 6 — Controllo generale
1. SQL Editor → esegui di nuovo `supabase/migrations/20261014000001_offline_sync.sql` (aggiornata: una modifica a una sessione eliminata da un altro dispositivo non la ricrea più).
2. **Registro**: colonna *Precedente* per ogni serie (carico × ripetizioni della volta scorsa, riscaldamento con riscaldamento, drop con drop); un tocco la copia nella riga, *Usa questi* la copia in tutte. Riquadro *Ultima volta* con data e record; serie corrente evidenziata; colonna RPE facoltativa; spuntando una serie vuota si usano i valori precedenti. Nella seduta di oggi ogni esercizio mostra l'ultima serie migliore.
3. **Affidabilità**: con serie spuntate si salvano solo quelle; valori fuori scala limitati prima dell'invio; sessioni rifiutate dal server segnalate con *Riprova / Scarta*; modifiche alle sessioni salvate protette anche loro da chiusure accidentali; registro non chiudibile durante il salvataggio; sessioni delle ultime 8 settimane modificabili/ripetibili anche offline; codice del registro e delle pagine principali messo in cache in anticipo; stato offline corretto anche se l'app viene aperta già senza rete.

## Aggiornamento 7 — Revisione completa
1. SQL Editor → esegui `supabase/migrations/20261015000001_fixes.sql` (date degli integratori non ancora iniziati).
2. **Più account e sicurezza**: nessun dato di un account resta in memoria o nella copia locale quando entra un altro utente (anche dopo una sessione scaduta o un logout da un'altra scheda); "Esci" e la disconnessione automatica chiudono solo questo dispositivo (per tutti: *Esci da tutti i dispositivi*); attività condivisa tra le schede per la disconnessione automatica; consigli nascosti, domande per il nutrizionista e obiettivi festeggiati separati per account; redirect dopo il login limitato a pagine interne.
3. **Precisione**: obiettivo superato nella direzione voluta = raggiunto; visite con solo peso non interrompono i delta BIA né i controlli di plausibilità, nessun falso "cambio strumento"; nuova visita con l'ultimo strumento BIA usato; volume di allenamento diviso per le settimane effettive per chi ha iniziato da poco; alternative "oppure" della dieta contate come una porzione; melanzane, fagiolini, rana pescatrice, polpette, macinato di pollo/tacchino e granola classificati correttamente; integratori settimanali in checklist solo finché non hai fatto le dosi della settimana; costanza degli integratori contata solo da quando esistono; totali e limiti di sicurezza solo per gli integratori in corso; riferimenti delle analisi aggiornati subito al cambio di sesso/età; per le donne la crescita dei fianchi (con vita stabile) è un punto forte.
4. **Backup**: il ripristino ricrea i siti di misura personalizzati e la checklist dei pasti; data dell'ultimo backup in ora locale.
5. **Nuove funzioni**: *Esporta CSV* nello storico allenamenti (tutte le serie, apribile con Excel/Fogli); consiglio di **settimana di scarico** dopo 6+ settimane piene con progressi fermi o sessioni molto dure.
6. **Varie**: obiettivi modificabili anche con una data già passata; salvare una card del profilo non cancella le modifiche nell'altra; checklist pasti limitata ai giorni caricati; una scheda eliminata non resta selezionata; nel registro ogni esercizio mostra le serie fatte (es. 2/4).

## Aggiornamento 8 — Coach AI
1. **Coach AI** (menu *Strumenti* → *Coach AI*, oppure "Crea con Coach AI" in Allenamento e Nutrizione): scegli se ricevere scheda, dieta o entrambe, imposti le preferenze (giorni e minuti di allenamento, attrezzatura, esercizi o dolori da evitare, calorie e proteine suggerite dall'app, alimenti esclusi, numero di pasti e alternative) e quali dati includere. L'app prepara un unico prompt con il tuo fascicolo (profilo, composizione, circonferenze, analisi, referti, integratori, scheda e dieta attuali): lo copi o lo scarichi come .txt, lo incolli in Gemini/ChatGPT/Claude e incolli qui la risposta. Scheda e dieta vengono riconosciute anche nella stessa risposta, mostrate in anteprima e importate con un tocco; puoi scegliere se renderle attive. Preferenze salvate per ogni account.
2. **Registro**: la colonna *Precedente* considera anche una sessione fatta lo stesso giorno (doppio allenamento); "annulla" più affidabile.
3. **Import**: anteprima della dieta con le alternative scritte come "A oppure B"; messaggio finale corretto quando la scheda importata non viene attivata.
4. **Emoji** per riconoscere a colpo d'occhio alimenti (🍝 🍗 🥦 🍎…), pasti (☕ colazione, 🍝 pranzo…), esercizi per muscolo (🦵 💪 🦅 🍑 🏃…), integratori e le voci di "Oggi" in dashboard.
5. Scheda, dieta o sessione eliminate non generano più errori di caricamento nelle altre schermate.

---

## Convenzioni
- Migrazioni: mai modificare un file già applicato → crea `supabase/migrations/<timestamp>_descrizione.sql`.
- Dopo ogni migrazione: `npm run db:types`.
- Commit: `feat:`, `fix:`, `chore:`, `refactor:` (Conventional Commits).
