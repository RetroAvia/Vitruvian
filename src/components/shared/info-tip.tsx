"use client"

import { Info } from "lucide-react"

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { GLOSSARY, type GlossaryKey } from "@/config/glossary"
import { cn } from "@/lib/utils"

/** Icona ⓘ con spiegazione del termine (tastiera e touch compresi). */
export function InfoTip({ term, text, className }: { term?: GlossaryKey; text?: string; className?: string }) {
  const content = text ?? (term ? GLOSSARY[term] : "")
  if (!content) return null
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label="Cosa significa?"
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "inline-grid size-4 shrink-0 place-items-center rounded-full text-muted-foreground/70 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            className,
          )}
        >
          <Info className="size-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-72 text-left leading-relaxed">
        {content}
      </TooltipContent>
    </Tooltip>
  )
}
