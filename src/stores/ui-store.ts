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
  toggleSidebar: () => void
  setTimeRange: (range: TimeRange) => void
  toggleCheckupColumn: (group: CheckupColumnGroup) => void
  setShowDeltas: (value: boolean) => void
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      timeRange: "all",
      checkupColumns: ["bia", "circ"],
      showDeltas: true,
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setTimeRange: (timeRange) => set({ timeRange }),
      toggleCheckupColumn: (group) =>
        set((s) => ({
          checkupColumns: s.checkupColumns.includes(group)
            ? s.checkupColumns.filter((g) => g !== group)
            : [...s.checkupColumns, group],
        })),
      setShowDeltas: (showDeltas) => set({ showDeltas }),
    }),
    {
      name: "vitruvian-ui",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
    },
  ),
)
