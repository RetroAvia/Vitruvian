/**
 * Estrae il JSON dalla risposta di un'IA esterna, tollerando:
 *  - blocchi ```json … ```
 *  - testo prima/dopo l'oggetto
 *  - virgole finali prima di } o ]
 *  - virgolette tipografiche “ ” (frequenti copiando da app mobile)
 */
export type ExtractResult = { ok: true; data: unknown } | { ok: false; error: string }

export function extractJson(raw: string): ExtractResult {
  let text = raw.trim()
  if (!text) return { ok: false, error: "Incolla la risposta dell'IA." }

  const fenced = text.match(/```(?:json|JSON)?\s*([\s\S]*?)```/)
  if (fenced?.[1]) text = fenced[1].trim()

  const start = text.search(/[[{]/)
  if (start === -1) return { ok: false, error: "Non trovo nessun oggetto JSON nel testo incollato." }
  const open = text[start]
  const close = open === "{" ? "}" : "]"
  const end = text.lastIndexOf(close)
  if (end <= start) return { ok: false, error: "Il JSON sembra troncato: manca la parentesi di chiusura." }
  text = text.slice(start, end + 1)

  const candidates = [
    text,
    text.replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/,\s*([}\]])/g, "$1"),
  ]
  let lastError = ""
  for (const c of candidates) {
    try {
      return { ok: true, data: JSON.parse(c) }
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e)
    }
  }
  return { ok: false, error: `JSON non valido: ${lastError}` }
}

/** Messaggi Zod leggibili: "checkups.0.bia.fat_mass_pct: …" → "Visita 1 › bia › fat_mass_pct: …" */
export function formatIssuePath(path: ReadonlyArray<PropertyKey>, labels: Record<string, string> = {}): string {
  return path
    .map((p, i) => {
      if (typeof p === "number") {
        const parent = String(path[i - 1] ?? "")
        return `${labels[parent] ?? "#"} ${p + 1}`
      }
      return labels[String(p)] ? null : String(p)
    })
    .filter(Boolean)
    .join(" › ")
}
