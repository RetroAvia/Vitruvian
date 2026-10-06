/** Chiavi di cache TanStack Query centralizzate: invalidazioni sempre coerenti. */
export const queryKeys = {
  profile: ["profile"] as const,
  checkups: {
    all: ["checkups"] as const,
    detail: (id: string) => ["checkups", id] as const,
  },
  circumferences: ["circumferences"] as const,
  protocols: ["bia-protocols"] as const,
  sites: ["measurement-sites"] as const,
  labs: {
    results: ["labs", "results"] as const,
    analytes: ["labs", "analytes"] as const,
    reports: ["labs", "reports"] as const,
  },
  medical: ["medical-reports"] as const,
  supplements: {
    all: ["supplements"] as const,
    logs: (from: string) => ["supplements", "logs", from] as const,
    allLogs: ["supplements", "logs"] as const,
  },
  diet: {
    plans: ["diet", "plans"] as const,
    tree: (id: string) => ["diet", "tree", id] as const,
    logs: (from: string) => ["diet", "logs", from] as const,
    allLogs: ["diet", "logs"] as const,
  },
} as const
