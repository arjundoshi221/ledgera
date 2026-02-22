"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/components/ui/use-toast"
import { getUsers, disableUser, enableUser, promoteUser, demoteUser } from "@/lib/admin-api"
import type { AdminUserListItem, PaginatedUserResponse } from "@/lib/admin-types"

export default function AdminUsersPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<PaginatedUserResponse | null>(null)
  const [search, setSearch] = useState("")
  const [authFilter, setAuthFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [page, setPage] = useState(0)
  const [confirmAction, setConfirmAction] = useState<{ user: AdminUserListItem; action: string } | null>(null)
  const limit = 25

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true)
      const params: any = { offset: page * limit, limit }
      if (search) params.search = search
      if (authFilter !== "all") params.auth_provider = authFilter
      if (statusFilter === "disabled") params.is_disabled = true
      if (statusFilter === "admin") params.is_admin = true
      const res = await getUsers(params)
      setData(res)
    } catch (err: any) {
      toast({ variant: "destructive", title: "Failed to load users", description: err.message })
    } finally {
      setLoading(false)
    }
  }, [search, authFilter, statusFilter, page])

  useEffect(() => {
    const timer = setTimeout(() => loadUsers(), 300)
    return () => clearTimeout(timer)
  }, [loadUsers])

  async function handleAction() {
    if (!confirmAction) return
    const { user, action } = confirmAction
    try {
      if (action === "disable") await disableUser(user.id)
      else if (action === "enable") await enableUser(user.id)
      else if (action === "promote") await promoteUser(user.id)
      else if (action === "demote") await demoteUser(user.id)
      toast({ title: `User ${user.email} ${action}d successfully` })
      setConfirmAction(null)
      loadUsers()
    } catch (err: any) {
      toast({ variant: "destructive", title: `Failed to ${action} user`, description: err.message })
    }
  }

  const totalPages = data ? Math.ceil(data.total / limit) : 0

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">User Management</h1>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Search by email or name..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0) }}
          className="w-72"
        />
        <Select value={authFilter} onValueChange={(v) => { setAuthFilter(v); setPage(0) }}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Auth Provider" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Providers</SelectItem>
            <SelectItem value="email">Email</SelectItem>
            <SelectItem value="google">Google</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0) }}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="disabled">Disabled</SelectItem>
            <SelectItem value="admin">Admins</SelectItem>
          </SelectContent>
        </Select>
        {data && (
          <span className="text-sm text-muted-foreground ml-auto">
            {data.total} user{data.total !== 1 ? "s" : ""} found
          </span>
        )}
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center animate-pulse text-muted-foreground">Loading users...</div>
          ) : !data || data.users.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No users found</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead>Last Login</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.users.map((user) => (
                  <TableRow
                    key={user.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => router.push(`/admin/users/${user.id}`)}
                  >
                    <TableCell className="font-medium">{user.email}</TableCell>
                    <TableCell>{[user.first_name, user.last_name].filter(Boolean).join(" ") || "-"}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">
                        {user.auth_provider}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {user.is_disabled && <Badge variant="destructive" className="text-xs">Disabled</Badge>}
                        {user.is_admin && <Badge className="text-xs bg-red-600">Admin</Badge>}
                        {!user.is_disabled && !user.is_admin && <Badge variant="outline" className="text-xs">Active</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {user.created_at ? new Date(user.created_at).toLocaleDateString() : "-"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {user.last_login_at ? new Date(user.last_login_at).toLocaleDateString() : "Never"}
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-1">
                        {user.is_disabled ? (
                          <Button size="sm" variant="outline" onClick={() => setConfirmAction({ user, action: "enable" })}>
                            Enable
                          </Button>
                        ) : (
                          <Button size="sm" variant="outline" onClick={() => setConfirmAction({ user, action: "disable" })}>
                            Disable
                          </Button>
                        )}
                        {user.is_admin ? (
                          <Button size="sm" variant="outline" onClick={() => setConfirmAction({ user, action: "demote" })}>
                            Demote
                          </Button>
                        ) : (
                          <Button size="sm" variant="outline" onClick={() => setConfirmAction({ user, action: "promote" })}>
                            Promote
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page + 1} of {totalPages}
          </span>
          <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>
            Next
          </Button>
        </div>
      )}

      {/* Confirmation Dialog */}
      <Dialog open={!!confirmAction} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmAction?.action === "disable" && "Disable User?"}
              {confirmAction?.action === "enable" && "Enable User?"}
              {confirmAction?.action === "promote" && "Promote to Admin?"}
              {confirmAction?.action === "demote" && "Remove Admin Role?"}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to {confirmAction?.action}{" "}
            <strong>{confirmAction?.user.email}</strong>?
            {confirmAction?.action === "disable" && " They will not be able to access the platform."}
            {confirmAction?.action === "promote" && " They will have full admin access."}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmAction(null)}>Cancel</Button>
            <Button
              variant={confirmAction?.action === "disable" || confirmAction?.action === "demote" ? "destructive" : "default"}
              onClick={handleAction}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
