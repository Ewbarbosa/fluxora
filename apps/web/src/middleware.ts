import { NextRequest, NextResponse } from "next/server"

import { TOKEN_COOKIE } from "@/lib/auth"

const PROTECTED_PATHS = ["/dashboard", "/finance", "/settings"]

function isProtectedPath(pathname: string) {
  return PROTECTED_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  )
}

function decodeTokenPayload(token: string) {
  try {
    const [, payload] = token.split(".")
    if (!payload) return null

    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/")
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=")
    return JSON.parse(atob(padded)) as { exp?: number }
  } catch {
    return null
  }
}

function isExpired(token: string) {
  const payload = decodeTokenPayload(token)
  if (!payload?.exp) return false
  return payload.exp * 1000 <= Date.now()
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (!isProtectedPath(pathname)) {
    return NextResponse.next()
  }

  const token = request.cookies.get(TOKEN_COOKIE)?.value

  if (!token || isExpired(token)) {
    const loginUrl = new URL("/login", request.url)
    loginUrl.searchParams.set("next", pathname)

    const response = NextResponse.redirect(loginUrl)
    response.cookies.delete(TOKEN_COOKIE)
    return response
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/dashboard/:path*", "/finance/:path*", "/settings/:path*"],
}
