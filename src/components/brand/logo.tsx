import { cn } from "@/lib/utils"

/** Glifo geometrico ispirato alle proporzioni vitruviane: cerchio + quadrato + assi. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" aria-hidden className={cn("size-9 shrink-0", className)}>
      <defs>
        <linearGradient id="vt-g" gradientUnits="userSpaceOnUse" x1="6" y1="6" x2="34" y2="34">
          <stop offset="0" stopColor="var(--neon)" />
          <stop offset="1" stopColor="var(--bia)" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="38" height="38" rx="11" className="fill-card" />
      <rect x="9" y="9" width="22" height="22" rx="2" fill="none" stroke="url(#vt-g)" strokeWidth="2" />
      <circle cx="20" cy="20" r="13" fill="none" stroke="url(#vt-g)" strokeWidth="2" opacity="0.75" />
      <path d="M20 7v26M7 20h26" stroke="url(#vt-g)" strokeWidth="1.25" opacity="0.45" />
      <circle cx="20" cy="20" r="2.5" fill="var(--neon)" className="animate-pulse-glow" />
    </svg>
  )
}

export function Logo({ collapsed = false, className }: { collapsed?: boolean; className?: string }) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <LogoMark />
      {!collapsed && (
        <div className="leading-none">
          <p className="font-display text-[15px] font-semibold tracking-[0.18em]">VITRUVIAN</p>
          <p className="mt-1 text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Body Intelligence</p>
        </div>
      )}
    </div>
  )
}
