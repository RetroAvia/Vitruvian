import {
  Activity,
  ClipboardList,
  HeartPulse,
  Lightbulb,
  Pill,
  FileText,
  FlaskConical,
  LayoutDashboard,
  Salad,
  Settings,
  Sparkles,
  type LucideIcon,
} from "lucide-react"

export interface NavItem {
  href: string
  label: string
  /** Etichetta corta per la tab bar mobile */
  short: string
  description: string
  icon: LucideIcon
}

export const NAV = {
  dashboard: {
    href: "/dashboard",
    label: "Dashboard",
    short: "Home",
    description: "Sintesi, indicatori e andamento",
    icon: LayoutDashboard,
  },
  checkups: {
    href: "/checkups",
    label: "Visite",
    short: "Visite",
    description: "Storico dei controlli: BIA e circonferenze",
    icon: ClipboardList,
  },
  trends: {
    href: "/trends",
    label: "Trend",
    short: "Trend",
    description: "Circonferenze, indici e ricomposizione nel tempo",
    icon: Activity,
  },
  labs: {
    href: "/labs",
    label: "Analisi del sangue",
    short: "Sangue",
    description: "Esami, range di riferimento e tendenze",
    icon: FlaskConical,
  },
  reports: {
    href: "/reports",
    label: "Referti medici",
    short: "Referti",
    description: "ECG, visite, pressione e altri esami strumentali",
    icon: HeartPulse,
  },
  supplements: {
    href: "/supplements",
    label: "Integratori",
    short: "Integr.",
    description: "Cosa prendi, quanto e quando — con i limiti di sicurezza",
    icon: Pill,
  },
  advice: {
    href: "/advice",
    label: "Consigli",
    short: "Consigli",
    description: "Suggerimenti personalizzati incrociando tutti i tuoi dati",
    icon: Lightbulb,
  },
  nutrition: {
    href: "/nutrition",
    label: "Nutrizione",
    short: "Dieta",
    description: "Piano alimentare, checklist e fabbisogno",
    icon: Salad,
  },
  bridge: {
    href: "/bridge",
    label: "AI Bridge",
    short: "AI",
    description: "Importa referti e diete tramite un'IA esterna",
    icon: Sparkles,
  },
  report: {
    href: "/report",
    label: "Report",
    short: "Report",
    description: "Riepilogo stampabile per il nutrizionista",
    icon: FileText,
  },
  settings: {
    href: "/settings",
    label: "Impostazioni",
    short: "Profilo",
    description: "Profilo, obiettivi e strumenti di misura",
    icon: Settings,
  },
} satisfies Record<string, NavItem>

export const NAV_GROUPS: Array<{ label: string; items: NavItem[] }> = [
  { label: "Corpo", items: [NAV.dashboard, NAV.checkups, NAV.trends] },
  { label: "Salute", items: [NAV.labs, NAV.reports, NAV.supplements] },
  { label: "Alimentazione", items: [NAV.nutrition] },
  { label: "Strumenti", items: [NAV.advice, NAV.bridge, NAV.report] },
]

/** Barra inferiore su smartphone: 4 voci + "Altro" (foglio con tutte le sezioni). */
export const MOBILE_NAV: NavItem[] = [NAV.dashboard, NAV.checkups, NAV.advice, NAV.nutrition]

export const SETTINGS_ITEM = NAV.settings
export const ALL_NAV_ITEMS: NavItem[] = Object.values(NAV)

export function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function findNavItem(pathname: string) {
  return ALL_NAV_ITEMS.find((item) => isActivePath(pathname, item.href))
}
