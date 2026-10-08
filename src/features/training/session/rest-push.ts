"use client"

/**
 * Notifiche del recupero sulla schermata di blocco.
 *  - All'avvio di un recupero il registro crea un "timer" nel database e chiede
 *    al server di mandare una notifica push a fine recupero (anche a schermo nero).
 *  - Se salti o modifichi il recupero, o finisce con l'app aperta, il timer viene
 *    cancellato e la notifica non parte.
 *  - Quando blocchi il telefono durante il recupero compare subito una notifica
 *    silenziosa con esercizio, serie fatte e ora di fine.
 * Su iPhone funziona solo con l'app aggiunta alla schermata Home (iOS 16.4+).
 */
import { useEffect, useRef } from "react"

import { createClient } from "@/lib/supabase/client"

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""
const key = (userId: string) => `vitruvian-push:${userId}`
export const PUSH_EVENT = "vitruvian:push-changed"

/** Recuperi gestibili dal server (funzione serverless: massimo ~5 minuti). */
const MIN_MS = 8_000
const MAX_MS = 280_000

function isIos() {
  return typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent)
}

function isStandalone() {
  if (typeof window === "undefined") return false
  return window.matchMedia?.("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true
}

export type PushStatus =
  | { state: "unsupported"; reason: string }
  | { state: "denied"; reason: string }
  | { state: "off" }
  | { state: "on" }

export function pushStatus(userId: string): PushStatus {
  if (typeof window === "undefined") return { state: "off" }
  if (!VAPID_PUBLIC) return { state: "unsupported", reason: "Il server non è ancora configurato per le notifiche (chiavi VAPID mancanti)." }
  if (isIos() && !isStandalone())
    return { state: "unsupported", reason: "Su iPhone le notifiche funzionano solo dall'app sulla Home: in Safari tocca Condividi → «Aggiungi alla schermata Home» e apri Vitruvian da lì." }
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window))
    return { state: "unsupported", reason: "Questo browser non supporta le notifiche push." }
  if (Notification.permission === "denied")
    return { state: "denied", reason: "Notifiche bloccate: riattivale nelle impostazioni del telefono (Impostazioni → Notifiche → Vitruvian)." }
  try {
    return localStorage.getItem(key(userId)) && Notification.permission === "granted" ? { state: "on" } : { state: "off" }
  } catch {
    return { state: "off" }
  }
}

function endpointOf(userId: string): string | null {
  try {
    return Notification.permission === "granted" ? localStorage.getItem(key(userId)) : null
  } catch {
    return null
  }
}

function toUint8(b64url: string) {
  const pad = "=".repeat((4 - (b64url.length % 4)) % 4)
  const raw = atob((b64url + pad).replace(/-/g, "+").replace(/_/g, "/"))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

async function swReady(): Promise<ServiceWorkerRegistration> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("Service worker non attivo: le notifiche funzionano nell'app pubblicata (non in modalità sviluppo).")), 6000),
  )
  return Promise.race([navigator.serviceWorker.ready, timeout])
}

async function saveSubscription(sub: PushSubscription) {
  const j = sub.toJSON()
  if (!j.endpoint || !j.keys?.p256dh || !j.keys.auth) throw new Error("Sottoscrizione incompleta")
  const device = `${isIos() ? "iPhone" : /android/i.test(navigator.userAgent) ? "Android" : "Browser"}${isStandalone() ? " · app" : ""}`
  return createClient()
    .from("push_subscriptions")
    .upsert({ endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, device }, { onConflict: "endpoint" })
}

/** Chiede il permesso e registra questo dispositivo. */
export async function enablePush(userId: string) {
  const status = pushStatus(userId)
  if (status.state === "unsupported" || status.state === "denied") throw new Error(status.reason)
  const perm = await Notification.requestPermission()
  if (perm !== "granted") throw new Error("Permesso negato: senza permesso il telefono non mostra le notifiche.")
  const reg = await swReady()
  const serverKey = toUint8(VAPID_PUBLIC)
  const opts = { userVisibleOnly: true, applicationServerKey: serverKey }
  let sub = await reg.pushManager.getSubscription()
  // sottoscrizione creata con un'altra chiave del server (chiavi cambiate): va rifatta
  const oldKey = sub?.options.applicationServerKey ? new Uint8Array(sub.options.applicationServerKey) : null
  if (sub && (!oldKey || oldKey.length !== serverKey.length || oldKey.some((b, i) => b !== serverKey[i]))) {
    await sub.unsubscribe().catch(() => undefined)
    sub = null
  }
  sub ??= await reg.pushManager.subscribe(opts)
  let { error } = await saveSubscription(sub)
  if (error) {
    // sottoscrizione di un altro account sullo stesso telefono (o chiavi cambiate): se ne crea una nuova
    await sub.unsubscribe().catch(() => undefined)
    sub = await reg.pushManager.subscribe(opts)
    ;({ error } = await saveSubscription(sub))
    if (error) throw new Error(error.message)
  }
  localStorage.setItem(key(userId), sub.endpoint)
  window.dispatchEvent(new Event(PUSH_EVENT))
}

