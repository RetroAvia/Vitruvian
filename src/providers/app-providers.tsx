"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { domMax, LazyMotion, MotionConfig } from "motion/react"
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
        gcTime: 10 * 60_000,
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
  }, [])

  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
      <QueryClientProvider client={queryClient}>
        {/* domMax abilita layoutId (indicatore attivo animato della nav) */}
        <LazyMotion features={domMax} strict>
          <MotionConfig reducedMotion="user" transition={{ type: "spring", stiffness: 380, damping: 32 }}>
            <TooltipProvider delayDuration={150}>
              {children}
              <Toaster position="top-center" richColors closeButton />
            </TooltipProvider>
          </MotionConfig>
        </LazyMotion>
      </QueryClientProvider>
    </ThemeProvider>
  )
}
