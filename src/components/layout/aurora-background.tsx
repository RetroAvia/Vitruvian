/**
 * Sfondo ambientale: aloni di luce a gradiente radiale + griglia tecnica.
 * Niente filtri blur (costosi sulla GPU del telefono); l'animazione lenta
 * è attiva solo su schermi grandi con mouse e se non si chiede di ridurre il movimento.
 */
export function AuroraBackground() {
  return (
    <div aria-hidden className="no-print pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-background">
      <div className="aurora-blob absolute -left-[20%] -top-[25%] h-[70vmax] w-[70vmax] rounded-full [background:radial-gradient(closest-side,color-mix(in_oklab,var(--neon)_14%,transparent),transparent)]" />
      <div className="aurora-blob absolute -right-[25%] top-[5%] h-[65vmax] w-[65vmax] rounded-full [animation-delay:-7s] [background:radial-gradient(closest-side,color-mix(in_oklab,var(--bia)_15%,transparent),transparent)]" />
      <div className="aurora-blob absolute -bottom-[35%] left-[20%] h-[60vmax] w-[60vmax] rounded-full [animation-delay:-14s] [background:radial-gradient(closest-side,color-mix(in_oklab,var(--gain)_9%,transparent),transparent)]" />
      <div className="absolute inset-0 bg-grid opacity-60 [mask-image:radial-gradient(ellipse_at_top,black_20%,transparent_70%)]" />
    </div>
  )
}
