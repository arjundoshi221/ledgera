"use client"

import { useEffect, useSyncExternalStore } from "react"
import { useRouter } from "next/navigation"
import { isLoggedIn, isAdmin } from "@/lib/auth"

type AdminState = "checking" | "unauthed" | "not-admin" | "admin"

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback)
  return () => window.removeEventListener("storage", callback)
}

function getSnapshot(): AdminState {
  if (!isLoggedIn()) return "unauthed"
  if (!isAdmin()) return "not-admin"
  return "admin"
}

// SSR renders "checking" to keep server/client HTML identical; the real
// snapshot arrives on the second render after hydration.
function getServerSnapshot(): AdminState {
  return "checking"
}

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const adminState = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  useEffect(() => {
    if (adminState === "unauthed") router.replace("/login")
    else if (adminState === "not-admin") router.replace("/dashboard")
  }, [adminState, router])

  if (adminState !== "admin") {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Verifying admin access...</div>
      </div>
    )
  }

  return <>{children}</>
}
