"use client"

import { AuthGuard } from "@/components/auth-guard"
import { AppSidebar } from "@/components/app-sidebar"

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AuthGuard>
      <div className="flex h-screen">
        <AppSidebar />
        <main className="flex-1 overflow-auto pt-14 md:pt-0">
          <div className="container max-w-6xl p-4 md:p-6">{children}</div>
        </main>
      </div>
    </AuthGuard>
  )
}
