"use client"

import { useEffect, useState, useCallback } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useToast } from "@/components/ui/use-toast"
import { getToken } from "@/lib/auth"
import {
  getAdminBugReports,
  getAdminBugReportDetail,
  updateBugStatus,
  deleteAdminBugReport,
  getBugMediaUrl,
} from "@/lib/admin-api"
import type { AdminBugReport, AdminBugReportDetail, PaginatedBugReportResponse } from "@/lib/admin-types"

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"

export default function AdminBugsPage() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<PaginatedBugReportResponse | null>(null)
  const [statusFilter, setStatusFilter] = useState("all")
  const [page, setPage] = useState(0)
  const limit = 50

  // Detail dialog
  const [detailOpen, setDetailOpen] = useState(false)
  const [detail, setDetail] = useState<AdminBugReportDetail | null>(null)
  const [mediaUrls, setMediaUrls] = useState<Record<string, string>>({})
  const [detailLoading, setDetailLoading] = useState(false)

  const loadReports = useCallback(async () => {
    try {
      setLoading(true)
      const res = await getAdminBugReports({
        status: statusFilter,
        offset: page * limit,
        limit,
      })
      setData(res)
    } catch (err: any) {
      toast({ variant: "destructive", title: "Failed to load bug reports", description: err.message })
    } finally {
      setLoading(false)
    }
  }, [statusFilter, page])

  useEffect(() => { loadReports() }, [loadReports])

  const totalPages = data ? Math.ceil(data.total / limit) : 0

  async function openDetail(bugId: string) {
    setDetailLoading(true)
    setDetailOpen(true)
    setMediaUrls({})
    try {
      const d = await getAdminBugReportDetail(bugId)
      setDetail(d)
      // Fetch media blobs for preview
      for (const m of d.media) {
        if (m.content_type.startsWith("image/")) {
          fetchMediaBlob(bugId, m.id)
        }
      }
    } catch (err: any) {
      toast({ variant: "destructive", title: "Failed to load details", description: err.message })
      setDetailOpen(false)
    } finally {
      setDetailLoading(false)
    }
  }

  async function fetchMediaBlob(bugId: string, mediaId: string) {
    try {
      const token = getToken()
      const response = await fetch(
        `${BASE_URL}/api/v1/admin/bugs/${bugId}/media/${mediaId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      if (!response.ok) return
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      setMediaUrls((prev) => ({ ...prev, [mediaId]: url }))
    } catch {
      // Silently fail on media load
    }
  }

  async function handleStatusChange(bugId: string, newStatus: string) {
    try {
      await updateBugStatus(bugId, newStatus)
      toast({ title: `Status updated to ${newStatus}` })
      loadReports()
      if (detail && detail.id === bugId) {
        setDetail({ ...detail, status: newStatus as any, media: newStatus === "resolved" ? [] : detail.media })
      }
    } catch (err: any) {
      toast({ variant: "destructive", title: "Failed to update status", description: err.message })
    }
  }

  async function handleDelete(bugId: string) {
    if (!confirm("Delete this bug report permanently?")) return
    try {
      await deleteAdminBugReport(bugId)
      toast({ title: "Bug report deleted" })
      loadReports()
      if (detailOpen && detail?.id === bugId) setDetailOpen(false)
    } catch (err: any) {
      toast({ variant: "destructive", title: "Failed to delete", description: err.message })
    }
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case "open":
        return <Badge variant="destructive" className="text-xs">Open</Badge>
      case "in_progress":
        return <Badge variant="secondary" className="text-xs">In Progress</Badge>
      case "resolved":
        return <Badge variant="outline" className="text-xs">Resolved</Badge>
      default:
        return <Badge variant="outline" className="text-xs">{status}</Badge>
    }
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Bugs & Issues</h1>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0) }}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
          </SelectContent>
        </Select>
        {data && (
          <span className="text-sm text-muted-foreground ml-auto">
            {data.total} report{data.total !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center animate-pulse text-muted-foreground">Loading bug reports...</div>
          ) : !data || data.reports.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No bug reports found</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Created</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Media</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.reports.map((report) => (
                  <TableRow
                    key={report.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => openDetail(report.id)}
                  >
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {new Date(report.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-sm">
                      {report.user_email || report.user_id.slice(0, 8) + "..."}
                    </TableCell>
                    <TableCell className="text-sm font-medium max-w-[300px] truncate">
                      {report.title}
                    </TableCell>
                    <TableCell>{getStatusBadge(report.status)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {report.media_count > 0 ? `${report.media_count} file${report.media_count > 1 ? "s" : ""}` : "-"}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        {report.status !== "resolved" && (
                          <Select
                            value={report.status}
                            onValueChange={(v) => handleStatusChange(report.id, v)}
                          >
                            <SelectTrigger className="h-7 w-[120px] text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="open">Open</SelectItem>
                              <SelectItem value="in_progress">In Progress</SelectItem>
                              <SelectItem value="resolved">Resolved</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-destructive hover:text-destructive"
                          onClick={() => handleDelete(report.id)}
                        >
                          Delete
                        </Button>
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

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Bug Report Details</DialogTitle>
          </DialogHeader>
          {detailLoading ? (
            <div className="py-8 text-center animate-pulse text-muted-foreground">Loading...</div>
          ) : detail ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h3 className="font-semibold text-lg">{detail.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    Reported by {detail.user_email || "unknown"} on {new Date(detail.created_at).toLocaleString()}
                  </p>
                </div>
                {getStatusBadge(detail.status)}
              </div>

              <div className="bg-muted rounded-md p-3">
                <p className="text-sm whitespace-pre-wrap">{detail.description}</p>
              </div>

              {detail.resolved_at && (
                <p className="text-sm text-muted-foreground">
                  Resolved on {new Date(detail.resolved_at).toLocaleString()}
                </p>
              )}

              {/* Media */}
              {detail.media.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Attachments ({detail.media.length})</h4>
                  <div className="grid gap-3">
                    {detail.media.map((m) => (
                      <div key={m.id} className="border rounded-md p-2">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm truncate">{m.filename}</span>
                          <span className="text-xs text-muted-foreground">{formatFileSize(m.file_size)}</span>
                        </div>
                        {m.content_type.startsWith("image/") && mediaUrls[m.id] && (
                          <img
                            src={mediaUrls[m.id]}
                            alt={m.filename}
                            className="rounded-md max-h-[300px] w-auto object-contain"
                          />
                        )}
                        {m.content_type.startsWith("video/") && (
                          <p className="text-xs text-muted-foreground italic">Video file - download to view</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {detail.status === "resolved" && detail.media.length === 0 && (
                <p className="text-sm text-muted-foreground italic">Media was cleared on resolution.</p>
              )}

              {/* Actions */}
              {detail.status !== "resolved" && (
                <div className="flex gap-2 pt-2">
                  {detail.status === "open" && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleStatusChange(detail.id, "in_progress")}
                    >
                      Mark In Progress
                    </Button>
                  )}
                  <Button
                    size="sm"
                    onClick={() => handleStatusChange(detail.id, "resolved")}
                  >
                    Mark Resolved
                  </Button>
                </div>
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
