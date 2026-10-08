import { cn } from "@/lib/utils"

/** Emoji decorativa a larghezza fissa (allinea le liste), ignorata dagli screen reader. */
export function Emoji({ e, className }: { e: string; className?: string }) {
  return (
    <span aria-hidden className={cn("mr-1.5 inline-block w-[1.35em] shrink-0 text-center leading-none", className)}>
      {e}
    </span>
  )
}
