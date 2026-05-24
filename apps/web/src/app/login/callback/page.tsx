"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { resolveTenantIdFromToken, storeSession } from "@/lib/auth"

function readCallbackParams() {
  if (typeof window === "undefined") return new URLSearchParams()

  const hash = window.location.hash.startsWith("#")
    ? window.location.hash.slice(1)
    : window.location.hash

  const hashParams = new URLSearchParams(hash)
  if (hashParams.get("access_token")) {
    return hashParams
  }

  return new URLSearchParams(window.location.search)
}

export default function LoginCallbackPage() {
  const router = useRouter()
  const [state, setState] = useState<"loading" | "error">("loading")

  useEffect(() => {
    const params = readCallbackParams()
    const accessToken = params.get("access_token")
    const tenantId = params.get("tenantId") ?? (accessToken ? resolveTenantIdFromToken(accessToken) : null)

    if (!accessToken) {
      const timer = window.setTimeout(() => setState("error"), 0)
      return () => window.clearTimeout(timer)
    }

    storeSession(accessToken, tenantId)
    router.replace("/dashboard")
  }, [router])

  if (state === "loading") {
    return null
  }

  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/40 p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Falha no retorno do login</CardTitle>
          <CardDescription>
            Não foi possível localizar o token retornado pelo backend.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Revise o redirect do backend para apontar para /login/callback e tente novamente.
        </CardContent>
      </Card>
    </main>
  )
}
