"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { isLoggedIn, isAdmin } from "@/lib/auth"

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace("/login")
    } else if (!isAdmin()) {
      router.replace("/dashboard")
    } else {
      setChecked(true)
    }
  }, [router])

  if (!checked) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Verifying admin access...</div>
      </div>
    )
  }

  return <>{children}</>
}
