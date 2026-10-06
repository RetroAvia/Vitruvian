"use client"

import type { ReactNode } from "react"

import { cn } from "@/lib/utils"
import { useUiStore } from "@/stores/ui-store"
import type { SessionUser } from "@/types/domain"

import { CommandPalette } from "./command-palette"
import { IdleLogout } from "./idle-logout"
import { MobileNav } from "./mobile-nav"
import { QueryPersistence } from "./query-persistence"
import { Sidebar } from "./sidebar"
import { Topbar } from "./topbar"
import { SessionUserProvider } from "./session-user-context"

export function AppShell({ user, children }: { user: SessionUser; children: ReactNode }) {
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
          {children}
        </main>
      </div>

      <MobileNav />
      <CommandPalette />
      <IdleLogout />
      <QueryPersistence userId={user.id} />
    </SessionUserProvider>
  )
}
