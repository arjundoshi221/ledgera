export interface AdminUserListItem {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
  auth_provider: string
  profile_completed: boolean
  is_admin: boolean
  is_disabled: boolean
  address_country: string | null
  created_at: string
  last_login_at: string | null
  login_count: number
}

export interface WorkspaceStats {
  workspace_id: string
  workspace_name: string
  base_currency: string
  transaction_count: number
  account_count: number
  created_at: string | null
}

export interface AdminUserDetail extends AdminUserListItem {
  date_of_birth: string | null
  nationalities: string[]
  tax_residencies: string[]
  phone_country_code: string | null
  phone_number: string | null
  address_city: string | null
  address_state: string | null
  address_postal_code: string | null
  workspaces: WorkspaceStats[]
}

export interface PaginatedUserResponse {
  users: AdminUserListItem[]
  total: number
  offset: number
  limit: number
}

export interface SystemStats {
  total_users: number
  total_workspaces: number
  total_transactions: number
  total_accounts: number
  active_users: number
  admin_users: number
}

export interface TimeSeriesPoint {
  date?: string
  month?: string
  count: number
}

export interface AuthProviderBreakdown {
  provider: string
  count: number
}

export interface AgeBracket {
  bracket: string
  count: number
}

export interface RetentionCohort {
  cohort: string
  total: number
  retained: number
  retention_rate: number
}

export interface ConversionFunnel {
  total_signups: number
  profile_completed: number
  active_users: number
  signup_to_profile_rate: number
  profile_to_active_rate: number
  signup_to_active_rate: number
}

export interface FeatureAdoptionItem {
  count: number
  rate: number
}

export interface FeatureAdoption {
  projections: FeatureAdoptionItem
  custom_funds: FeatureAdoptionItem
  recurring_transactions: FeatureAdoptionItem
}

export interface AuditLogEntry {
  id: string
  actor_user_id: string
  actor_email: string | null
  action: string
  target_type: string | null
  target_id: string | null
  details: string | null
  ip_address: string | null
  created_at: string
}

export interface PaginatedAuditLogResponse {
  logs: AuditLogEntry[]
  total: number
  offset: number
  limit: number
}

// ---------------------
// Bug Reports (Admin)
// ---------------------

export interface AdminBugReport {
  id: string
  user_id: string
  user_email: string | null
  title: string
  description: string
  status: "open" | "in_progress" | "resolved"
  media_count: number
  created_at: string
  updated_at: string
  resolved_at: string | null
}

export interface AdminBugReportMediaInfo {
  id: string
  filename: string
  content_type: string
  file_size: number
  created_at: string
}

export interface AdminBugReportDetail extends AdminBugReport {
  media: AdminBugReportMediaInfo[]
}

export interface PaginatedBugReportResponse {
  reports: AdminBugReport[]
  total: number
  offset: number
  limit: number
}
