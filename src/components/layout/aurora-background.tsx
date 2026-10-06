/**
 * Sfondo ambientale: macchie di luce sfocate + griglia tecnica.
 * Solo CSS (transform/opacity) → zero costo JS, rispetta prefers-reduced-motion.
 */
export function AuroraBackground() {
  return (
    <div aria-hidden className="no-print pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-background" />
      <div className="absolute -left-[15%] -top-[20%] h-[55vmax] w-[55vmax] rounded-full bg-neon/[0.09] blur-[120px] motion-safe:animate-aurora" />
      <div className="absolute -right-[20%] top-[10%] h-[50vmax] w-[50vmax] rounded-full bg-bia/[0.10] blur-[130px] motion-safe:animate-aurora [animation-delay:-7s]" />
      <div className="absolute -bottom-[30%] left-[25%] h-[45vmax] w-[45vmax] rounded-full bg-gain/[0.06] blur-[140px] motion-safe:animate-aurora [animation-delay:-14s]" />
      <div className="absolute inset-0 bg-grid opacity-60 [mask-image:radial-gradient(ellipse_at_top,black_20%,transparent_70%)]" />
    </div>
  )
}
