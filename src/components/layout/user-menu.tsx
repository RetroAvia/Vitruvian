"use client"

import { useQueryClient } from "@tanstack/react-query"
import { FileText, LogOut, Settings, Sparkles } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { clearLocalData } from "@/lib/local-cache"
import { createClient } from "@/lib/supabase/client"

import { useSessionUser } from "./session-user-context"

export function initials(name: string) {
  return name
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("")
}

export function UserMenu() {
  const user = useSessionUser()
  const router = useRouter()
  const queryClient = useQueryClient()

  async function signOut() {
    const { error } = await createClient().auth.signOut()
    if (error) {
      toast.error("Logout non riuscito", { description: error.message })
      return
    }
    clearLocalData(queryClient)
    router.replace("/login")
    router.refresh()
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Menu utente"
        className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-neon/80 to-bia/80 text-xs font-bold text-primary-foreground outline-none ring-offset-background transition hover:brightness-110 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        {initials(user.displayName) || "?"}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-60">
        <DropdownMenuLabel className="font-normal">
          <p className="truncate text-sm font-medium">{user.displayName}</p>
          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/settings">
            <Settings className="size-4" /> Profilo e impostazioni
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/report">
            <FileText className="size-4" /> Report per il nutrizionista
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/bridge">
            <Sparkles className="size-4" /> AI Bridge
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={() => void signOut()}>
          <LogOut className="size-4" /> Esci
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
