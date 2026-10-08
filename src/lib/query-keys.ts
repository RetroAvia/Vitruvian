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
  training: {
    plans: ["training", "plans"] as const,
    tree: (id: string) => ["training", "tree", id] as const,
    workouts: ["training", "workouts"] as const,
    recent: ["training", "recent"] as const,
    detail: (id: string) => ["training", "detail", id] as const,
  },
  health: {
    days: ["health", "days"] as const,
    link: ["health", "link"] as const,
  },
  diet: {
    plans: ["diet", "plans"] as const,
    tree: (id: string) => ["diet", "tree", id] as const,
    logs: (from: string) => ["diet", "logs", from] as const,
    allLogs: ["diet", "logs"] as const,
  },
} as const
