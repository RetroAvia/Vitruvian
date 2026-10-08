"use client"

import { Bot, Check, ClipboardCopy, ClipboardPaste, Download, Dumbbell, Eraser, FileText, Salad, Sparkles } from "lucide-react"
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { toast } from "sonner"

import { useSessionUser } from "@/components/layout/session-user-context"
import { GlassCard } from "@/components/shared/glass-card"
import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { useHealthContext } from "@/features/advice/hooks/use-health-context"
import { DietBridge } from "@/features/ai-bridge/components/diet-bridge"
import { TrainingBridge } from "@/features/ai-bridge/components/training-bridge"
import { useDietPlans, usePlanTree } from "@/features/nutrition/api/nutrition"
import { GOAL_LABELS } from "@/features/training/types"
import { formatNumber, isNum, todayISO } from "@/lib/format"
import { playSound } from "@/lib/sound"
import { cn } from "@/lib/utils"

import { buildSnapshot, SECTION_LABELS, type SnapshotSections } from "./coach-data"
import {
  buildCoachPrompt,
  CARDIO_LABELS,
  COOKING_LABELS,
  DEFAULT_DIET,
  DEFAULT_TRAINING,
  DIET_GOAL_LABELS,
  FOCUS_OPTIONS,
  INTOLERANCE_OPTIONS,
  LEVEL_LABELS,
  PLACE_LABELS,
  STRUCTURE_LABELS,
  STYLE_LABELS,
  suggestedTargets,
  type CoachTarget,
  type DietPrefs,
  type TrainingPrefs,
} from "./coach-prompt"

interface Stored {
  target: CoachTarget
  training: TrainingPrefs
  diet: DietPrefs
  sections: SnapshotSections
}

const DEFAULT_SECTIONS: SnapshotSections = { body: true, labs: true, medical: true, supplements: true, training: true, diet: true }
const DOW = ["L", "M", "M", "G", "V", "S", "D"]

/**
 * Coach AI: prepara il prompt con tutti i dati dell'app e le preferenze scelte,
 * da incollare in Gemini / ChatGPT / Claude; la risposta torna qui e si importa
 * con un tocco (scheda, dieta o entrambe).
 */
