"use client"

import { FlaskConical, HeartPulse, Pill, Salad, ScanLine, Sparkles } from "lucide-react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

import { PageHeader } from "@/components/shared/page-header"
import { cn } from "@/lib/utils"

import { CheckupBridge } from "./checkup-bridge"
import { DietBridge } from "./diet-bridge"
import { LabBridge } from "./lab-bridge"
import { MedicalBridge } from "./medical-bridge"
import { SupplementBridge } from "./supplement-bridge"

type Tab = "checkups" | "labs" | "medical" | "supplements" | "diet"
const TAB_IDS: Tab[] = ["checkups", "labs", "medical", "supplements", "diet"]

const TABS: Array<{ id: Tab; label: string; icon: typeof ScanLine; badge?: string }> = [
  { id: "checkups", label: "Visita (BIA e misure)", icon: ScanLine },
  { id: "labs", label: "Analisi del sangue", icon: FlaskConical },
  { id: "medical", label: "Referti (ECG, visite…)", icon: HeartPulse },
  { id: "supplements", label: "Integratori", icon: Pill },
  { id: "diet", label: "Dieta", icon: Salad },
]

export function BridgeView() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const raw = params.get("tab")
  const tab: Tab = TAB_IDS.includes(raw as Tab) ? (raw as Tab) : "checkups"

  function select(t: Tab) {
    router.replace(`${pathname}?tab=${t}`, { scroll: false })
  }

  return (
    <>
      <PageHeader
        icon={Sparkles}
        title="AI Bridge"
        description="Niente più inserimenti a mano: un'IA esterna (Gemini, ChatGPT, Claude) legge il referto, l'app controlla i dati e li salva solo dopo la tua conferma."
      />

      <div role="tablist" aria-label="Tipo di importazione" className="-mx-1 mb-6 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
        {TABS.map((t) => {
          const Icon = t.icon
          const active = tab === t.id
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => select(t.id)}
              className={cn(
                "inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border px-4 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active ? "border-neon/40 bg-neon/10 text-neon" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-4" />
              {t.label}
              {t.badge && (
                <span className="rounded-full bg-bia/10 px-1.5 py-0.5 text-[10px] text-bia">{t.badge}</span>
              )}
            </button>
          )
        })}
      </div>

      <div role="tabpanel">
        {tab === "checkups" && <CheckupBridge />}
        {tab === "labs" && <LabBridge />}
        {tab === "medical" && <MedicalBridge />}
        {tab === "supplements" && <SupplementBridge />}
        {tab === "diet" && <DietBridge />}
      </div>
    </>
  )
}
