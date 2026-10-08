"use client"

import { useEffect, useState, type ReactNode } from "react"

import { Skeleton } from "@/components/ui/skeleton"

import { OutboxSync } from "@/features/training/session/outbox-sync"
import { WorkoutHost } from "@/features/training/session/workout-host"
import { cn } from "@/lib/utils"
import { useUiStore } from "@/stores/ui-store"
import type { SessionUser } from "@/types/domain"

import { CommandPalette } from "./command-palette"
import { IdleLogout } from "./idle-logout"
import { MobileNav } from "./mobile-nav"
import { NetworkStatus } from "./network-status"
import { Onboarding } from "./onboarding"
import { QueryPersistence, useCacheOwner } from "./query-persistence"
import { Sidebar } from "./sidebar"
import { Topbar } from "./topbar"
import { SessionUserProvider } from "./session-user-context"

export function AppShell({ user, children }: { user: SessionUser; children: ReactNode }) {
  useCacheOwner(user.id)
  // Le pagine dipendono da dati del browser (cache locale, bozze, preferenze): si
  // disegnano dopo l'idratazione, così server e client partono identici (niente
  // errori di idratazione) e la copia locale è già pronta al primo frame.
  const [ready, setReady] = useState(false)
  useEffect(() => setReady(true), [])
  const collapsed = useUiStore((s) => s.sidebarCollapsed)

  return (
    <SessionUserProvider user={user}>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
      >
        Vai al contenuto
      </a>

      <Sidebar />

      <div
        className={cn(
          "flex min-h-dvh flex-col transition-[padding] duration-300 ease-out",
          collapsed ? "lg:pl-[84px]" : "lg:pl-[272px]",
          "print:pl-0",
        )}
      >
        <Topbar />
        <main
          id="main"
          className="mx-auto w-full max-w-[1400px] flex-1 px-4 pb-[calc(6.5rem+env(safe-area-inset-bottom))] pt-8 sm:px-6 lg:px-10 lg:pb-14"
        >
          {ready ? children : <PageFallback />}
        </main>
      </div>

      <MobileNav />
      <CommandPalette />
      <IdleLogout />
      <QueryPersistence userId={user.id} />
      <WorkoutHost userId={user.id} />
      <OutboxSync userId={user.id} />
      <NetworkStatus />
      <Onboarding />
    </SessionUserProvider>
  )
}

function PageFallback() {
  return (
    <div aria-busy="true" aria-label="Caricamento">
      <Skeleton className="mb-2 h-4 w-24 rounded-full" />
      <Skeleton className="mb-8 h-8 w-64 rounded-lg" />
      <Skeleton className="h-64 rounded-2xl" />
    </div>
  )
}
