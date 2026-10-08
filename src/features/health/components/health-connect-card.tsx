"use client"

import { Check, ChevronDown, Copy, HeartPulse, LoaderCircle, RefreshCw, Unplug } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"

import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { GlassCard } from "@/components/shared/glass-card"
import { Button } from "@/components/ui/button"
import { formatDate } from "@/lib/format"
import { playSound } from "@/lib/sound"
import { cn } from "@/lib/utils"

import { useCreateHealthToken, useDisconnectHealth, useHealthDays, useHealthLink } from "../api/health"

function CopyField({ label, value, secret }: { label: string; value: string; secret?: boolean }) {
  const [copied, setCopied] = useState(false)
  return (
    <div>
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <div className="flex items-center gap-2">
        <code className={cn("min-w-0 flex-1 truncate rounded-lg bg-accent/50 px-3 py-2 text-xs", secret && "font-semibold text-neon")}>{value}</code>
        <Button
          size="icon"
          variant="outline"
          className="size-9 shrink-0 rounded-lg"
          aria-label={`Copia ${label}`}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(value)
              setCopied(true)
              playSound("check")
              setTimeout(() => setCopied(false), 1500)
            } catch {
              toast.error("Copia non riuscita: tieni premuto il testo e copialo a mano")
            }
          }}
        >
          {copied ? <Check className="size-4 text-gain" /> : <Copy className="size-4" />}
        </Button>
      </div>
    </div>
  )
}

const V = ({ children }: { children: React.ReactNode }) => <span className="rounded bg-accent/60 px-1.5 py-0.5 font-medium text-foreground">{children}</span>