export function CoachView() {
  const user = useSessionUser()
  const key = `vitruvian-coach:${user.id}`
  const { input, isPending } = useHealthContext()
  const plansQ = useDietPlans()
  const activeDiet = (plansQ.data ?? []).find((p) => p.is_active) ?? null
  const dietTreeQ = usePlanTree(activeDiet?.id ?? null)

  const [state, setState] = useState<Stored>({ target: "both", training: DEFAULT_TRAINING, diet: DEFAULT_DIET, sections: DEFAULT_SECTIONS })
  const [loaded, setLoaded] = useState(false)
  const [answer, setAnswer] = useState("")
  const [imported, setImported] = useState<{ training: boolean; diet: boolean }>({ training: false, diet: false })
  const [copied, setCopied] = useState(false)
  const [showData, setShowData] = useState(false)

  const setFromProfile = useRef(false)
  // preferenze ricordate su questo dispositivo (per account)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key)
      if (raw) {
        const s = JSON.parse(raw) as Partial<Stored>
        setState((cur) => ({ target: s.target ?? cur.target, training: { ...DEFAULT_TRAINING, ...s.training }, diet: { ...DEFAULT_DIET, ...s.diet }, sections: { ...DEFAULT_SECTIONS, ...s.sections } }))
      } else setFromProfile.current = true
    } catch {
      /* ignore */
    }
    setLoaded(true)
  }, [key])
  useEffect(() => {
    if (!loaded) return
    try {
      localStorage.setItem(key, JSON.stringify(state))
    } catch {
      /* ignore */
    }
  }, [state, loaded, key])

  // prima volta: obiettivo della dieta dedotto dagli obiettivi del profilo
  useEffect(() => {
    if (!setFromProfile.current || !input) return
    setFromProfile.current = false
    const w = input.bio?.latest?.weight_kg
    const t = input.profile?.target_weight_kg
    const goal: DietPrefs["goal"] = isNum(w) && isNum(t) ? (t > w + 1 ? "gain" : t < w - 1 ? "lose" : "maintain") : isNum(input.profile?.target_fat_pct) ? "recomp" : "maintain"
    setState((s) => ({ ...s, diet: { ...s.diet, goal }, training: { ...s.training, goal: goal === "lose" ? "fat_loss" : goal === "recomp" ? "recomp" : "hypertrophy" } }))
  }, [input, loaded])

  const setT = (patch: Partial<TrainingPrefs>) => setState((s) => ({ ...s, training: { ...s.training, ...patch } }))
  const setD = (patch: Partial<DietPrefs>) => setState((s) => ({ ...s, diet: { ...s.diet, ...patch } }))
  const { target, training, diet, sections } = state
  const wantT = target !== "diet"
  const wantD = target !== "training"

  const suggestion = useMemo(
    () => suggestedTargets(input?.bio?.energy.tdee ?? null, input?.bio?.latest?.weight_kg ?? null, diet.goal),
    [input?.bio?.energy.tdee, input?.bio?.latest?.weight_kg, diet.goal],
  )

  const snapshot = useMemo(() => (input ? buildSnapshot(input, dietTreeQ.data?.days ?? null, sections) : ""), [input, dietTreeQ.data, sections])
  const prompt = useMemo(
    () =>
      buildCoachPrompt({
        target,
        training,
        diet: { ...diet, kcal: diet.kcal ?? suggestion.kcal, protein: diet.protein ?? suggestion.protein },
        snapshot,
        name: user.displayName,
      }),
    [target, training, diet, suggestion, snapshot, user.displayName],
  )

  async function copy() {
    try {
      await navigator.clipboard.writeText(prompt)
      setCopied(true)
      playSound("success")
      toast.success("Prompt copiato", { description: "Incollalo in Gemini, ChatGPT o Claude e invia." })
      setTimeout(() => setCopied(false), 3000)
    } catch {
      toast.error("Copia non riuscita: usa \"Scarica file\"")
    }
  }

  function download() {
    const url = URL.createObjectURL(new Blob([prompt], { type: "text/plain;charset=utf-8" }))
    const a = document.createElement("a")
    a.href = url
    a.download = `vitruvian-coach-${todayISO()}.txt`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  async function pasteAnswer() {
    try {
      setAnswer(await navigator.clipboard.readText())
      setImported({ training: false, diet: false })
    } catch {
      toast.error("Il browser non permette di leggere gli appunti: incolla con Ctrl+V o tieni premuto")
    }
  }

  const header = (
    <PageHeader
      icon={Bot}
      eyebrow="Intelligenza"
      title="Coach AI"
      description="Scheda di allenamento e dieta su misura da un'IA (Gemini, ChatGPT, Claude) che legge tutti i tuoi dati: misure, analisi, allenamenti e preferenze."
    />
  )

  if (isPending || !input) {
    return (
      <>
        {header}
        <Skeleton className="h-96 rounded-2xl" />
      </>
    )
  }

  return (
    <>
      {header}
      <div className="space-y-5">
        {/* 1. Cosa */}
        <Step n={1} title="Cosa vuoi ricevere?">
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                ["training", "Scheda", Dumbbell],
                ["diet", "Dieta", Salad],
                ["both", "Entrambe", Sparkles],
              ] as const
            ).map(([id, label, Icon]) => (
              <button
                key={id}
                type="button"
                aria-pressed={target === id}
                onClick={() => setState((s) => ({ ...s, target: id }))}
                className={cn(
                  "flex flex-col items-center gap-1.5 rounded-2xl p-3 text-sm font-medium ring-1 ring-inset transition-colors",
                  target === id ? "bg-neon/10 text-neon ring-neon/50" : "text-muted-foreground ring-border hover:text-foreground",
                )}
              >
                <Icon className="size-5" />
                {label}
              </button>
            ))}
          </div>
        </Step>

        {/* 2. Preferenze */}
        <div className={cn("grid gap-5", wantT && wantD && "xl:grid-cols-2")}>
          {wantT && (
            <Step n={2} title="Allenamento" icon={Dumbbell}>
              <Field label="Obiettivo">
                <Chips options={GOAL_LABELS} value={training.goal} onChange={(goal) => setT({ goal })} />
              </Field>
              <Field label="Esperienza">
                <Chips options={LEVEL_LABELS} value={training.level} onChange={(level) => setT({ level })} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Giorni a settimana">
                  <Stepper value={training.days} min={1} max={7} onChange={(days) => setT({ days })} />
                </Field>
                <Field label="Durata seduta">
                  <Stepper value={training.minutes} min={20} max={150} step={15} unit="min" onChange={(minutes) => setT({ minutes })} />
                </Field>
              </div>
              <Field label="Giorni preferiti (facoltativo)">
                <div className="flex gap-1.5">
                  {DOW.map((d, i) => {
                    const on = training.preferredDays.includes(i + 1)
                    return (
                      <button
                        key={i}
                        type="button"
                        aria-pressed={on}
                        onClick={() => setT({ preferredDays: on ? training.preferredDays.filter((x) => x !== i + 1) : [...training.preferredDays, i + 1].sort() })}
                        className={cn("grid size-9 place-items-center rounded-full text-xs font-medium ring-1 ring-inset", on ? "bg-neon text-background ring-neon" : "text-muted-foreground ring-border")}
                      >
                        {d}
                      </button>
                    )
                  })}
                </div>
              </Field>
              <Field label="Dove ti alleni">
                <Chips options={PLACE_LABELS} value={training.place} onChange={(place) => setT({ place })} />
              </Field>
              <Field label="Distretti da privilegiare">
                <MultiChips options={FOCUS_OPTIONS} value={training.focus} onChange={(focus) => setT({ focus })} />
              </Field>
              <Field label="Cardio">
                <Chips options={CARDIO_LABELS} value={training.cardio} onChange={(cardio) => setT({ cardio })} />
              </Field>
              <Field label="Problemi, dolori o esercizi da evitare">
                <Textarea value={training.avoid} onChange={(e) => setT({ avoid: e.target.value })} placeholder="es. fastidio alla spalla destra, niente stacchi da terra, ginocchio operato…" className="min-h-16 rounded-xl text-sm" />
              </Field>
              <div className="grid gap-2 sm:grid-cols-2">
                <Toggle on={training.techniques} onChange={(techniques) => setT({ techniques })} label="Tecniche avanzate" hint="piramide, drop set, rest-pause" />
                <Toggle on={training.variants} onChange={(variants) => setT({ variants })} label="Varianti per esercizio" hint="alternative se l'attrezzo è occupato" />
              </div>
              <Field label="Altro da sapere (facoltativo)">
                <Input value={training.notes} onChange={(e) => setT({ notes: e.target.value })} placeholder="es. voglio migliorare le trazioni" className="h-10 rounded-xl" />
              </Field>
            </Step>
          )}

          {wantD && (
            <Step n={wantT ? 3 : 2} title="Alimentazione" icon={Salad}>
              <Field label="Obiettivo">
                <Chips options={DIET_GOAL_LABELS} value={diet.goal} onChange={(goal) => setD({ goal })} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Calorie al giorno">
                  <Input
                    inputMode="numeric"
                    value={diet.kcal ?? ""}
                    placeholder={suggestion.kcal ? String(suggestion.kcal) : "auto"}
                    onChange={(e) => setD({ kcal: e.target.value ? Number(e.target.value.replace(/\D/g, "")) || null : null })}
                    className="h-10 rounded-xl tabular"
                  />
                </Field>
                <Field label="Proteine (g)">
                  <Input
                    inputMode="numeric"
                    value={diet.protein ?? ""}
                    placeholder={suggestion.protein ? String(suggestion.protein) : "auto"}
                    onChange={(e) => setD({ protein: e.target.value ? Number(e.target.value.replace(/\D/g, "")) || null : null })}
                    className="h-10 rounded-xl tabular"
                  />
                </Field>
              </div>
              {suggestion.kcal && (
                <p className="-mt-2 text-[11px] text-muted-foreground">
                  Lasciando vuoto si usa il suggerimento dell&apos;app: {formatNumber(suggestion.kcal, 0)} kcal{suggestion.protein ? ` · ${suggestion.protein} g di proteine` : ""} (dal tuo fabbisogno misurato e dall&apos;obiettivo).
                </p>
              )}
              <div className="grid grid-cols-2 gap-3">
                <Field label="Pasti al giorno">
                  <Stepper value={diet.meals} min={2} max={7} onChange={(meals) => setD({ meals })} />
                </Field>
                <Field label="Varianti per pasto">
                  <Stepper value={diet.alternatives} min={1} max={4} onChange={(alternatives) => setD({ alternatives })} />
                </Field>
              </div>
              <Field label="Stile alimentare">
                <Chips options={STYLE_LABELS} value={diet.style} onChange={(style) => setD({ style })} />
              </Field>
              <Field label="Struttura del menu">
                <Chips options={STRUCTURE_LABELS} value={diet.structure} onChange={(structure) => setD({ structure })} />
              </Field>
              <Field label="Intolleranze e allergie">
                <MultiChips options={INTOLERANCE_OPTIONS} value={diet.intolerances} onChange={(intolerances) => setD({ intolerances })} />
              </Field>
              <Field label="Cibi da evitare">
                <Input value={diet.avoid} onChange={(e) => setD({ avoid: e.target.value })} placeholder="es. funghi, peperoni, carne rossa" className="h-10 rounded-xl" />
              </Field>
              <Field label="Cibi che ti piacciono">
                <Input value={diet.likes} onChange={(e) => setD({ likes: e.target.value })} placeholder="es. salmone, yogurt, riso, frutta secca" className="h-10 rounded-xl" />
              </Field>
              <Field label="Tempo per cucinare">
                <Chips options={COOKING_LABELS} value={diet.cooking} onChange={(cooking) => setD({ cooking })} />
              </Field>
              <Field label="Altro da sapere (facoltativo)">
                <Input value={diet.notes} onChange={(e) => setD({ notes: e.target.value })} placeholder="es. pranzo fuori casa nei giorni lavorativi" className="h-10 rounded-xl" />
              </Field>
            </Step>
          )}
        </div>

        {/* 3. Prompt */}
        <Step n={wantT && wantD ? 4 : 3} title="Copia il prompt e invialo all'IA" icon={FileText} done={copied}>
          <p className="mb-3 text-xs text-muted-foreground">Dati inclusi (tocca per escludere):</p>
          <div className="mb-4 flex flex-wrap gap-1.5">
            {(Object.keys(SECTION_LABELS) as Array<keyof SnapshotSections>).map((k) => (
              <button
                key={k}
                type="button"
                aria-pressed={sections[k]}
                onClick={() => setState((s) => ({ ...s, sections: { ...s.sections, [k]: !s.sections[k] } }))}
                className={cn("rounded-full px-3 py-1 text-xs ring-1 ring-inset", sections[k] ? "bg-gain/10 text-gain ring-gain/30" : "text-muted-foreground line-through ring-border")}
              >
                {SECTION_LABELS[k]}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button className="h-11 rounded-xl" onClick={() => void copy()}>
              {copied ? <Check className="size-4" /> : <ClipboardCopy className="size-4" />}
              {copied ? "Copiato" : "Copia prompt"}
            </Button>
            <Button variant="outline" className="h-11 rounded-xl" onClick={download}>
              <Download className="size-4" /> Scarica file
            </Button>
            <Button variant="ghost" className="h-11 rounded-xl text-xs" onClick={() => setShowData((v) => !v)} aria-expanded={showData}>
              {showData ? "Nascondi" : "Mostra"} il testo
            </Button>
          </div>
          <ol className="mt-4 list-inside list-decimal space-y-0.5 rounded-xl border border-neon/20 bg-neon/[0.04] p-3 text-xs text-muted-foreground">
            <li>Apri Gemini, ChatGPT o Claude (meglio un modello avanzato) e incolla il prompt.</li>
            <li>Se preferisci, allega il file scaricato invece di incollare il testo.</li>
            <li>Copia tutta la risposta e incollala qui sotto: l&apos;app controlla i dati e li importa.</li>
          </ol>
          {showData && <pre className="mt-4 max-h-96 overflow-auto whitespace-pre-wrap rounded-xl border bg-background/50 p-3 font-mono text-[11px] leading-relaxed">{prompt}</pre>}
        </Step>

        {/* 4. Risposta */}
        <Step n={wantT && wantD ? 5 : 4} title="Incolla la risposta dell'IA" icon={ClipboardPaste} done={(!wantT || imported.training) && (!wantD || imported.diet)}>
          <Textarea
            value={answer}
            onChange={(e) => {
              setAnswer(e.target.value)
              setImported({ training: false, diet: false })
            }}
            placeholder={target === "both" ? "Incolla qui tutta la risposta (contiene scheda e dieta)" : "Incolla qui la risposta"}
            spellCheck={false}
            className="h-40 resize-y rounded-xl font-mono text-xs"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="outline" size="sm" className="rounded-lg" onClick={() => void pasteAnswer()}>
              <ClipboardPaste className="size-3.5" /> Incolla dagli appunti
            </Button>
            {answer && (
              <Button variant="ghost" size="sm" className="rounded-lg text-muted-foreground" onClick={() => setAnswer("")}>
                <Eraser className="size-3.5" /> Svuota
              </Button>
            )}
          </div>
        </Step>

        {answer.trim() && (
          <div className="space-y-6">
            {wantT && (
              <section>
                <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                  <Dumbbell className="size-4 text-neon" /> Scheda proposta
                </h3>
                <TrainingBridge embeddedText={imported.training ? "" : answer} onImported={() => setImported((s) => ({ ...s, training: true }))} />
              </section>
            )}
            {wantD && (
              <section>
                <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                  <Salad className="size-4 text-neon" /> Dieta proposta
                </h3>
                <DietBridge embeddedText={imported.diet ? "" : answer} onImported={() => setImported((s) => ({ ...s, diet: true }))} />
              </section>
            )}
          </div>
        )}

        <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
          Le proposte dell&apos;IA sono indicative e non sostituiscono medico, nutrizionista o preparatore: in caso di patologie o dolori chiedi sempre a un professionista.
        </p>
      </div>
    </>
  )
}

/* ------------------------------- Componenti ------------------------------- */

function Step({ n, title, icon: Icon, done, children }: { n: number; title: string; icon?: typeof Bot; done?: boolean; children: ReactNode }) {
  return (
    <GlassCard className="p-4 sm:p-5">
      <div className="mb-4 flex items-center gap-3">
        <span className={cn("grid size-8 shrink-0 place-items-center rounded-full text-sm font-semibold", done ? "bg-gain text-background" : "bg-neon/15 text-neon")}>{done ? <Check className="size-4" /> : n}</span>
        <h2 className="flex items-center gap-2 text-sm font-semibold sm:text-base">
          {Icon && <Icon className="size-4 text-muted-foreground" />}
          {title}
        </h2>
      </div>
      <div className="space-y-4">{children}</div>
    </GlassCard>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      {children}
    </div>
  )
}

function Chips<K extends string>({ options, value, onChange }: { options: Record<K, string>; value: K; onChange: (v: K) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {(Object.entries(options) as Array<[K, string]>).map(([k, label]) => (
        <button
          key={k}
          type="button"
          aria-pressed={value === k}
          onClick={() => onChange(k)}
          className={cn("rounded-xl px-3 py-1.5 text-xs font-medium ring-1 ring-inset transition-colors", value === k ? "bg-neon/10 text-neon ring-neon/50" : "text-muted-foreground ring-border hover:text-foreground")}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

function MultiChips({ options, value, onChange }: { options: string[]; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const on = value.includes(o)
        return (
          <button
            key={o}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((x) => x !== o) : [...value, o])}
            className={cn("rounded-xl px-3 py-1.5 text-xs font-medium ring-1 ring-inset transition-colors", on ? "bg-neon/10 text-neon ring-neon/50" : "text-muted-foreground ring-border hover:text-foreground")}
          >
            {o}
          </button>
        )
      })}
    </div>
  )
}

function Stepper({ value, min, max, step = 1, unit, onChange }: { value: number; min: number; max: number; step?: number; unit?: string; onChange: (v: number) => void }) {
  return (
    <div className="flex h-10 items-center justify-between rounded-xl ring-1 ring-inset ring-border">
      <button type="button" aria-label="Meno" disabled={value <= min} onClick={() => onChange(Math.max(min, value - step))} className="grid h-full w-10 place-items-center text-lg text-muted-foreground disabled:opacity-30">
        −
      </button>
      <span className="text-sm font-semibold tabular">
        {value}
        {unit && <span className="ml-0.5 text-xs font-normal text-muted-foreground">{unit}</span>}
      </span>
      <button type="button" aria-label="Più" disabled={value >= max} onClick={() => onChange(Math.min(max, value + step))} className="grid h-full w-10 place-items-center text-lg text-muted-foreground disabled:opacity-30">
        +
      </button>
    </div>
  )
}

function Toggle({ on, onChange, label, hint }: { on: boolean; onChange: (v: boolean) => void; label: string; hint: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={cn("flex items-center justify-between gap-3 rounded-xl p-3 text-left ring-1 ring-inset", on ? "bg-neon/[0.06] ring-neon/30" : "ring-border")}
    >
      <span>
        <span className="block text-xs font-medium">{label}</span>
        <span className="block text-[11px] text-muted-foreground">{hint}</span>
      </span>
      <span className={cn("relative h-5 w-9 shrink-0 rounded-full transition-colors", on ? "bg-neon" : "bg-muted")}>
        <span className={cn("absolute top-0.5 size-4 rounded-full bg-background transition-transform", on ? "translate-x-[18px]" : "translate-x-0.5")} />
      </span>
    </button>
  )
}
