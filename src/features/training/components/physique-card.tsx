"use client"

import { ArrowUpRight, Crosshair, Ruler, Sparkles, Trophy } from "lucide-react"

import { GlassCard } from "@/components/shared/glass-card"
import { formatDate, formatNumber, formatSigned } from "@/lib/format"
import { cn } from "@/lib/utils"

import type { PhysiqueAnalysis } from "../engine/physique"

/** Punti forti, carenze con esercizi di focus, proporzioni e asimmetrie dalle misure. */
export function FocusCard({ physique }: { physique: PhysiqueAnalysis }) {
  return (
    <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
      <GlassCard raised className="p-5">
        <div className="mb-4 flex items-center gap-2">
          <Crosshair className="size-4 text-warn" />
          <h3 className="text-sm font-semibold">Da potenziare</h3>
          <span className="text-xs text-muted-foreground">· misure + volume di allenamento</span>
        </div>
        {physique.weaknesses.length === 0 ? (
          <p className="surface-inset rounded-xl p-4 text-sm text-muted-foreground">
            Nessuna carenza evidente. Aggiungi spalle, collo, avambraccio e polpaccio nelle visite per un confronto più completo.
          </p>
        ) : (
          <div className="stagger space-y-3">
            {physique.weaknesses.map((w, i) => (
              <div key={w.muscle} className="surface-inset rounded-xl p-3.5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm font-semibold">
                    <span className="mr-2 text-xs font-normal text-muted-foreground tabular">{i + 1}.</span>
                    {w.label}
                  </p>
                  <span className="text-xs tabular text-muted-foreground">
                    {w.weeklySets !== null ? `${formatNumber(w.weeklySets, w.weeklySets % 1 ? 1 : 0)} → ` : ""}
                    <span className="font-semibold text-foreground">{w.targetSets} serie/settimana</span>
                  </span>
                </div>
                <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                  {w.reasons.map((r) => (
                    <li key={r}>• {r}</li>
                  ))}
                </ul>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {w.exercises.map((e) => (
                    <span
                      key={e.code}
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[11px] ring-1 ring-inset",
                        e.inPlan ? "bg-neon/10 text-neon ring-neon/25" : "bg-accent/60 text-foreground/80 ring-border",
                      )}
                    >
                      {e.name}
                      {e.inPlan ? " · già in scheda, +serie" : ""}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </GlassCard>

      <GlassCard className="p-5">
        <div className="mb-4 flex items-center gap-2">
          <Trophy className="size-4 text-gain" />
          <h3 className="text-sm font-semibold">Punti forti</h3>
        </div>
        {physique.strengths.length === 0 ? (
          <p className="surface-inset rounded-xl p-4 text-sm text-muted-foreground">Servono qualche misura e qualche sessione in più per individuarli.</p>
        ) : (
          <ul className="stagger space-y-2">
            {physique.strengths.slice(0, 7).map((s) => (
              <li key={s.key} className="flex gap-3 rounded-xl bg-gain/[0.06] p-3 ring-1 ring-inset ring-gain/15">
                <Sparkles className="mt-0.5 size-4 shrink-0 text-gain" />
                <div className="min-w-0">
                  <p className="text-sm font-medium">{s.title}</p>
                  <p className="text-xs text-muted-foreground">{s.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </GlassCard>
    </div>
  )
}

export function ProportionsCard({ physique }: { physique: PhysiqueAnalysis }) {
  const { proportions, asymmetries, growth } = physique
  if (proportions.length === 0 && asymmetries.length === 0 && growth.length === 0) {
    return (
      <GlassCard className="p-5">
        <h3 className="text-sm font-semibold">Proporzioni</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Inserisci nelle visite le circonferenze di spalle, torace, vita, braccio, avambraccio, coscia, polpaccio e collo (braccio, coscia e polpaccio anche sinistro/destro).
        </p>
      </GlassCard>
    )
  }
  return (
    <GlassCard className="p-5">
      <div className="mb-4 flex items-center gap-2">
        <Ruler className="size-4 text-neon" />
        <h3 className="text-sm font-semibold">Proporzioni e circonferenze</h3>
        {physique.sitesDate && <span className="text-xs text-muted-foreground">· misure al {formatDate(physique.sitesDate, "medium")}</span>}
      </div>

      {proportions.length > 0 && (
        <div className="space-y-3">
          {proportions.map((p) => {
            const lo = p.ideal[0] * 0.85
            const hi = p.ideal[1] * 1.15
            const pos = (v: number) => `${Math.max(0, Math.min(1, (v - lo) / (hi - lo))) * 100}%`
            return (
              <div key={p.key}>
                <div className="mb-1 flex items-baseline justify-between text-xs">
                  <span className="font-medium">{p.label}</span>
                  <span className={cn("tabular", p.status === "ok" ? "text-gain" : "text-warn")}>{formatNumber(p.value, 2)}</span>
                </div>
                <div className="relative h-2 rounded-full bg-muted/60" title={p.hint}>
                  <div className="absolute inset-y-0 rounded-full bg-gain/20" style={{ left: pos(p.ideal[0]), width: `calc(${pos(p.ideal[1])} - ${pos(p.ideal[0])})` }} />
                  <div className={cn("absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-background", p.status === "ok" ? "bg-gain" : "bg-warn")} style={{ left: pos(p.value) }} />
                </div>
              </div>
            )
          })}
          <p className="text-[11px] text-muted-foreground">Fascia verde = proporzioni classiche di riferimento (indicative).</p>
        </div>
      )}

      {asymmetries.length > 0 && (
        <div className="mt-5">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Sinistra / destra</p>
          <div className="grid grid-cols-2 gap-2">
            {asymmetries.map((a) => (
              <div key={a.site} className={cn("rounded-xl p-2.5 text-xs ring-1 ring-inset", a.relevant ? "bg-warn/[0.07] ring-warn/25" : "surface-inset")}>
                <p className="font-medium">{a.label}</p>
                <p className="tabular text-muted-foreground">
                  {formatNumber(a.left, 1)} / {formatNumber(a.right, 1)} cm
                </p>
                <p className={cn("tabular", a.relevant ? "text-warn" : "text-muted-foreground")}>
                  {a.diff < 0.3 ? "simmetrico" : `${a.weaker} −${formatNumber(a.diff, 1)} cm`}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {growth.length > 0 && (
        <div className="mt-5">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Variazione negli ultimi mesi</p>
          <ul className="space-y-1 text-xs">
            {growth.map((g) => (
              <li key={g.site} className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">{g.label}</span>
                <span className="tabular">
                  {formatNumber(g.from, 1)} → {formatNumber(g.to, 1)} cm
                  <span className={cn("ml-2 inline-flex items-center", g.site === "waist" ? (g.delta > 0.5 ? "text-warn" : "text-gain") : g.delta > 0.2 ? "text-gain" : "text-muted-foreground")}>
                    {g.delta > 0.2 && <ArrowUpRight className="size-3" />}
                    {formatSigned(g.delta, 1)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </GlassCard>
  )
}
