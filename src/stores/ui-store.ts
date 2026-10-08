/**
 * Stato UI globale (NON dati del server: quelli stanno in TanStack Query).
 * Persistito in localStorage; la reidratazione avviene dopo il mount
 * (skipHydration) per evitare mismatch SSR.
 */
import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

export type TimeRange = "3m" | "6m" | "1y" | "all"

export const TIME_RANGE_LABELS: Record<TimeRange, string> = {
  "3m": "3 mesi",
  "6m": "6 mesi",
  "1y": "1 anno",
  all: "Tutto",
}

export type CheckupColumnGroup = "bia" | "circ" | "index"

interface UiState {
  sidebarCollapsed: boolean
  timeRange: TimeRange
  /** Gruppi di colonne visibili nella tabella visite */
  checkupColumns: CheckupColumnGroup[]
  /** Mostra la variazione rispetto alla visita precedente in ogni cella */
  showDeltas: boolean
  /** Suoni d'interfaccia */
  soundEnabled: boolean
  /** Disconnessione automatica dopo N minuti di inattività (0 = mai) */
  idleLogoutMinutes: number
  /** Copia locale dei dati per l'avvio istantaneo */
  offlineCache: boolean
  /** Consigli segnati come "fatto": "utente:id" → data (tornano visibili dopo 30 giorni) */
  dismissedAdvice: Record<string, string>
  toggleSidebar: () => void
  setTimeRange: (range: TimeRange) => void
  toggleCheckupColumn: (group: CheckupColumnGroup) => void
  setShowDeltas: (value: boolean) => void
  setSoundEnabled: (value: boolean) => void
  setIdleLogoutMinutes: (value: number) => void
  setOfflineCache: (value: boolean) => void
  dismissAdvice: (id: string, date: string) => void
  /** ripristina i consigli nascosti dell'utente */
  restoreAdvice: (userId: string) => void
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      timeRange: "all",
      checkupColumns: ["bia", "circ"],
      showDeltas: true,
      soundEnabled: true,
      idleLogoutMinutes: 0,
      offlineCache: true,
      dismissedAdvice: {},
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setTimeRange: (timeRange) => set({ timeRange }),
      toggleCheckupColumn: (group) =>
        set((s) => ({
          checkupColumns: s.checkupColumns.includes(group)
            ? s.checkupColumns.filter((g) => g !== group)
            : [...s.checkupColumns, group],
        })),
      setShowDeltas: (showDeltas) => set({ showDeltas }),
      setSoundEnabled: (soundEnabled) => set({ soundEnabled }),
      setIdleLogoutMinutes: (idleLogoutMinutes) => set({ idleLogoutMinutes }),
      setOfflineCache: (offlineCache) => set({ offlineCache }),
      dismissAdvice: (id, date) => set((s) => ({ dismissedAdvice: { ...s.dismissedAdvice, [id]: date } })),
      restoreAdvice: (userId) =>
        set((s) => ({ dismissedAdvice: Object.fromEntries(Object.entries(s.dismissedAdvice).filter(([k]) => !k.startsWith(`${userId}:`))) })),
    }),
    {
      name: "vitruvian-ui",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
    },
  ),
)
