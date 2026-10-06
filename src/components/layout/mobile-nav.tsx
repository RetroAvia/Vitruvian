"use client"

import { m } from "motion/react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import { isActivePath, MOBILE_NAV } from "@/config/nav"
import { cn } from "@/lib/utils"

/** Tab bar inferiore per smartphone (sotto il breakpoint lg). */
export function MobileNav() {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Navigazione principale"
      className="glass-strong no-print fixed inset-x-3 bottom-3 z-40 rounded-2xl border pb-[env(safe-area-inset-bottom)] shadow-[var(--shadow-raised)] lg:hidden"
    >
      <ul className="grid grid-cols-5">
        {MOBILE_NAV.map((item) => {
          const active = isActivePath(pathname, item.href)
          const Icon = item.icon
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex h-16 flex-col items-center justify-center gap-1 rounded-2xl text-[11px] font-medium outline-none",
                  "focus-visible:ring-2 focus-visible:ring-ring",
                  active ? "text-neon" : "text-muted-foreground",
                )}
              >
                {active && (
                  <m.span
                    layoutId="mobile-active"
                    className="absolute inset-x-2 inset-y-1.5 rounded-xl bg-neon/10 ring-1 ring-inset ring-neon/25"
                  />
                )}
                <Icon className="relative size-5" strokeWidth={active ? 2.25 : 1.75} />
                <span className="relative">{item.short}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
