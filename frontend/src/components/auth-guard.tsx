"use client"

import { useEffect, useSyncExternalStore } from "react"
import { useRouter } from "next/navigation"
import { isLoggedIn, isProfileComplete } from "@/lib/auth"

// F4 (partial): "needs-onboarding" branch retired for solo use. Kept the type
// alias with the value so external callers of isProfileComplete() don't break
// silently; the guard simply treats logged-in-but-not-onboarded users as
// authed and lets them into the app. See PRODUCT_REVIEW_2026_09_30.md.
type AuthState = "checking" | "unauthed" | "authed"

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback)
  return () => window.removeEventListener("storage", callback)
}

function getSnapshot(): AuthState {
  if (!isLoggedIn()) return "unauthed"
  // Solo: any logged-in user counts as authed. isProfileComplete kept in the
  // read-only path (imported below via _unused) so removing it later stays
  // a one-file change.
  return "authed"
}

// Keep the import live so grep for isProfileComplete still finds it during the
// full F4 cleanup pass.
export const _isProfileCompleteReference = isProfileComplete

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
