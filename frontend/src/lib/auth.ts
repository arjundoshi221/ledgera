// ============================================================
// auth.ts - localStorage token and authentication helpers
// ============================================================

const TOKEN_KEY = "ledgera_token"
const USER_KEY = "ledgera_user"
const WORKSPACE_KEY = "ledgera_workspace"
const PROFILE_COMPLETE_KEY = "ledgera_profile_complete"
const ADMIN_KEY = "ledgera_is_admin"

/**
 * Retrieve the stored JWT access token.
 */
export function getToken(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem(TOKEN_KEY)
}

/**
 * Persist authentication credentials after a successful login or signup.
 */
export function setAuth(
  token: string,
  userId: string,
  workspaceId: string,
  profileCompleted: boolean = true,
  isAdmin: boolean = false
): void {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(USER_KEY, userId)
  localStorage.setItem(WORKSPACE_KEY, workspaceId)
  localStorage.setItem(PROFILE_COMPLETE_KEY, profileCompleted ? "true" : "false")
  localStorage.setItem(ADMIN_KEY, isAdmin ? "true" : "false")
}

/**
 * Remove all stored authentication data (logout).
 */
export function clearAuth(): void {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
  localStorage.removeItem(WORKSPACE_KEY)
  localStorage.removeItem(PROFILE_COMPLETE_KEY)
  localStorage.removeItem(ADMIN_KEY)
}

/**
 * Check whether the user currently has a stored token.
 */
export function isLoggedIn(): boolean {
  return getToken() !== null
}

/**
 * Check whether the user's profile is complete.
 */
export function isProfileComplete(): boolean {
  if (typeof window === "undefined") return false
  return localStorage.getItem(PROFILE_COMPLETE_KEY) === "true"
}

/**
 * Mark profile as complete (after completing onboarding).
 */
export function setProfileComplete(): void {
  localStorage.setItem(PROFILE_COMPLETE_KEY, "true")
}

/**
 * Check whether the user is an admin.
 */
export function isAdmin(): boolean {
  if (typeof window === "undefined") return false
  return localStorage.getItem(ADMIN_KEY) === "true"
}

/**
 * Retrieve the stored user ID.
 */
export function getUserId(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem(USER_KEY)
}

/**
 * Retrieve the stored workspace ID.
 */
export function getWorkspaceId(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem(WORKSPACE_KEY)
}
