"use client"

import { useEffect, useSyncExternalStore } from "react"
import { useRouter } from "next/navigation"
import { isLoggedIn, isProfileComplete } from "@/lib/auth"

type AuthState = "checking" | "unauthed" | "needs-onboarding" | "authed"

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback)
  return () => window.removeEventListener("storage", callback)
}

function getSnapshot(): AuthState {
  if (!isLoggedIn()) return "unauthed"
  if (!isProfileComplete()) return "needs-onboarding"
  return "authed"
}

// SSR + first-paint on client render "checking" to avoid hydration mismatch
// (localStorage is unavailable server-side). The real snapshot lands on the
// second render, immediately after hydration, without a setState-in-effect.
function getServerSnapshot(): AuthState {
  return "checking"
}

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const authState = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  useEffect(() => {
    if (authState === "unauthed") router.replace("/login")
    else if (authState === "needs-onboarding") router.replace("/onboarding")
  }, [authState, router])

  if (authState !== "authed") {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    )
  }

  return <>{children}</>
}