/** Collegamento con Apple Salute tramite Comandi Rapidi (e Mi Band tramite Mi Fitness). */
export function HealthConnectCard() {
  const linkQ = useHealthLink()
  const daysQ = useHealthDays()
  const create = useCreateHealthToken()
  const disconnect = useDisconnectHealth()
  const [token, setToken] = useState<string | null>(null)
  const [guide, setGuide] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [origin, setOrigin] = useState("")
  useEffect(() => {
    setOrigin(window.location.origin)
    // arrivo da "Collega Apple Salute" in dashboard: porta qui la card
    if (window.location.hash === "#salute") setTimeout(() => document.getElementById("salute")?.scrollIntoView({ behavior: "smooth", block: "start" }), 200)
  }, [])

  const link = linkQ.data
  const lastDay = daysQ.data?.[0]?.day ?? null
  const url = `${origin}/api/health`

  async function generate() {
    try {
      const t = await create.mutateAsync()
      setToken(t)
      setGuide(true)
      playSound("success")
    } catch (e) {
      playSound("error")
      toast.error("Codice non creato", { description: e instanceof Error ? e.message : undefined })
    }
  }

  return (
    <GlassCard className="p-5 sm:p-6" id="salute">
      <div className="mb-4 flex items-center gap-3">
        <span className="grid size-9 place-items-center rounded-xl bg-danger/10 text-danger ring-1 ring-inset ring-danger/25">
          <HeartPulse className="size-4" />
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">Apple Salute e Mi Band</h2>
          <p className="text-xs text-muted-foreground">Passi, sonno, battiti a riposo, calorie attive e peso, in automatico ogni giorno.</p>
        </div>
      </div>

      {link?.available === false ? (
        <p className="rounded-lg bg-warn/10 px-3 py-2 text-xs text-warn ring-1 ring-inset ring-warn/25">
          Per attivare il collegamento esegui prima la migrazione <code>20261016000001_push_health.sql</code> nel SQL Editor di Supabase.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {link ? (
              <span className="rounded-full bg-gain/15 px-2.5 py-1 text-xs font-medium text-gain">
                ✅ Collegato{link.last_used_at ? ` · ultimo invio ${formatDate(link.last_used_at.slice(0, 10), "medium")}` : " · in attesa del primo invio"}
              </span>
            ) : (
              <span className="rounded-full bg-accent px-2.5 py-1 text-xs text-muted-foreground">Non collegato</span>
            )}
            {lastDay && <span className="text-xs text-muted-foreground">dati fino al {formatDate(lastDay, "medium")}</span>}
          </div>

          {token && (
            <div className="mt-4 space-y-3 rounded-xl border border-neon/30 bg-neon/[0.04] p-4">
              <p className="text-xs text-muted-foreground">
                Copia questi due valori nel Comando Rapido. <strong className="text-foreground">Il codice si vede solo adesso</strong>: se lo perdi, generane uno nuovo.
              </p>
              <CopyField label="Indirizzo (URL)" value={url} />
              <CopyField label="Codice personale (token)" value={token} secret />
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="sm" className="rounded-lg" onClick={() => void generate()} disabled={create.isPending || linkQ.isPending}>
              {create.isPending ? <LoaderCircle className="size-4 animate-spin" /> : link ? <RefreshCw className="size-4" /> : <HeartPulse className="size-4" />}
              {link ? "Nuovo codice" : "Collega Apple Salute"}
            </Button>
            <Button size="sm" variant="outline" className="rounded-lg" onClick={() => setGuide((g) => !g)} aria-expanded={guide}>
              Guida passo passo <ChevronDown className={cn("size-4 transition-transform", guide && "rotate-180")} />
            </Button>
            {link && (
              <Button size="sm" variant="ghost" className="rounded-lg text-muted-foreground" onClick={() => setConfirm(true)}>
                <Unplug className="size-4" /> Scollega
              </Button>
            )}
          </div>

          {guide && (
            <div className="mt-4 space-y-4 text-sm">
              <section>
                <h3 className="font-semibold">⌚ 1. Mi Band → Apple Salute</h3>
                <p className="mt-1 text-muted-foreground">
                  Nell&apos;app <V>Mi Fitness</V> apri <V>Profilo</V> e cerca <V>Apple Salute</V> (in alcune versioni sta in «Servizi di terze parti»): attivala e consenti tutte le
                  categorie. Da lì passi, sonno e battiti arrivano in Salute; se usi solo iPhone o Apple Watch salta questo passaggio.
                </p>
              </section>
              <section>
                <h3 className="font-semibold">🔑 2. Codice personale</h3>
                <p className="mt-1 text-muted-foreground">
                  Tocca <V>{link ? "Nuovo codice" : "Collega Apple Salute"}</V> qui sopra e tieni a portata di mano indirizzo e codice.
                </p>
              </section>
              <section>
                <h3 className="font-semibold">🧩 3. Comando Rapido (5 minuti)</h3>
                <p className="mt-1 text-muted-foreground">
                  App <V>Comandi Rapidi</V> → <V>+</V> → nome «Vitruvian». Aggiungi queste azioni (cerca il nome in basso):
                </p>
                <ol className="mt-2 list-decimal space-y-2 pl-5 text-muted-foreground">
                  <li>
                    <V>Trova campioni di Salute</V> dove Tipo è <V>Passi</V> e Data di inizio è <V>Oggi</V>, poi <V>Calcola statistiche</V> → <V>Somma</V>.
                  </li>
                  <li>
                    Stesse due azioni con Tipo <V>Energia attiva</V> → <V>Somma</V>.
                  </li>
                  <li>
                    <V>Trova campioni di Salute</V> con Tipo <V>Frequenza cardiaca a riposo</V>, ordina per <V>Data di inizio</V> dal più recente, limite <V>1</V>. (Facoltativi
                    allo stesso modo: <V>Variabilità frequenza cardiaca</V> e <V>Peso</V>.)
                  </li>
                  <li>
                    Sonno (facoltativo): <V>Trova campioni di Salute</V> con Tipo <V>Analisi del sonno</V>, Data di inizio <V>nell&apos;ultimo 1 giorno</V>, Valore diverso da{" "}
                    <V>A letto</V> e da <V>Sveglio</V>; poi <V>Ottieni dettagli dei campioni di Salute</V> → <V>Durata</V> e <V>Calcola statistiche</V> → <V>Somma</V>.
                  </li>
                  <li>
                    <V>Ottieni contenuto dell&apos;URL</V>: incolla l&apos;indirizzo, Metodo <V>POST</V>, Corpo della richiesta <V>JSON</V> con i campi (tipo Testo):{" "}
                    <V>token</V> = il codice, <V>steps</V>, <V>active_kcal</V>, <V>resting_hr</V>, <V>hrv</V>, <V>weight_kg</V>, <V>sleep_hours</V> = i risultati delle azioni
                    sopra (tocca il campo e scegli la variabile). I campi che non ti servono puoi non metterli.
                  </li>
                  <li>
                    <V>Mostra risultato</V>: esegui il comando con ▶︎ e consenti l&apos;accesso a Salute. Se vedi <V>&quot;ok&quot;: true</V> con i tuoi valori, funziona.
                  </li>
                </ol>
                <p className="mt-2 text-xs text-muted-foreground">
                  Ore e minuti del sonno vanno bene in qualunque formato (7,5 · 450 · «7 h 30 min»). Una volta provato, puoi togliere «Mostra risultato».
                </p>
              </section>
              <section>
                <h3 className="font-semibold">⏰ 4. In automatico ogni sera</h3>
                <p className="mt-1 text-muted-foreground">
                  Comandi Rapidi → <V>Automazione</V> → <V>+</V> → <V>Ora del giorno</V> (es. 23:30, ogni giorno) → <V>Esegui immediatamente</V> → scegli «Vitruvian». Puoi
                  aggiungerne una anche al mattino per il sonno appena finito: ogni invio aggiorna i valori del giorno.
                </p>
              </section>
              <p className="rounded-lg bg-accent/40 px-3 py-2 text-xs text-muted-foreground">
                🔒 Il codice permette solo di <em>inviare</em> questi valori al tuo account: non legge nulla. Nel database c&apos;è solo la sua impronta. Puoi scollegarlo
                quando vuoi.
              </p>
            </div>
          )}
        </>
      )}

      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Scollegare Apple Salute?"
        description="Il codice smette di funzionare. I dati già ricevuti restano nell'app."
        confirmLabel="Scollega"
        pending={disconnect.isPending}
        onConfirm={async () => {
          try {
            await disconnect.mutateAsync(false)
            setToken(null)
            setConfirm(false)
            toast.success("Apple Salute scollegata")
          } catch (e) {
            toast.error("Operazione non riuscita", { description: e instanceof Error ? e.message : undefined })
          }
        }}
      />
    </GlassCard>
  )
}
