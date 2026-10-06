import type { ComponentProps } from "react"

import { cn } from "@/lib/utils"

/** Superficie base dell'interfaccia: vetro sfocato con bordo sottile e ombra. */
export function GlassCard({ className, raised, ...props }: ComponentProps<"div"> & { raised?: boolean }) {
  return <div className={cn(raised ? "glass-raised" : "glass", "rounded-2xl", className)} {...props} />
}

export function GlassCardHeader({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("flex items-start justify-between gap-4 p-5 pb-0", className)} {...props} />
}

export function GlassCardTitle({ className, ...props }: ComponentProps<"h3">) {
  return <h3 className={cn("text-sm font-semibold text-foreground/90", className)} {...props} />
}

export function GlassCardContent({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("p-5", className)} {...props} />
}
