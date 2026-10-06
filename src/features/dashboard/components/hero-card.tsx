"use client"

import { ArrowDownRight, ArrowUpRight, CalendarDays, Minus, PencilLine, Target } from "lucide-react"
import Link from "next/link"

import { GlassCard } from "@/components/shared/glass-card"
import { InfoTip } from "@/components/shared/info-tip"
import type { GlossaryKey } from "@/config/glossary"
import { computeGoals, goalsUnavailable, hasGoals } from "@/features/biometrics/engine/goals"
import type { BiometricReport } from "@/features/biometrics/engine/report"
import { buildSummary } from "@/features/biometrics/engine/summary"
import { formatDate, formatNumber, formatSigned, isNum } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { Profile, SessionUser } from "@/types/domain"

const TONE = {
  good: "from-gain/20 text-gain",
  neutral: "from-neon/20 text-neon",
  warn: "from-warn/20 text-warn",
} as const

function firstName(user: SessionUser) {
  const local = user.email.split("@")[0] ?? ""
  const name = user.displayName.trim()
  const looksAuto = !name || name === local || /\d/.test(name)
  return { name: looksAuto ? null : (name.split(/\s+/)[0] ?? name), looksAuto }
}

function Stat({
  label,
  value,
  unit,
  digits,
  delta,
  good,
  info,
}: {
  label: string
  value: number | null
  unit: string
  digits: number
  delta: number | null
  good: "up" | "down" | null
  info: GlossaryKey
}) {
  const flat = delta === null || Math.abs(delta) < 0.05
  const positive = !flat && ((good === "up" && (delta as number) > 0) || (good === "down" && (delta as number) < 0))
  const Icon = flat ? Minus : (delta as number) > 0 ? ArrowUpRight : ArrowDownRight
  return (
    <div className="surface-inset rounded-xl p-4">
      <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
        {label} <InfoTip term={info} />
      </p>
      <p className="mt-2 font-display text-3xl font-semibold tabular">
        {formatNumber(value, digits)}
        <span className="ml-1 text-sm font-medium text-muted-foreground">{unit}</span>
      </p>
      <p
        className={cn(
          "mt-1 inline-flex items-center gap-0.5 text-xs tabular",
          flat || good === null ? "text-muted-foreground" : positive ? "text-gain" : "text-warn",
        )}
      >
        <Icon className="size-3.5" />
        {delta === null ? "nessun confronto" : `${formatSigned(delta, digits)} ${unit} vs precedente`}
      </p>
    </div>
  )
}

