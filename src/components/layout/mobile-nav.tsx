"use client"

import * as DialogPrimitive from "@radix-ui/react-dialog"
import { LayoutGrid, X } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"

import { isActivePath, MOBILE_NAV, NAV_GROUPS, SETTINGS_ITEM } from "@/config/nav"
import { playSound } from "@/lib/sound"
import { cn } from "@/lib/utils"

/** Tab bar inferiore per smartphone (sotto il breakpoint lg) + foglio "Altro" con tutte le sezioni. */
export function MobileNav() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const inMore = !MOBILE_NAV.some((i) => isActivePath(pathname, i.href))

  const tab = "relative flex h-16 flex-col items-center justify-center gap-1 rounded-2xl text-[11px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring"
  const pill = "absolute inset-x-2 inset-y-1.5 rounded-xl bg-neon/10 ring-1 ring-inset ring-neon/25 transition-all duration-300 ease-out"

  return (
    <>
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
                <Link href={item.href} aria-current={active ? "page" : undefined} className={cn(tab, active ? "text-neon" : "text-muted-foreground")}>
                  <span aria-hidden className={cn(pill, active ? "scale-100 opacity-100" : "scale-90 opacity-0")} />
                  <Icon className="relative size-5" strokeWidth={active ? 2.25 : 1.75} />
                  <span className="relative">{item.short}</span>
                </Link>
              </li>
            )
          })}
          <li>
            <button
              type="button"
              onClick={() => {
                setOpen(true)
                playSound("tap")
              }}
              aria-haspopup="dialog"
              className={cn(tab, "w-full", inMore ? "text-neon" : "text-muted-foreground")}
            >
              <span aria-hidden className={cn(pill, inMore ? "scale-100 opacity-100" : "scale-90 opacity-0")} />
              <LayoutGrid className="relative size-5" strokeWidth={inMore ? 2.25 : 1.75} />
              <span className="relative">Altro</span>
            </button>
          </li>
        </ul>
      </nav>

      <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 lg:hidden" />
          <DialogPrimitive.Content
            className="animate-sheet-up glass-strong fixed inset-x-0 bottom-0 z-50 max-h-[85dvh] overflow-y-auto rounded-t-3xl border-t px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-3 shadow-2xl outline-none lg:hidden"
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-muted-foreground/30" aria-hidden />
            <div className="mb-2 flex items-center justify-between">
              <DialogPrimitive.Title className="text-base font-semibold">Tutte le sezioni</DialogPrimitive.Title>
              <DialogPrimitive.Close className="rounded-lg p-2 text-muted-foreground outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring">
                <X className="size-4" />
                <span className="sr-only">Chiudi</span>
              </DialogPrimitive.Close>
            </div>
            <DialogPrimitive.Description className="sr-only">Navigazione completa dell&apos;app</DialogPrimitive.Description>
            <div className="space-y-4">
              {[...NAV_GROUPS, { label: "Account", items: [SETTINGS_ITEM] }].map((g) => (
                <div key={g.label}>
                  <p className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground/80">{g.label}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {g.items.map((item) => {
                      const active = isActivePath(pathname, item.href)
                      const Icon = item.icon
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setOpen(false)}
                          aria-current={active ? "page" : undefined}
                          className={cn(
                            "flex items-center gap-3 rounded-xl border p-3 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                            active ? "border-neon/40 bg-neon/10" : "surface-inset",
                          )}
                        >
                          <Icon className={cn("size-5 shrink-0", active ? "text-neon" : "text-muted-foreground")} />
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium">{item.label}</span>
                            <span className="block truncate text-[11px] text-muted-foreground">{item.description}</span>
                          </span>
                        </Link>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  )
}
