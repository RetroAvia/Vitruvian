/*
 * Vitruvian · service worker (funzionamento offline).
 *
 *  - File dell'app (/_next/static, con nome che cambia a ogni versione):
 *    prima la cache, poi la rete → avvio istantaneo e niente download ripetuti.
 *  - Pagine: prima la rete (max 4 s), poi l'ultima copia salvata → l'app si
 *    apre anche in palestra senza campo. I dati arrivano dalla cache locale
 *    dell'app e le sessioni concluse offline vengono inviate al ritorno della rete.
 *  - Supabase e le API non passano di qui: nessun dato sanitario nella cache del SW.
 *  - Al logout la pagina chiede di svuotare la cache delle pagine ("clear").
 *  - Notifiche del recupero: "push" dal server a fine recupero, "rest-show" dalla
 *    pagina quando blocchi il telefono (esercizio, serie, ora di fine).
 */
const VERSION = "v2"
const STATIC = `vt-static-${VERSION}`
const PAGES = `vt-pages-${VERSION}`
const ASSETS = `vt-assets-${VERSION}`
const KEEP = [STATIC, PAGES, ASSETS]
const MAX_STATIC = 400
const NAV_TIMEOUT = 4000

/* Ogni logout incrementa la generazione: le risposte partite prima non vengono più salvate. */
let generation = 0

self.addEventListener("install", () => self.skipWaiting())

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys()
      await Promise.all(names.filter((n) => n.startsWith("vt-") && !KEEP.includes(n)).map((n) => caches.delete(n)))
      if (self.registration.navigationPreload) await self.registration.navigationPreload.enable().catch(() => {})
      await self.clients.claim()
    })(),
  )
})

self.addEventListener("message", (event) => {
  const data = event.data || {}
  if (data.type === "clear") {
    generation++
    event.waitUntil(caches.delete(PAGES))
  } else if (data.type === "warm" && Array.isArray(data.urls)) {
    event.waitUntil(Promise.all(data.urls.map((u) => cachePage(new URL(u, self.location.origin).href).catch(() => {}))))
  }
})

