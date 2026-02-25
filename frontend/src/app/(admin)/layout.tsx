"use client"

import { AdminGuard } from "@/components/admin-guard"
import { AdminSidebar } from "@/components/admin-sidebar"

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AdminGuard>
      <div className="flex h-screen">
        <AdminSidebar />
        <main className="flex-1 overflow-auto pt-14 md:pt-0">
          <div className="container max-w-7xl p-4 md:p-6">{children}</div>
        </main>
      </div>
    </AdminGuard>
  )
}
