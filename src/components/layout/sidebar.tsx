"use client"

import { PanelLeftClose, PanelLeftOpen } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import { Logo } from "@/components/brand/logo"
import { isActivePath, NAV_GROUPS, SETTINGS_ITEM } from "@/config/nav"
import { cn } from "@/lib/utils"
import { useUiStore } from "@/stores/ui-store"

import { NavLink } from "./nav-link"
import { useSessionUser } from "./session-user-context"
import { initials } from "./user-menu"

export function Sidebar() {
  const pathname = usePathname()
  const user = useSessionUser()
  const collapsed = useUiStore((s) => s.sidebarCollapsed)
  const toggleSidebar = useUiStore((s) => s.toggleSidebar)

  return (
    <aside
      aria-label="Navigazione principale"
      className={cn(
        "glass-strong fixed inset-y-3 left-3 z-40 hidden flex-col rounded-2xl border shadow-[var(--shadow-card)] lg:flex",
        "transition-[width] duration-300 ease-out",
        collapsed ? "w-[68px]" : "w-[256px]",
      )}
    >
      <Link
        href="/dashboard"
        className={cn("flex h-16 items-center rounded-t-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring", collapsed ? "justify-center" : "px-4")}
        aria-label="Vitruvian, vai alla dashboard"
      >
        <Logo collapsed={collapsed} />
      </Link>

      <div className="mx-3 h-px bg-sidebar-border" />

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="space-y-1">
            {collapsed ? (
              <div className="mx-auto mb-2 h-px w-6 bg-sidebar-border first:hidden" aria-hidden />
            ) : (
              <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground/70">
                {group.label}
              </p>
            )}
            {group.items.map((item) => (
              <NavLink key={item.href} item={item} active={isActivePath(pathname, item.href)} collapsed={collapsed} />
            ))}
          </div>
        ))}
      </nav>

      <div className="space-y-1 border-t border-sidebar-border px-3 py-3">
        <NavLink item={SETTINGS_ITEM} active={isActivePath(pathname, SETTINGS_ITEM.href)} collapsed={collapsed} />
        {!collapsed && (
          <div className="surface-inset mt-2 flex items-center gap-3 rounded-xl p-2.5">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-neon/80 to-bia/80 text-[11px] font-bold text-primary-foreground">
              {initials(user.displayName) || "?"}
            </span>
            <div className="min-w-0">
              <p className="truncate text-xs font-medium">{user.displayName}</p>
              <p className="truncate text-[11px] text-muted-foreground">{user.email}</p>
            </div>
          </div>
        )}
        <button
          type="button"
          onClick={toggleSidebar}
          aria-label={collapsed ? "Espandi barra laterale" : "Comprimi barra laterale"}
          className={cn(
            "flex h-9 w-full items-center gap-3 rounded-xl px-3 text-xs text-muted-foreground transition-colors",
            "outline-none hover:bg-sidebar-accent/60 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
            collapsed && "justify-center px-0",
          )}
        >
          {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
          {!collapsed && <span>Comprimi</span>}
        </button>
      </div>
    </aside>
  )
}
