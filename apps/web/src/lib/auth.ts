export type AuthTokenPayload = {
  sub: number
  email: string
  name: string
  tenantId: number
  profileId: number
  tenantName?: string
  tenantCnpj?: string
  permissions?: Record<string, boolean>
  exp?: number
  iat?: number
}

export type TenantRecord = {
  id: number
  name: string
  legalName?: string | null
  email?: string | null
  accessTier?: string | null
  trialStartsAt?: string | null
  trialEndsAt?: string | null
}

export const TOKEN_KEY = "fluxora.access_token"
export const TENANT_KEY = "fluxora.tenant_id"

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/")
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=")

  if (typeof window === "undefined") {
    return Buffer.from(padded, "base64").toString("utf8")
  }

  return window.atob(padded)
}

export function decodeAccessToken(token: string): AuthTokenPayload | null {
  try {
    const [, payload] = token.split(".")
    if (!payload) return null
    return JSON.parse(decodeBase64Url(payload)) as AuthTokenPayload
  } catch {
    return null
  }
}

export function getStoredToken() {
  if (typeof window === "undefined") return null
  return localStorage.getItem(TOKEN_KEY)
}

export function getStoredTenantId() {
  if (typeof window === "undefined") return null
  return localStorage.getItem(TENANT_KEY)
}

export function storeSession(token: string, tenantId?: string | number | null) {
  if (typeof window === "undefined") return
  localStorage.setItem(TOKEN_KEY, token)
  if (tenantId) {
    localStorage.setItem(TENANT_KEY, String(tenantId))
  }
}

export function clearSession() {
  if (typeof window === "undefined") return
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(TENANT_KEY)
}

export function isTokenExpired(payload: AuthTokenPayload | null) {
  if (!payload?.exp) return false
  return payload.exp * 1000 <= Date.now()
}
