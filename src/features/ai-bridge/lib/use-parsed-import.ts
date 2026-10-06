"use client"

import { useDeferredValue, useMemo } from "react"
import type { z } from "zod"

import { extractJson, formatIssuePath } from "./extract-json"

export type ParseState<T> =
  | { kind: "empty" }
  | { kind: "error"; message: string; issues: string[] }
  | { kind: "ok"; data: T }

/** Parsing in tempo reale (differito) della risposta incollata, con errori leggibili. */
export function useParsedImport<S extends z.ZodType>(
  text: string,
  schema: S,
  normalize: (d: unknown) => unknown,
  labels: Record<string, string>,
): ParseState<z.output<S>> {
  const deferred = useDeferredValue(text)
  return useMemo(() => {
    if (!deferred.trim()) return { kind: "empty" }
    const json = extractJson(deferred)
    if (!json.ok) return { kind: "error", message: json.error, issues: [] }
    const res = schema.safeParse(normalize(json.data))
    if (!res.success) {
      const issues = res.error.issues.slice(0, 30).map((i) => {
        const where = formatIssuePath(i.path, labels)
        return where ? `${where}: ${i.message}` : i.message
      })
      return { kind: "error", message: "Il JSON non rispetta lo schema atteso", issues }
    }
    return { kind: "ok", data: res.data }
  }, [deferred, schema, normalize, labels])
}
