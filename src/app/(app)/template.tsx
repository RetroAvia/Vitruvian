/**
 * Transizione tra pagine in puro CSS: se l'animazione non parte
 * (scheda in background, risparmio energetico) il contenuto resta visibile.
 */
export default function AppTemplate({ children }: { children: React.ReactNode }) {
  return <div className="animate-page-in">{children}</div>
}
