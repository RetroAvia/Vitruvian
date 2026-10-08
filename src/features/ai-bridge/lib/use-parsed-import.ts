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
  expectSchema?: string,
): ParseState<z.output<S>> {
  const deferred = useDeferredValue(text)
  return useMemo(() => {
    if (!deferred.trim()) return { kind: "empty" }
    const json = extractJson(deferred, expectSchema)
    if (!json.ok) return { kind: "error", message: json.error, issues: [] }
    const res = schema.safeParse(normalize(stripCitations(json.data)))
    if (!res.success) {
      const issues = res.error.issues.slice(0, 30).map((i) => {
        const where = formatIssuePath(i.path, labels)
        return where ? `${where}: ${i.message}` : i.message
      })
      return { kind: "error", message: "Il JSON non rispetta lo schema atteso", issues }
    }
    return { kind: "ok", data: res.data }
  }, [deferred, schema, normalize, labels, expectSchema])
}

/**
 * Rimuove i riferimenti alle fonti che alcune IA inseriscono nel testo
 * (es. "[cite: 4]", "[cite_start]", "【4†fonte】", "[1]") prima di salvarlo.
 */
export function cleanAiText(s: string): string {
  return s
    .replace(/\[cite(?:_start|_end)?(?::[^\]]*)?\]/gi, "")
    .replace(/【[^】]*】/g, "")
    .replace(/\[\d+(?:,\s*\d+)*\]/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+([.,;:])/g, "$1")
    .trim()
}

function stripCitations(v: unknown): unknown {
  if (typeof v === "string") return cleanAiText(v)
  if (Array.isArray(v)) return v.map(stripCitations)
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, stripCitations(x)]))
  return v
}
