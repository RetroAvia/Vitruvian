/**
 * Estrae il JSON dalla risposta di un'IA esterna, tollerando:
 *  - blocchi ```json … ```
 *  - testo prima/dopo l'oggetto
 *  - virgole finali prima di } o ]
 *  - virgolette tipografiche “ ” (frequenti copiando da app mobile)
 */
export type ExtractResult = { ok: true; data: unknown } | { ok: false; error: string }

/**
 * @param expectSchema se la risposta contiene più blocchi JSON (es. scheda + dieta
 *        dal Coach AI), sceglie quello con "schema" uguale a questo valore.
 */
export function extractJson(raw: string, expectSchema?: string): ExtractResult {
  let text = raw.trim()
  if (!text) return { ok: false, error: "Incolla la risposta dell'IA." }

  if (expectSchema) {
    const blocks = [...text.matchAll(/```(?:json|JSON)?\s*([\s\S]*?)```/g)].map((m) => m[1] ?? "")
    const candidates = blocks.length > 1 ? blocks : topLevelObjects(text)
    if (candidates.length > 1) {
      let found = false
      for (const c of candidates) {
        const r = extractJson(c)
        if (r.ok && (r.data as { schema?: unknown } | null)?.schema === expectSchema) return r
        found = found || r.ok
      }
      if (found) return { ok: false, error: `Nella risposta non c'è un blocco con "schema": "${expectSchema}".` }
    }
  }

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

/** Oggetti JSON di primo livello presenti nel testo (parentesi bilanciate, stringhe ignorate). */
function topLevelObjects(text: string): string[] {
  const out: string[] = []
  let depth = 0
  let start = -1
  let inStr = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inStr) {
      if (ch === "\\") i++
      else if (ch === '"') inStr = false
      continue
    }
    if (ch === '"') inStr = true
    else if (ch === "{") {
      if (depth === 0) start = i
      depth++
    } else if (ch === "}" && depth > 0) {
      depth--
      if (depth === 0 && start >= 0) out.push(text.slice(start, i + 1))
    }
  }
  return out
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