export async function disablePush(userId: string) {
  const endpoint = endpointOf(userId) ?? localStorage.getItem(key(userId))
  localStorage.removeItem(key(userId))
  window.dispatchEvent(new Event(PUSH_EVENT))
  if (endpoint) await createClient().from("push_subscriptions").delete().eq("endpoint", endpoint)
  try {
    const reg = await swReady()
    await (await reg.pushManager.getSubscription())?.unsubscribe()
  } catch {
    /* nessun service worker */
  }
}

/**
 * Programma l'avviso di fine recupero con UNA sola richiesta (parte anche se blocchi
 * subito il telefono): il server crea il timer e lo sostituisce ai precedenti.
 * Restituisce l'id del timer (null se non programmato).
 */
export async function scheduleRestPush(userId: string, until: number, title: string, body: string): Promise<string | null> {
  const endpoint = endpointOf(userId)
  const delay = until - Date.now()
  if (!endpoint || delay < MIN_MS || delay > MAX_MS || navigator.onLine === false) return null
  const { data } = await createClient().auth.getSession()
  const token = data.session?.access_token
  if (!token) return null
  const id = crypto.randomUUID()
  try {
    const res = await fetch("/api/push/rest", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ timerId: id, endpoint, delayMs: until - Date.now(), title, body }),
      keepalive: true,
    })
    if (res.status === 404) {
      // dispositivo non più registrato sul server
      localStorage.removeItem(key(userId))
      window.dispatchEvent(new Event(PUSH_EVENT))
    }
    return res.ok ? id : null
  } catch {
    return null
  }
}

/** Annulla un avviso (dopo che la richiesta è arrivata: il server ha già creato il timer). */
export function cancelRestPush(pending: Promise<string | null> | string | null) {
  if (!pending) return
  void Promise.resolve(pending).then((id) => {
    if (id) void createClient().from("rest_timers").delete().eq("id", id)
  })
}

/** Notifica di prova tra 10 secondi (blocca il telefono per vederla). */
export async function testPush(userId: string) {
  const id = await scheduleRestPush(userId, Date.now() + 10_000, "🔔 Prova riuscita", "Così arriverà l'avviso di fine recupero.")
  if (!id) throw new Error("Invio non riuscito: controlla la connessione e riattiva le notifiche.")
}

function postToSw(message: unknown) {
  try {
    navigator.serviceWorker?.controller?.postMessage(message)
  } catch {
    /* nessun service worker */
  }
}

const hhmm = (t: number) => new Date(t).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })

/**
 * Collega il timer di recupero alle notifiche: programma/cancella l'avviso e
 * mostra le informazioni quando blocchi il telefono.
 */
export function useRestNotifications(userId: string, rest: { until: number } | null, info: string | null, active: boolean) {
  const timerId = useRef<Promise<string | null> | null>(null)
  const infoRef = useRef(info)
  infoRef.current = info
  const until = rest?.until ?? null

  // avviso a fine recupero: subito (si blocca il telefono appena spuntata la serie);
  // un nuovo recupero (o +15 s) sostituisce il precedente anche sul server
  useEffect(() => {
    cancelRestPush(timerId.current)
    timerId.current = null
    if (!active || !until || !endpointOf(userId)) return
    timerId.current = scheduleRestPush(userId, until, "⏱️ Recupero finito: si riparte!", infoRef.current ?? "Torna al registro")
    // se alla fine l'app è aperta basta il suono: niente notifica doppia
    const nearEnd = setTimeout(() => {
      if (document.visibilityState === "visible") {
        cancelRestPush(timerId.current)
        timerId.current = null
      }
    }, Math.max(0, until - Date.now() - 1500))
    return () => clearTimeout(nearEnd)
  }, [until, userId, active])

  // schermo bloccato: notifica silenziosa con le informazioni del recupero
  useEffect(() => {
    if (!active) return
    const onVis = () => {
      if (document.visibilityState === "hidden") {
        if (until && until - Date.now() > 3000 && endpointOf(userId))
          postToSw({ type: "rest-show", notification: { title: `⏱️ Recupero fino alle ${hhmm(until)}`, body: infoRef.current ?? "", tag: "vt-rest" } })
      } else postToSw({ type: "rest-clear" })
    }
    document.addEventListener("visibilitychange", onVis)
    return () => document.removeEventListener("visibilitychange", onVis)
  }, [until, userId, active])

  // chiusura del registro: nessun avviso pendente
  useEffect(
    () => () => {
      cancelRestPush(timerId.current)
      timerId.current = null
    },
    [],
  )
}
