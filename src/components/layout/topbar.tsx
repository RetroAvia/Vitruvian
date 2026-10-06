"use client"

import { ChevronRight, Plus, Search, Sparkles } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import { LogoMark } from "@/components/brand/logo"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { findNavItem } from "@/config/nav"
import { formatDate, todayISO } from "@/lib/format"

import { openCommandPalette } from "./command-palette"
import { ThemeToggle } from "./theme-toggle"
import { UserMenu } from "./user-menu"

export function Topbar() {
  const pathname = usePathname()
  const current = findNavItem(pathname)
  const Icon = current?.icon

  return (
    <header className="no-print sticky top-0 z-30 px-3 pt-3 sm:px-4 lg:px-5">
      <div className="glass-strong flex h-14 items-center gap-2 rounded-2xl border px-3 shadow-[var(--shadow-card)] sm:gap-3 sm:px-4">
        <Link href="/dashboard" className="lg:hidden" aria-label="Dashboard">
          <LogoMark className="size-8" />
        </Link>

        {/* Breadcrumb */}
        <nav aria-label="Percorso" className="flex min-w-0 flex-1 items-center gap-1.5 text-sm">
          <span className="hidden text-muted-foreground sm:inline">Vitruvian</span>
          <ChevronRight className="hidden size-3.5 text-muted-foreground/60 sm:block" aria-hidden />
          <span className="flex min-w-0 items-center gap-1.5 font-medium">
            {Icon && <Icon className="size-4 shrink-0 text-neon" aria-hidden />}
            <span className="truncate">{current?.label ?? "Vitruvian"}</span>
          </span>
          <span className="ml-3 hidden text-xs capitalize text-muted-foreground xl:inline" suppressHydrationWarning>
            {new Intl.DateTimeFormat("it-IT", { weekday: "long" }).format(new Date())} {formatDate(todayISO(), "long")}
          </span>
        </nav>

        <Button
          variant="ghost"
          size="sm"
          className="rounded-xl text-muted-foreground"
          onClick={openCommandPalette}
          aria-label="Cerca sezioni e azioni (Ctrl+K)"
        >
          <Search className="size-4" />
          <kbd className="hidden rounded-md border px-1.5 py-0.5 font-sans text-[10px] lg:inline">Ctrl K</kbd>
        </Button>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button asChild variant="ghost" size="sm" className="rounded-xl">
              <Link href="/bridge" aria-label="Importa con AI">
                <Sparkles className="size-4 text-neon" />
                <span className="hidden md:inline">Importa con AI</span>
              </Link>
            </Button>
          </TooltipTrigger>
          <TooltipContent className="md:hidden">Importa con AI</TooltipContent>
        </Tooltip>

        <Button asChild size="sm" className="rounded-xl shadow-[0_6px_20px_-8px_var(--neon)]">
          <Link href="/checkups?new=1" aria-label="Nuova visita">
            <Plus className="size-4" />
            <span className="hidden sm:inline">Nuova visita</span>
          </Link>
        </Button>

        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  )
}
