import { getToken } from "./auth"
import type {
  PaginatedUserResponse,
  AdminUserDetail,
  SystemStats,
  TimeSeriesPoint,
  AuthProviderBreakdown,
  AgeBracket,
  RetentionCohort,
  ConversionFunnel,
  FeatureAdoption,
  PaginatedAuditLogResponse,
} from "./admin-types"

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"

class ApiError extends Error {
  status: number
  body: unknown
  constructor(status: number, body: unknown) {
    const msg = typeof body === "object" && body !== null && "detail" in body
      ? String((body as { detail: string }).detail)
      : `HTTP ${status}`
    super(msg)
    this.status = status
    this.body = body
  }
}

async function adminFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options?.headers as Record<string, string> | undefined),
  }
  if (token) {
    headers["Authorization"] = `Bearer ${token}`
  }
  const response = await fetch(`${BASE_URL}${path}`, { ...options, headers })
  if (!response.ok) {
    let body: unknown
    try { body = await response.json() } catch { body = await response.text() }
    throw new ApiError(response.status, body)
  }
  return response.json() as Promise<T>
}

// ── Dashboard ──

export async function getSystemStats(): Promise<SystemStats> {
  return adminFetch<SystemStats>("/api/v1/admin/stats")
}

export async function getSignupGrowth(days = 90): Promise<TimeSeriesPoint[]> {
  return adminFetch<TimeSeriesPoint[]>(`/api/v1/admin/growth/signups?days=${days}`)
}

export async function getDAU(days = 30): Promise<TimeSeriesPoint[]> {
  return adminFetch<TimeSeriesPoint[]>(`/api/v1/admin/growth/dau?days=${days}`)
}

export async function getMAU(months = 12): Promise<TimeSeriesPoint[]> {
  return adminFetch<TimeSeriesPoint[]>(`/api/v1/admin/growth/mau?months=${months}`)
}

// ── User Management ──

export async function getUsers(params: {
  search?: string
  auth_provider?: string
  is_admin?: boolean
  is_disabled?: boolean
  offset?: number
  limit?: number
} = {}): Promise<PaginatedUserResponse> {
  const qs = new URLSearchParams()
  if (params.search) qs.set("search", params.search)
  if (params.auth_provider) qs.set("auth_provider", params.auth_provider)
  if (params.is_admin !== undefined) qs.set("is_admin", String(params.is_admin))
  if (params.is_disabled !== undefined) qs.set("is_disabled", String(params.is_disabled))
  if (params.offset !== undefined) qs.set("offset", String(params.offset))
  if (params.limit !== undefined) qs.set("limit", String(params.limit))
  return adminFetch<PaginatedUserResponse>(`/api/v1/admin/users?${qs}`)
}

export async function getUserDetail(userId: string): Promise<AdminUserDetail> {
  return adminFetch<AdminUserDetail>(`/api/v1/admin/users/${userId}`)
}

export async function disableUser(userId: string): Promise<{ message: string }> {
  return adminFetch(`/api/v1/admin/users/${userId}/disable`, { method: "POST" })
}

export async function enableUser(userId: string): Promise<{ message: string }> {
  return adminFetch(`/api/v1/admin/users/${userId}/enable`, { method: "POST" })
}

export async function promoteUser(userId: string): Promise<{ message: string }> {
  return adminFetch(`/api/v1/admin/users/${userId}/promote`, { method: "POST" })
}

export async function demoteUser(userId: string): Promise<{ message: string }> {
  return adminFetch(`/api/v1/admin/users/${userId}/demote`, { method: "POST" })
}

export async function deleteUser(userId: string): Promise<{ message: string }> {
  return adminFetch(`/api/v1/admin/users/${userId}`, { method: "DELETE" })
}

// ── Analytics ──

export async function getAuthProviderBreakdown(): Promise<AuthProviderBreakdown[]> {
  return adminFetch<AuthProviderBreakdown[]>("/api/v1/admin/analytics/auth-providers")
}

export async function getProfileCompletion(): Promise<{ completed: number; incomplete: number }> {
  return adminFetch("/api/v1/admin/analytics/profile-completion")
}

export async function getGeographicDistribution(): Promise<Array<{ country: string; count: number }>> {
  return adminFetch("/api/v1/admin/analytics/geographic")
}

export async function getAgeBreakdown(): Promise<AgeBracket[]> {
  return adminFetch<AgeBracket[]>("/api/v1/admin/analytics/age-breakdown")
}

export async function getRetentionCohorts(months = 6): Promise<RetentionCohort[]> {
  return adminFetch<RetentionCohort[]>(`/api/v1/admin/analytics/retention?months=${months}`)
}

export async function getConversionFunnel(): Promise<ConversionFunnel> {
  return adminFetch<ConversionFunnel>("/api/v1/admin/analytics/funnel")
}

export async function getFeatureAdoption(): Promise<FeatureAdoption> {
  return adminFetch<FeatureAdoption>("/api/v1/admin/analytics/feature-adoption")
}

// ── Audit Logs ──

export async function getAuditLogs(params: {
  action_prefix?: string
  actor_user_id?: string
  target_type?: string
  target_id?: string
  days?: number
  offset?: number
  limit?: number
} = {}): Promise<PaginatedAuditLogResponse> {
  const qs = new URLSearchParams()
  if (params.action_prefix) qs.set("action_prefix", params.action_prefix)
  if (params.actor_user_id) qs.set("actor_user_id", params.actor_user_id)
  if (params.target_type) qs.set("target_type", params.target_type)
  if (params.target_id) qs.set("target_id", params.target_id)
  if (params.days) qs.set("days", String(params.days))
  if (params.offset) qs.set("offset", String(params.offset))
  if (params.limit) qs.set("limit", String(params.limit))
  return adminFetch<PaginatedAuditLogResponse>(`/api/v1/admin/audit-logs?${qs}`)
}
