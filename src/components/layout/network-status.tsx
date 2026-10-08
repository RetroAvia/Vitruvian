"use client"

import { CloudOff } from "lucide-react"
import { useEffect, useRef } from "react"
import { toast } from "sonner"

import { useOnline } from "@/lib/use-online"

/**
 * Funzionamento offline:
 *  - registra il service worker (solo in produzione: in sviluppo interferirebbe
 *    con l'aggiornamento a caldo e viene rimosso se presente);
 *  - mostra una barra discreta quando manca la connessione.
 */
export function NetworkStatus() {
  const online = useOnline()
  const wasOffline = useRef(false)

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return
    if (process.env.NODE_ENV !== "production") {
      void navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => void r.unregister()))
      return
    }
    const register = () => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .then((reg) => {
          // prepara in cache le pagine principali, così l'app si apre anche senza rete
          // al massimo una volta ogni 12 ore (dati e batteria)
          const warm = () => {
            try {
              const last = Number(localStorage.getItem("vitruvian-sw-warm") ?? 0)
              if (Date.now() - last < 12 * 3600_000) return
              localStorage.setItem("vitruvian-sw-warm", String(Date.now()))
            } catch {
              /* ignore */
            }
            reg.active?.postMessage({ type: "warm", urls: ["/dashboard", "/training", "/body"] })
          }
          if (reg.active) warm()
          else navigator.serviceWorker.ready.then(warm).catch(() => {})
        })
        .catch(() => {
          /* browser senza supporto o modalità privata: l'app funziona comunque online */
        })
    }
    if (document.readyState === "complete") register()
    else window.addEventListener("load", register, { once: true })
  }, [])

  useEffect(() => {
    if (!online) wasOffline.current = true
    else if (wasOffline.current) {
      wasOffline.current = false
      toast.success("Di nuovo online", { description: "Sincronizzo i dati salvati sul dispositivo." })
    }
  }, [online])

  if (online) return null
  return (
    <div
      role="status"
      className="no-print fixed inset-x-0 top-0 z-[60] flex items-center justify-center gap-2 bg-bia/90 px-3 pb-1.5 pt-[calc(env(safe-area-inset-top)+0.375rem)] text-xs font-medium text-background"
    >
      <CloudOff className="size-3.5" />
      Offline · puoi continuare ad allenarti: tutto viene salvato sul dispositivo
    </div>
  )
}
