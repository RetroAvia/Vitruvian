"use client"

import { onlineManager, QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ThemeProvider } from "next-themes"
import { useEffect, useState, type ReactNode } from "react"

import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { useUiStore } from "@/stores/ui-store"

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000, // i dati biometrici cambiano raramente
        gcTime: 24 * 60 * 60_000, // restano in memoria (e nella copia locale) anche le pagine non aperte: utile offline
        refetchOnWindowFocus: false,
        retry: 1,
      },
      mutations: { retry: 0 },
    },
  })
}

export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(makeQueryClient)

  // Reidrata lo store UI solo lato client (vedi skipHydration)
  useEffect(() => {
    void useUiStore.persist.rehydrate()
    // app aperta già senza rete: TanStack parte "online" finché non arriva un evento
    onlineManager.setOnline(navigator.onLine)
  }, [])

  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider delayDuration={150}>
          {children}
          <Toaster position="top-center" richColors closeButton />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  )
}
