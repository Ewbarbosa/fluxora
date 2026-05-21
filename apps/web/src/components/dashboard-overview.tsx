"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertTriangleIcon, RefreshCcwIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { getStoredToken } from "@/lib/auth"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

type Summary = {
  totalIncome: number
  totalExpense: number
  balance: number
  overdueCount: number
}

type Notifications = {
  dueTodayCount: number
  overdueCounts: {
    oneDay: number
    threeDays: number
    sevenDays: number
  }
  items: Array<{
    id: number
    description: string
    amount: number
    dueDate: string | null
    daysOverdue: number
    installmentLabel: string | null
  }>
}

type DashboardState = {
  summary: Summary | null
  notifications: Notifications | null
  loading: boolean
  error: string | null
}

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3333"

function formatMoney(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value)
}

function formatDate(value: string | null) {
  if (!value) return "—"
  return new Intl.DateTimeFormat("pt-BR").format(new Date(value))
}

export function DashboardOverview() {
  const [state, setState] = useState<DashboardState>({
    summary: null,
    notifications: null,
    loading: true,
    error: null,
  })

  const token = useMemo(() => getStoredToken(), [])

  const loadData = useCallback(async () => {
    if (!token) {
      setState({
        summary: null,
        notifications: null,
        loading: false,
        error: "Sessão não encontrada. Faça login novamente para carregar os dados reais.",
      })
      return
    }

    setState((current) => ({ ...current, loading: true, error: null }))

    const headers = {
      Authorization: `Bearer ${token}`,
    }

    const [summaryResponse, notificationsResponse] = await Promise.all([
      fetch(`${apiBaseUrl}/finance/summary`, { headers }),
      fetch(`${apiBaseUrl}/finance/notifications`, { headers }),
    ])

    const notificationsJson = notificationsResponse.ok
      ? ((await notificationsResponse.json()) as Notifications)
      : null

    let summaryJson: Summary | null = null
    let summaryError: string | null = null

    if (summaryResponse.ok) {
      summaryJson = (await summaryResponse.json()) as Summary
    } else if (summaryResponse.status === 403) {
      summaryError = "Resumo avançado ainda bloqueado para este workspace/plano."
    } else {
      summaryError = "Não foi possível carregar o resumo financeiro."
    }

    if (!notificationsResponse.ok) {
      setState({
        summary: summaryJson,
        notifications: null,
        loading: false,
        error: "Não foi possível carregar os alertas operacionais.",
      })
      return
    }

    setState({
      summary: summaryJson,
      notifications: notificationsJson,
      loading: false,
      error: summaryError,
    })
  }, [token])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadData()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [loadData])

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Visão financeira</h1>
          <p className="text-sm text-muted-foreground">
            Resumo real do workspace carregado a partir da API do Fluxora.
          </p>
        </div>
        <Button variant="outline" onClick={() => void loadData()} disabled={state.loading}>
          <RefreshCcwIcon className={state.loading ? "animate-spin" : ""} />
          Atualizar
        </Button>
      </div>

      {state.error ? (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="flex items-start gap-3 pt-4">
            <AlertTriangleIcon className="mt-0.5 size-4 text-amber-600" />
            <p className="text-sm text-muted-foreground">{state.error}</p>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid auto-rows-min gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>Saldo do período</CardDescription>
            <CardTitle>{state.summary ? formatMoney(state.summary.balance) : "—"}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Receitas</CardDescription>
            <CardTitle>{state.summary ? formatMoney(state.summary.totalIncome) : "—"}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Despesas</CardDescription>
            <CardTitle>{state.summary ? formatMoney(state.summary.totalExpense) : "—"}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
        <Card>
          <CardHeader>
            <CardTitle>Alertas operacionais</CardTitle>
            <CardDescription>
              {state.notifications
                ? `${state.notifications.items.length} item(ns) atrasado(s) listado(s)`
                : "Carregando alertas reais da API."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {state.notifications?.items.length ? (
              state.notifications.items.map((item) => (
                <div key={item.id} className="rounded-lg border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{item.description}</p>
                      <p className="text-sm text-muted-foreground">
                        Vencimento {formatDate(item.dueDate)}
                        {item.installmentLabel ? ` • Parcela ${item.installmentLabel}` : ""}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{formatMoney(item.amount)}</p>
                      <p className="text-xs text-amber-600">
                        {item.daysOverdue} dia(s) em atraso
                      </p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                {state.loading
                  ? "Carregando..."
                  : "Nenhum item em atraso retornado pela API."}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Radar rápido</CardTitle>
            <CardDescription>Indicadores imediatos do financeiro.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Vencem hoje</span>
              <strong>{state.notifications?.dueTodayCount ?? "—"}</strong>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Atrasos +1 dia</span>
              <strong>{state.notifications?.overdueCounts.oneDay ?? "—"}</strong>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Atrasos +3 dias</span>
              <strong>{state.notifications?.overdueCounts.threeDays ?? "—"}</strong>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Atrasos +7 dias</span>
              <strong>{state.notifications?.overdueCounts.sevenDays ?? "—"}</strong>
            </div>
            <div className="flex items-center justify-between border-t pt-4">
              <span className="text-muted-foreground">Registros em atraso</span>
              <strong>{state.summary?.overdueCount ?? "—"}</strong>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
