"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { useToast } from "@/components/ui/use-toast"
import { getUserDetail, disableUser, enableUser, promoteUser, demoteUser, deleteUser } from "@/lib/admin-api"
import { getAuditLogs } from "@/lib/admin-api"
import type { AdminUserDetail, AuditLogEntry } from "@/lib/admin-types"

export default function AdminUserDetailPage() {
  const { userId } = useParams<{ userId: string }>()
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<AdminUserDetail | null>(null)
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([])
  const [confirmAction, setConfirmAction] = useState<string | null>(null)

  async function load() {
    try {
      const [u, logs] = await Promise.all([
        getUserDetail(userId),
        getAuditLogs({ target_id: userId, target_type: "user", limit: 20 }),
      ])
      setUser(u)
      setAuditLogs(logs.logs)
    } catch (err: any) {
      toast({ variant: "destructive", title: "Failed to load user", description: err.message })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [userId])

  async function handleAction() {
    if (!confirmAction || !user) return
    try {
      if (confirmAction === "disable") await disableUser(user.id)
      else if (confirmAction === "enable") await enableUser(user.id)
      else if (confirmAction === "promote") await promoteUser(user.id)
      else if (confirmAction === "demote") await demoteUser(user.id)
      else if (confirmAction === "delete") {
        await deleteUser(user.id)
        toast({ title: "User permanently deleted" })
        router.push("/admin/users")
        return
      }
      toast({ title: `User ${confirmAction}d successfully` })
      setConfirmAction(null)
      load()
    } catch (err: any) {
      toast({ variant: "destructive", title: `Failed to ${confirmAction} user`, description: err.message })
    }
  }

  if (loading) {
    return <div className="animate-pulse text-muted-foreground">Loading user details...</div>
  }

  if (!user) {
    return <div className="text-muted-foreground">User not found</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={() => router.push("/admin/users")}>
          Back
        </Button>
        <h1 className="text-2xl font-bold">User Detail</h1>
      </div>

      {/* Profile Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            {user.email}
            {user.is_admin && <Badge className="bg-red-600 text-xs">Admin</Badge>}
            {user.is_disabled && <Badge variant="destructive" className="text-xs">Disabled</Badge>}
            {!user.is_disabled && !user.is_admin && <Badge variant="outline" className="text-xs">Active</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            <div>
              <div className="text-sm text-muted-foreground">Name</div>
              <div className="font-medium">{[user.first_name, user.last_name].filter(Boolean).join(" ") || "-"}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Auth Provider</div>
              <div className="font-medium">{user.auth_provider}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Profile Complete</div>
              <div className="font-medium">{user.profile_completed ? "Yes" : "No"}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Country</div>
              <div className="font-medium">{user.address_country || "-"}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">City</div>
              <div className="font-medium">{user.address_city || "-"}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Date of Birth</div>
              <div className="font-medium">{user.date_of_birth || "-"}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Joined</div>
              <div className="font-medium">{new Date(user.created_at).toLocaleDateString()}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Last Login</div>
              <div className="font-medium">{user.last_login_at ? new Date(user.last_login_at).toLocaleString() : "Never"}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Total Logins</div>
              <div className="font-medium">{user.login_count}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Nationalities</div>
              <div className="font-medium">{user.nationalities.length > 0 ? user.nationalities.join(", ") : "-"}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Tax Residencies</div>
              <div className="font-medium">{user.tax_residencies.length > 0 ? user.tax_residencies.join(", ") : "-"}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Phone</div>
              <div className="font-medium">
                {user.phone_country_code && user.phone_number
                  ? `${user.phone_country_code} ${user.phone_number}`
                  : "-"}
              </div>
            </div>
          </div>

          <Separator className="my-4" />

          <div className="flex gap-2">
            {user.is_disabled ? (
              <Button onClick={() => setConfirmAction("enable")}>Enable Account</Button>
            ) : (
              <Button variant="destructive" onClick={() => setConfirmAction("disable")}>Disable Account</Button>
            )}
            {user.is_admin ? (
              <Button variant="outline" onClick={() => setConfirmAction("demote")}>Remove Admin</Button>
            ) : (
              <Button variant="outline" onClick={() => setConfirmAction("promote")}>Promote to Admin</Button>
            )}
            <Button
              variant="destructive"
              className="ml-auto"
              onClick={() => setConfirmAction("delete")}
            >
              Delete User
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Workspace Stats */}
      {user.workspaces.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Workspaces</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Currency</TableHead>
                  <TableHead>Accounts</TableHead>
                  <TableHead>Transactions</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {user.workspaces.map((ws) => (
                  <TableRow key={ws.workspace_id}>
                    <TableCell className="font-medium">{ws.workspace_name}</TableCell>
                    <TableCell>{ws.base_currency}</TableCell>
                    <TableCell>{ws.account_count}</TableCell>
                    <TableCell>{ws.transaction_count}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {ws.created_at ? new Date(ws.created_at).toLocaleDateString() : "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Activity / Audit Log */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {auditLogs.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">No activity recorded</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>By</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {auditLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(log.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={log.action.startsWith("admin.") ? "destructive" : "secondary"}
                        className="text-xs"
                      >
                        {log.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{log.actor_email || log.actor_user_id}</TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                      {log.details || "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <Dialog open={!!confirmAction} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmAction === "disable" && "Disable User?"}
              {confirmAction === "enable" && "Enable User?"}
              {confirmAction === "promote" && "Promote to Admin?"}
              {confirmAction === "demote" && "Remove Admin Role?"}
              {confirmAction === "delete" && "Permanently Delete User?"}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {confirmAction === "delete" ? (
              <>This will permanently delete <strong>{user.email}</strong> and all their data (workspaces, transactions, accounts). This cannot be undone.</>
            ) : (
              <>Are you sure you want to {confirmAction} <strong>{user.email}</strong>?</>
            )}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmAction(null)}>Cancel</Button>
            <Button
              variant={confirmAction === "disable" || confirmAction === "demote" || confirmAction === "delete" ? "destructive" : "default"}
              onClick={handleAction}
            >
              {confirmAction === "delete" ? "Delete Permanently" : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