export function HeroCard({ report, profile, user }: { report: BiometricReport; profile: Profile | null; user: SessionUser }) {
  const latest = report.latest
  const bia = report.latestBia
  if (!latest) return null

  const summary = buildSummary(report, profile)
  const { name, looksAuto } = firstName(user)
  const prevSame = (() => {
    if (!bia) return null
    const seg = report.segments.find((s) => s.checkups.some((c) => c.id === bia.id))
    const list = seg?.checkups.filter((c) => isNum(c.fat_mass_pct)) ?? []
    return list.length > 1 ? list[list.length - 2] : null
  })()
  const prevWeight = [...report.chronological].reverse().find((c) => c.id !== latest.id && isNum(c.weight_kg) && c.checkup_date < latest.checkup_date)
  const goals = computeGoals(profile, report.chronological)

  return (
    <GlassCard raised className="relative overflow-hidden">
      <div aria-hidden className={cn("pointer-events-none absolute inset-0 bg-gradient-to-br via-transparent to-transparent opacity-60", TONE[summary.tone].split(" ")[0])} />
      <div className="relative grid gap-6 p-5 sm:p-7 xl:grid-cols-[1.1fr_1.4fr]">
        {/* Sintesi */}
        <div className="flex flex-col">
          <p className="text-sm text-muted-foreground">
            Ciao{name ? `, ${name}` : ""}
            {looksAuto && (
              <Link href="/settings" className="ml-2 inline-flex items-center gap-1 text-xs text-neon underline-offset-2 hover:underline">
                <PencilLine className="size-3" /> imposta il tuo nome
              </Link>
            )}
          </p>
          <h2 className={cn("mt-2 font-display text-2xl font-semibold leading-snug sm:text-[26px]", TONE[summary.tone].split(" ")[1])}>
            {summary.headline}
          </h2>
          <ul className="mt-3 space-y-1.5 text-sm leading-relaxed text-foreground/85">
            {summary.sentences.map((s) => (
              <li key={s} className="flex gap-2">
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-current opacity-50" aria-hidden />
                {s}
              </li>
            ))}
          </ul>
          <div className="mt-auto flex flex-wrap items-center gap-2 pt-5 text-xs text-muted-foreground">
            <span className="surface-inset inline-flex items-center gap-1.5 rounded-full px-2.5 py-1">
              <CalendarDays className="size-3.5" />
              Ultima visita {formatDate(latest.checkup_date, "medium")}
              {report.daysSinceLatest !== null && ` · ${report.daysSinceLatest} giorni fa`}
            </span>
            {latest.protocol_name && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-bia/10 px-2.5 py-1 text-bia ring-1 ring-inset ring-bia/25">
                {latest.protocol_name}
                <InfoTip term="protocol" className="text-bia/70" />
              </span>
            )}
          </div>
        </div>

        {/* Numeri chiave + obiettivi */}
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat
              label="Peso"
              value={latest.weight_kg}
              unit="kg"
              digits={1}
              delta={isNum(latest.weight_kg) && prevWeight && isNum(prevWeight.weight_kg) ? latest.weight_kg - prevWeight.weight_kg : null}
              good={null}
              info="bmi"
            />
            <Stat
              label="Massa grassa"
              value={bia?.fat_mass_pct ?? null}
              unit="%"
              digits={1}
              delta={bia && prevSame && isNum(bia.fat_mass_pct) && isNum(prevSame.fat_mass_pct) ? bia.fat_mass_pct - prevSame.fat_mass_pct : null}
              good="down"
              info="fat_pct"
            />
            <Stat
              label="Massa magra"
              value={bia?.ffm_kg ?? null}
              unit="kg"
              digits={1}
              delta={bia && prevSame && isNum(bia.ffm_kg) && isNum(prevSame.ffm_kg) ? bia.ffm_kg - prevSame.ffm_kg : null}
              good="up"
              info="ffm"
            />
          </div>

          {goalsUnavailable(profile) ? null : hasGoals(profile) ? (
            <div className="surface-inset rounded-xl p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  <Target className="size-3.5 text-neon" /> Obiettivi
                  {profile?.target_date && <span className="font-normal normal-case tracking-normal">· entro il {formatDate(profile.target_date, "medium")}</span>}
                </p>
                <Link href="/settings#obiettivi" className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
                  Modifica
                </Link>
              </div>
              <ul className="grid gap-3 sm:grid-cols-2">
                {goals.map((g) => (
                  <li key={g.key}>
                    <div className="flex items-baseline justify-between gap-2 text-xs">
                      <span className="font-medium">{g.label}</span>
                      <span className="tabular text-muted-foreground">
                        {formatNumber(g.current, g.digits)} → {formatNumber(g.target, g.digits)} {g.unit}
                      </span>
                    </div>
                    <div
                      className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted"
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={Math.round((g.progress ?? 0) * 100)}
                      aria-label={`Avanzamento ${g.label}`}
                    >
                      <div
                        className={cn("h-full rounded-full transition-[width] duration-700", g.achieved ? "bg-gain" : "bg-neon")}
                        style={{ width: `${Math.max(3, (g.progress ?? 0) * 100)}%` }}
                      />
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {g.achieved
                        ? "Obiettivo raggiunto ✓"
                        : g.remaining !== null
                          ? `Mancano ${formatSigned(g.remaining, g.digits)} ${g.unit} · ${formatNumber((g.progress ?? 0) * 100, 0)}% del percorso`
                          : "In attesa di una misura"}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <Link
              href="/settings#obiettivi"
              className="surface-inset flex items-center gap-3 rounded-xl p-4 text-sm transition-colors hover:bg-accent/40"
            >
              <span className="grid size-9 place-items-center rounded-lg bg-neon/10 text-neon ring-1 ring-inset ring-neon/25">
                <Target className="size-4" />
              </span>
              <span>
                <span className="font-medium">Imposta i tuoi obiettivi</span>
                <span className="block text-xs text-muted-foreground">Peso, massa grassa, vita: vedrai qui l&apos;avanzamento.</span>
              </span>
            </Link>
          )}
        </div>
      </div>
    </GlassCard>
  )
}
