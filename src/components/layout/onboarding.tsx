"use client"

import { LoaderCircle, Sparkles } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { parseDecimal } from "@/features/checkups/schemas/checkup-form"
import { useProfile, useUpdateProfile } from "@/features/profile/api/profile"
import { isNum, todayISO } from "@/lib/format"
import { playSound } from "@/lib/sound"
import { cn } from "@/lib/utils"
import type { Sex } from "@/types/domain"

import { useSessionUser } from "./session-user-context"

const SKIP_KEY = "vitruvian-onboarding-skip"

/**
 * Primo accesso di un nuovo account: sesso, data di nascita e altezza servono a
 * tutti i calcoli (BMR, FFMI, valori di riferimento di BIA e analisi, figura
 * della mappa corporea). Compare solo se mancano e si può rimandare.
 */
export function Onboarding() {
  const user = useSessionUser()
  const router = useRouter()
  const profileQ = useProfile()
  const update = useUpdateProfile()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [sex, setSex] = useState<Sex | "">("")
  const [birth, setBirth] = useState("")
  const [height, setHeight] = useState("")

  const p = profileQ.data
  useEffect(() => {
    if (!profileQ.isSuccess) return
    const incomplete = !p?.sex || !p?.birth_date || !isNum(p?.height_cm)
    let skipped = false
    try {
      skipped = sessionStorage.getItem(SKIP_KEY) === user.id
    } catch {
      /* ignore */
    }
    if (incomplete && !skipped) {
      setName(p?.display_name ?? "")
      setSex(p?.sex ?? "")
      setBirth(p?.birth_date ?? "")
      setHeight(isNum(p?.height_cm) ? String(p?.height_cm).replace(".", ",") : "")
      setOpen(true)
    }
  }, [profileQ.isSuccess, p, user.id])

  const h = parseDecimal(height)
  const valid = sex !== "" && /^\d{4}-\d{2}-\d{2}$/.test(birth) && birth >= "1900-01-01" && birth <= todayISO() && isNum(h) && h >= 100 && h <= 250

  function later() {
    try {
      sessionStorage.setItem(SKIP_KEY, user.id)
    } catch {
      /* ignore */
    }
    setOpen(false)
  }

  async function save() {
    if (!valid || !sex) return
    try {
      await update.mutateAsync({ display_name: name.trim() || null, sex, birth_date: birth, height_cm: h as number })
      playSound("success")
      toast.success("Profilo pronto", { description: "Ora i calcoli usano i tuoi dati." })
      setOpen(false)
      router.refresh()
    } catch (e) {
      playSound("error")
      toast.error("Salvataggio non riuscito", { description: e instanceof Error ? e.message : undefined })
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : later())}>
      <DialogContent className="max-w-md rounded-3xl">
        <DialogHeader>
          <span className="mb-1 grid size-11 place-items-center rounded-2xl bg-neon/15 text-neon">
            <Sparkles className="size-5" />
          </span>
          <DialogTitle>Ciao! Configuriamo Vitruvian</DialogTitle>
          <DialogDescription>Tre dati e si parte: servono a calcolare metabolismo, indici e valori di riferimento corretti per te.</DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            void save()
          }}
        >
          <label className="block space-y-1.5 text-sm">
            <span className="text-xs font-medium text-muted-foreground">Come ti chiami? (facoltativo)</span>
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoComplete="given-name" className="h-11 rounded-xl" />
          </label>

          <div className="space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Sesso biologico</span>
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Sesso biologico">
              {(
                [
                  ["female", "Donna"],
                  ["male", "Uomo"],
                ] as const
              ).map(([v, label]) => (
                <button
                  key={v}
                  type="button"
                  role="radio"
                  aria-checked={sex === v}
                  onClick={() => setSex(v)}
                  className={cn("h-11 rounded-xl text-sm font-medium ring-1 ring-inset transition-colors", sex === v ? "bg-neon/10 text-neon ring-neon/50" : "text-muted-foreground ring-border hover:text-foreground")}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">Usato solo per formule e valori di riferimento (BIA, analisi del sangue, metabolismo).</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Data di nascita</span>
              <Input type="date" value={birth} max={todayISO()} onChange={(e) => setBirth(e.target.value)} className="h-11 rounded-xl" />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Altezza (cm)</span>
              <Input inputMode="decimal" value={height} onChange={(e) => setHeight(e.target.value)} placeholder="es. 168" className="h-11 rounded-xl tabular" />
            </label>
          </div>

          <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" className="rounded-xl" onClick={later}>
              Più tardi
            </Button>
            <Button type="submit" className="rounded-xl" disabled={!valid || update.isPending}>
              {update.isPending && <LoaderCircle className="size-4 animate-spin" />}
              Inizia
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
