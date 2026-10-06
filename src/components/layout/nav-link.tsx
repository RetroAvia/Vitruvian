"use client"

import { m } from "motion/react"
import Link from "next/link"

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { NavItem } from "@/config/nav"
import { cn } from "@/lib/utils"

interface NavLinkProps {
  item: NavItem
  active: boolean
  collapsed: boolean
}

export function NavLink({ item, active, collapsed }: NavLinkProps) {
  const Icon = item.icon

  const link = (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium outline-none transition-colors",
        "focus-visible:ring-2 focus-visible:ring-ring",
        active ? "text-foreground" : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
        collapsed && "justify-center px-0",
      )}
    >
      {active && (
        <m.span
          layoutId="sidebar-active"
          className="absolute inset-0 rounded-xl bg-neon/10 ring-1 ring-inset ring-neon/30 shadow-[0_0_24px_-6px_var(--neon)]"
        />
      )}
      {active && (
        <m.span
          layoutId="sidebar-active-bar"
          className="absolute -left-3 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-neon shadow-[0_0_12px_var(--neon)]"
        />
      )}
      <Icon
        className={cn(
          "relative size-[18px] shrink-0 transition-colors",
          active ? "text-neon" : "text-muted-foreground group-hover:text-foreground",
        )}
        strokeWidth={active ? 2.25 : 1.75}
      />
      {!collapsed && <span className="relative truncate">{item.label}</span>}
    </Link>
  )

  if (!collapsed) return link

  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right" sideOffset={12}>
        {item.label}
      </TooltipContent>
    </Tooltip>
  )
}
