"use client"

import { useEffect, useState, useCallback } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/components/ui/use-toast"
import { getAuditLogs } from "@/lib/admin-api"
import type { AuditLogEntry, PaginatedAuditLogResponse } from "@/lib/admin-types"

export default function AdminAuditLogPage() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<PaginatedAuditLogResponse | null>(null)
  const [actionFilter, setActionFilter] = useState("all")
  const [daysFilter, setDaysFilter] = useState("30")
  const [page, setPage] = useState(0)
  const limit = 50

  const loadLogs = useCallback(async () => {
    try {
      setLoading(true)
      const params: any = {
        offset: page * limit,
        limit,
        days: parseInt(daysFilter),
      }
      if (actionFilter !== "all") params.action_prefix = actionFilter
      const res = await getAuditLogs(params)
      setData(res)
    } catch (err: any) {
      toast({ variant: "destructive", title: "Failed to load audit logs", description: err.message })
    } finally {
      setLoading(false)
    }
  }, [actionFilter, daysFilter, page])

  useEffect(() => { loadLogs() }, [loadLogs])

  const totalPages = data ? Math.ceil(data.total / limit) : 0

  function getActionBadgeVariant(action: string): "destructive" | "secondary" | "outline" {
    if (action.startsWith("admin.user.disable") || action.startsWith("admin.user.demote")) return "destructive"
    if (action.startsWith("admin.")) return "secondary"
    return "outline"
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Audit Log</h1>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v); setPage(0) }}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Action Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Actions</SelectItem>
            <SelectItem value="admin.user">Admin User Actions</SelectItem>
            <SelectItem value="admin.user.disable">User Disabled</SelectItem>
            <SelectItem value="admin.user.enable">User Enabled</SelectItem>
            <SelectItem value="admin.user.promote">User Promoted</SelectItem>
            <SelectItem value="admin.user.demote">User Demoted</SelectItem>
          </SelectContent>
        </Select>
        <Select value={daysFilter} onValueChange={(v) => { setDaysFilter(v); setPage(0) }}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Time Range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
            <SelectItem value="365">Last year</SelectItem>
          </SelectContent>
        </Select>
        {data && (
          <span className="text-sm text-muted-foreground ml-auto">
            {data.total} entr{data.total !== 1 ? "ies" : "y"}
          </span>
        )}
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center animate-pulse text-muted-foreground">Loading audit logs...</div>
          ) : !data || data.logs.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No audit log entries found</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead>IP Address</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-sm">
                      {log.actor_email || log.actor_user_id.slice(0, 8) + "..."}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getActionBadgeVariant(log.action)} className="text-xs">
                        {log.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {log.target_type ? `${log.target_type}` : "-"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[250px] truncate">
                      {log.details ? formatDetails(log.details) : "-"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {log.ip_address || "-"}
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
    </div>
  )
}

function formatDetails(details: string): string {
  try {
    const parsed = JSON.parse(details)
    if (parsed.email) return parsed.email
    return details
  } catch {
    return details
  }
}