/** Salva la pagina e i file JS/CSS che usa (così si apre offline anche senza averla mai visitata). */
async function cachePage(url) {
  const gen = generation
  const res = await fetch(url, { credentials: "same-origin", redirect: "follow" })
  if (!isCacheablePage(res, url) || gen !== generation) return
  const html = await res.clone().text()
  const cache = await caches.open(PAGES)
  await cache.put(pageKey(url), res)
  const assets = [...new Set(html.match(/\/_next\/static\/[^"'\s)]+\.(?:js|css)/g) || [])]
  const stat = await caches.open(STATIC)
  await Promise.all(
    assets.map(async (a) => {
      if (await stat.match(a)) return
      const r = await fetch(a).catch(() => null)
      if (r && r.ok) await stat.put(a, r)
    }),
  )
  trim(STATIC, MAX_STATIC)
}

function pageKey(url) {
  const u = new URL(url)
  return u.origin + u.pathname
}

function isCacheablePage(res, url) {
  if (!res || !res.ok || res.type === "opaqueredirect" || res.redirected) return false
  const path = new URL(url).pathname
  if (path.startsWith("/login")) return false
  return (res.headers.get("content-type") || "").includes("text/html")
}

async function trim(cacheName, max) {
  const cache = await caches.open(cacheName)
  const keys = await cache.keys()
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i])
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName)
  const hit = await cache.match(request)
  if (hit) return hit
  const res = await fetch(request)
  if (res.ok) {
    await cache.put(request, res.clone())
    if (cacheName === STATIC) trim(STATIC, MAX_STATIC)
  }
  return res
}

async function staleWhileRevalidate(request, event) {
  const cache = await caches.open(ASSETS)
  const hit = await cache.match(request)
  const update = fetch(request)
    .then((res) => {
      if (res.ok) cache.put(request, res.clone())
      return res
    })
    .catch(() => hit)
  if (hit) {
    event.waitUntil(update.catch(() => {}))
    return hit
  }
  return update
}

async function navigation(event) {
  const request = event.request
  const cache = await caches.open(PAGES)
  const gen = generation
  const network = (async () => {
    const preload = await event.preloadResponse
    const res = preload || (await fetch(request))
    if (isCacheablePage(res, request.url) && gen === generation) await cache.put(pageKey(request.url), res.clone())
    // sessione scaduta → niente copie delle pagine protette
    else if ((res.type === "opaqueredirect" || res.redirected) && !["/", "/login"].includes(new URL(request.url).pathname)) await caches.delete(PAGES)
    return res
  })()

  const timeout = new Promise((resolve) => setTimeout(resolve, NAV_TIMEOUT, null))
  try {
    const res = await Promise.race([network, timeout])
    if (res) return res
  } catch {
    /* rete assente: si usa la cache */
  }
  const path = new URL(request.url).pathname
  // "/" reindirizza alla dashboard: offline si apre direttamente la copia salvata
  const cached = (await cache.match(pageKey(request.url))) || (path === "/" ? await cache.match(`${self.location.origin}/dashboard`) : undefined)
  if (cached) {
    event.waitUntil(network.catch(() => {}))
    return cached
  }
  try {
    return await network
  } catch {
    return new Response(
      '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Vitruvian · offline</title><body style="font-family:system-ui;background:#0b0f17;color:#e6edf3;display:grid;place-items:center;min-height:100vh;margin:0;text-align:center;padding:24px"><div><h1 style="font-size:20px">Sei offline</h1><p style="opacity:.7">Questa pagina non è ancora salvata sul dispositivo.</p><p><a href="/training" style="display:inline-block;margin:8px;padding:10px 18px;border-radius:12px;background:#22d3ee;color:#0b0f17;text-decoration:none;font-weight:600">Allenamento</a><a href="/dashboard" style="display:inline-block;margin:8px;padding:10px 18px;border-radius:12px;border:1px solid #2a3442;color:#e6edf3;text-decoration:none">Dashboard</a></p></div></body>',
      { status: 503, headers: { "content-type": "text/html; charset=utf-8" } },
    )
  }
}

self.addEventListener("fetch", (event) => {
  const request = event.request
  if (request.method !== "GET") return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith("/api/") || url.pathname === "/sw.js") return

  if (request.mode === "navigate") {
    event.respondWith(navigation(event))
    return
  }
  // richieste RSC della navigazione client: solo rete (se falliscono Next ricarica la pagina, servita dalla cache)
  if (request.headers.get("RSC") || url.searchParams.has("_rsc")) return

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request, STATIC))
    return
  }
  if (url.pathname.startsWith("/icons/") || /\.(?:png|svg|ico|webp|woff2?)$/.test(url.pathname) || url.pathname === "/manifest.webmanifest") {
    event.respondWith(staleWhileRevalidate(request, event))
  }
})

/* ------------------------------- Notifiche -------------------------------- */

const ICON = "/icons/icon-192.png"

function showRest(data) {
  return self.registration.showNotification(data.title || "Vitruvian", {
    body: data.body || "",
    tag: data.tag || "vt-rest",
    renotify: true,
    icon: ICON,
    badge: ICON,
    silent: Boolean(data.silent),
    requireInteraction: false,
    vibrate: data.silent ? undefined : [250, 120, 250, 120, 400],
    data: { url: data.url || "/training" },
  })
}

self.addEventListener("push", (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { title: "Vitruvian", body: event.data ? event.data.text() : "" }
  }
  event.waitUntil(showRest(data))
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const target = new URL((event.notification.data && event.notification.data.url) || "/training", self.location.origin).href
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true })
      // app già aperta (il registro è lì): basta riportarla in primo piano
      const open = all.find((c) => new URL(c.url).origin === self.location.origin)
      if (open) return open.focus()
      return self.clients.openWindow(target)
    })(),
  )
})

self.addEventListener("message", (event) => {
  const data = event.data || {}
  if (data.type === "rest-show") event.waitUntil(showRest({ ...data.notification, silent: true }))
  else if (data.type === "rest-clear") {
    event.waitUntil(
      self.registration.getNotifications({ tag: "vt-rest" }).then((list) => list.forEach((n) => n.close())),
    )
  }
})
